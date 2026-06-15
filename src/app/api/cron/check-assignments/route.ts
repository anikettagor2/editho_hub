import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { notifyPMEditorRejected, notifyPMProjectReminder24h, notifyEditorDelay10m, notifyPMDelay10m, notifyEditorLate, notifyPMLate } from '@/lib/whatsapp';
import { tryNextAutoAssign } from '@/app/actions/admin-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const DEFAULT_APP_BASE_URL = "https://www.editohub.com";
        const appBaseUrl = (
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.APP_URL ||
            DEFAULT_APP_BASE_URL
        ).replace(/\/+$/, "");

        const now = Date.now();
        
        // Fetch custom delay configurations
        const whatsappSettingsSnap = await adminDb.collection('settings').doc('whatsapp').get();
        const whatsappSettings = whatsappSettingsSnap.exists ? whatsappSettingsSnap.data() : null;
        
        const editorAcceptanceDelay = whatsappSettings?.editorAcceptanceDelay ?? 15; // default 15m
        const editorReminderDelay = whatsappSettings?.editorReminderDelay ?? 10;     // default 10m
        const pmReminderDelay = whatsappSettings?.pmReminderDelay ?? 10;             // default 10m
        const pmProductionReminderDelay = whatsappSettings?.pmProductionReminderDelay ?? 24; // default 24h
        
        const editorReminderDelayMs = editorReminderDelay * 60 * 1000;
        const pmReminderDelayMs = pmReminderDelay * 60 * 1000;
        const pmProductionReminderDelayMs = pmProductionReminderDelay * 60 * 60 * 1000;
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

        const notificationPromises: Promise<any>[] = [];

        // Find all projects with pending assignment that have expired
        const projectsRef = adminDb.collection('projects');
        const expiredQuery = projectsRef
            .where('assignmentStatus', '==', 'pending')
            .where('assignmentExpiresAt', '<=', now);

        const snapshot = await expiredQuery.get();

        const batch = adminDb.batch();
        let processedCount = 0;
        let reminderCount = 0;
        const expiredProjectIds: string[] = [];

        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                expiredProjectIds.push(projectId);
                
                // Check if client is auto-assigned
                let isAutoAssign = false;
                if (projectData?.clientId) {
                    const clientSnap = await adminDb.collection('users').doc(projectData.clientId).get();
                    if (clientSnap.exists) {
                        const clientData = clientSnap.data();
                        isAutoAssign = (clientData?.assignedEditorPriority?.length || 0) > 0;
                    }
                }

                // 1. Update project document
                batch.update(doc.ref, {
                    assignmentStatus: 'expired',
                    status: 'pending_assignment',
                    editorDeclineReason: `Assignment expired - no response within ${editorAcceptanceDelay} minutes`,
                    assignedEditorId: admin.firestore.FieldValue.delete(),
                    editorPrice: admin.firestore.FieldValue.delete(),
                    assignmentAt: admin.firestore.FieldValue.delete(),
                    assignmentExpiresAt: admin.firestore.FieldValue.delete(),
                    updatedAt: now
                });

                // 2. Add Notification for PM (only if not an auto-assigned project)
                const expiredPmId = projectData?.assignedPMId;
                if (expiredPmId && !isAutoAssign) {
                    let expiredEditorName = 'Editor';
                    if (projectData?.assignedEditorId) {
                        const expiredEditorSnap = await adminDb.collection('users').doc(projectData.assignedEditorId).get();
                        if (expiredEditorSnap.exists) {
                            expiredEditorName = expiredEditorSnap.data()?.displayName || 'Editor';
                        }
                    }

                    // In-app notification
                    const expiredNotifRef = adminDb.collection('notifications').doc();
                    batch.set(expiredNotifRef, {
                        id: expiredNotifRef.id,
                        userId: expiredPmId,
                        type: 'project_rejected',
                        title: `${projectData?.name || 'Project'} - Assignment Timed Out`,
                        message: `${expiredEditorName} did not respond within ${editorAcceptanceDelay} minutes. Please reassign the project.`,
                        projectId,
                        editorName: expiredEditorName,
                        reason: `No response within ${editorAcceptanceDelay} minutes`,
                        read: false,
                        link: `/dashboard?project=${projectId}`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Send WhatsApp via pro_delay template
                    notificationPromises.push(
                        notifyPMEditorRejected(projectId, expiredPmId, expiredEditorName, `No response within ${editorAcceptanceDelay} minutes`)
                            .catch(err => console.error('[Cron] Failed to send WhatsApp notification:', err))
                    );
                }

                processedCount++;
            }
        }

        // Check for PM production reminders
        const reminderThreshold = now - pmProductionReminderDelayMs;
        
        const activeProjectsQuery = projectsRef
            .where('status', '==', 'in_production')
            .where('assignmentAt', '<=', reminderThreshold);
            
        const activeSnapshot = await activeProjectsQuery.get();
        
        if (!activeSnapshot.empty) {
            for (const doc of activeSnapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                
                // Only send if we haven't sent it yet
                if (!projectData.reminder24hSent && projectData.assignedPMId && projectData.assignedEditorId) {
                    
                    let editorName = 'Editor';
                    const editorSnap = await adminDb.collection('users').doc(projectData.assignedEditorId).get();
                    if (editorSnap.exists) {
                        editorName = editorSnap.data()?.displayName || 'Editor';
                    }
                    
                    // Mark as sent
                    batch.update(doc.ref, {
                        reminder24hSent: true,
                        updatedAt: now
                    });
                    
                    // Send WhatsApp Notification to PM
                    notificationPromises.push(
                        notifyPMProjectReminder24h(
                            projectId,
                            projectData.assignedPMId,
                            projectData.name || 'Project',
                            editorName,
                            pmProductionReminderDelay
                        ).catch(err => console.error('[Cron] Failed to send production reminder:', err))
                    );
                    
                    reminderCount++;
                }
            }
        }

        // Check for editor reminder alerts
        const pendingQuery = projectsRef.where('assignmentStatus', '==', 'pending');
        const pendingSnapshot = await pendingQuery.get();
        
        let editor10mAlertCount = 0;
        if (!pendingSnapshot.empty) {
            for (const doc of pendingSnapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                
                if (!projectData.editor10mAlertSent && projectData.assignmentAt && (now - projectData.assignmentAt >= editorReminderDelayMs)) {
                    if (projectData.assignedEditorId) {
                        const link = `${appBaseUrl}/dashboard/${projectId}`;
                        
                        batch.update(doc.ref, {
                            editor10mAlertSent: true,
                            updatedAt: now
                        });
                        
                        notificationPromises.push(
                            notifyEditorDelay10m(
                                projectId,
                                projectData.assignedEditorId,
                                projectData.name || 'Project',
                                link
                            ).catch(err => console.error('[Cron] Failed to send editor reminder alert:', err))
                        );
                        
                        editor10mAlertCount++;
                    }
                }
            }
        }

        // Check for PM assignment alerts (without auto-assign clients)
        let pm10mAlertCount = 0;
        const recentProjectsQuery = projectsRef
            .where('createdAt', '>=', now - TWENTY_FOUR_HOURS_MS)
            .where('createdAt', '<=', now - pmReminderDelayMs);
            
        const recentSnapshot = await recentProjectsQuery.get();
        if (!recentSnapshot.empty) {
            for (const doc of recentSnapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                
                if (!projectData.pm10mAlertSent && projectData.assignedPMId && !projectData.assignedEditorId) {
                    if (projectData.clientId) {
                        const clientSnap = await adminDb.collection('users').doc(projectData.clientId).get();
                        if (clientSnap.exists) {
                            const clientData = clientSnap.data();
                            const priorities = clientData?.assignedEditorPriority || [];
                            const isAutoAssign = priorities.length > 0;
                            
                            if (!isAutoAssign) {
                                const link = `${appBaseUrl}/dashboard/${projectId}`;
                                
                                batch.update(doc.ref, {
                                    pm10mAlertSent: true,
                                    updatedAt: now
                                });
                                
                                notificationPromises.push(
                                    notifyPMDelay10m(
                                        projectId,
                                        projectData.assignedPMId,
                                        projectData.name || 'Project',
                                        link
                                    ).catch(err => console.error('[Cron] Failed to send PM reminder alert:', err))
                                );
                                
                                pm10mAlertCount++;
                            }
                        }
                    }
                }
            }
        }

        // Check for delayed projects (deadline passed)
        let delayAlertCount = 0;
        const delayQuery = projectsRef.where('status', 'in', ['in_production', 'amendment']);
        const delaySnapshot = await delayQuery.get();
        if (!delaySnapshot.empty) {
            for (const doc of delaySnapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;

                if (!projectData.delayAlertSent && projectData.deadline) {
                    const deadlineMs = new Date(projectData.deadline).getTime();
                    if (Number.isFinite(deadlineMs) && now > deadlineMs) {
                        const link = `${appBaseUrl}/dashboard/${projectId}`;
                        let editorName = 'Editor';

                        if (projectData.assignedEditorId) {
                            const editorSnap = await adminDb.collection('users').doc(projectData.assignedEditorId).get();
                            if (editorSnap.exists) {
                                editorName = editorSnap.data()?.displayName || 'Editor';
                            }

                            // Send notification to Editor
                            notificationPromises.push(
                                notifyEditorLate(
                                    projectId,
                                    projectData.assignedEditorId,
                                    projectData.name || 'Project',
                                    projectData.deadline,
                                    link
                                ).catch(err => console.error('[Cron] Failed to send editor delay alert:', err))
                            );
                        }

                        if (projectData.assignedPMId) {
                            // Send notification to PM
                            notificationPromises.push(
                                notifyPMLate(
                                    projectId,
                                    projectData.assignedPMId,
                                    projectData.name || 'Project',
                                    editorName,
                                    projectData.deadline,
                                    link
                                ).catch(err => console.error('[Cron] Failed to send PM delay alert:', err))
                            );
                        }

                        batch.update(doc.ref, {
                            delayAlertSent: true,
                            updatedAt: now
                        });

                        delayAlertCount++;
                    }
                }
            }
        }

        if (processedCount > 0 || reminderCount > 0 || editor10mAlertCount > 0 || pm10mAlertCount > 0 || delayAlertCount > 0) {
            await batch.commit();
        }

        // Wait for all WhatsApp notification API calls to complete
        if (notificationPromises.length > 0) {
            await Promise.all(notificationPromises);
        }

        // Run tryNextAutoAssign on all expired projects
        for (const pid of expiredProjectIds) {
            try {
                await tryNextAutoAssign(pid);
            } catch (err) {
                console.error('[Cron] Fallback error for project:', pid, err);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processed ${processedCount} expired assignments, ${reminderCount} reminders, ${editor10mAlertCount} editor alerts, ${pm10mAlertCount} PM alerts, and ${delayAlertCount} delay alerts`,
            processed: processedCount,
            reminders: reminderCount,
            editor10mAlerts: editor10mAlertCount,
            pm10mAlerts: pm10mAlertCount,
            delayAlerts: delayAlertCount
        });

    } catch (error: any) {
        console.error('Error processing expired assignments:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
