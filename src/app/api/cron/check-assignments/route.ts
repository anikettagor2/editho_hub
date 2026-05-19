import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { notifyPMEditorRejected, notifyPMProjectReminder24h, notifyEditorDelay10m, notifyPMDelay10m } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Optional: Verify authorization header for cron job security 
        // e.g. checking process.env.CRON_SECRET

        const now = Date.now();
        
        // Find all projects with pending assignment that have expired
        const projectsRef = adminDb.collection('projects');
        const expiredQuery = projectsRef
            .where('assignmentStatus', '==', 'pending')
            .where('assignmentExpiresAt', '<=', now);

        const snapshot = await expiredQuery.get();

        const batch = adminDb.batch();
        let processedCount = 0;
        let reminderCount = 0;

        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                
                // 1. Update project document
                batch.update(doc.ref, {
                    assignmentStatus: 'expired',
                    status: 'pending_assignment',
                    editorDeclineReason: 'Assignment expired - no response within 15 minutes',
                    assignedEditorId: admin.firestore.FieldValue.delete(),
                    editorPrice: admin.firestore.FieldValue.delete(),
                    assignmentAt: admin.firestore.FieldValue.delete(),
                    assignmentExpiresAt: admin.firestore.FieldValue.delete(),
                    updatedAt: now
                });

                // 2. Add Notification for PM
                const expiredPmId = projectData?.assignedPMId;
                if (expiredPmId) {
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
                        message: `${expiredEditorName} did not respond within 15 minutes. Please reassign the project.`,
                        projectId,
                        editorName: expiredEditorName,
                        reason: 'No response within 15 minutes',
                        read: false,
                        link: `/dashboard?project=${projectId}`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Send WhatsApp via pro_delay template
                    // Don't wait for batch to commit for WhatsApp, do it directly
                    void notifyPMEditorRejected(projectId, expiredPmId, expiredEditorName, 'No response within 15 minutes')
                        .catch(err => console.error('[Cron] Failed to send WhatsApp notification:', err));
                }

                processedCount++;
            }
        }

        // Check for 24-hour reminders
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const reminderThreshold = now - TWENTY_FOUR_HOURS_MS;
        
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
                    void notifyPMProjectReminder24h(
                        projectId,
                        projectData.assignedPMId,
                        projectData.name || 'Project',
                        editorName,
                        24
                    ).catch(err => console.error('[Cron] Failed to send 24h reminder:', err));
                    
                    reminderCount++;
                }
            }
        }

        // Check for 10-minute editor reminder alerts
        const TEN_MINUTES_MS = 10 * 60 * 1000;
        const pendingQuery = projectsRef.where('assignmentStatus', '==', 'pending');
        const pendingSnapshot = await pendingQuery.get();
        
        let editor10mAlertCount = 0;
        if (!pendingSnapshot.empty) {
            for (const doc of pendingSnapshot.docs) {
                const projectData = doc.data();
                const projectId = doc.id;
                
                if (!projectData.editor10mAlertSent && projectData.assignmentAt && (now - projectData.assignmentAt >= TEN_MINUTES_MS)) {
                    if (projectData.assignedEditorId) {
                        const link = `https://editohub.in/dashboard?project=${projectId}`;
                        
                        batch.update(doc.ref, {
                            editor10mAlertSent: true,
                            updatedAt: now
                        });
                        
                        void notifyEditorDelay10m(
                            projectId,
                            projectData.assignedEditorId,
                            projectData.name || 'Project',
                            link
                        ).catch(err => console.error('[Cron] Failed to send editor 10m alert:', err));
                        
                        editor10mAlertCount++;
                    }
                }
            }
        }

        // Check for 10-minute PM assignment alerts (without auto-assign clients)
        let pm10mAlertCount = 0;
        const recentProjectsQuery = projectsRef
            .where('createdAt', '>=', now - TWENTY_FOUR_HOURS_MS)
            .where('createdAt', '<=', now - TEN_MINUTES_MS);
            
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
                                const link = `https://editohub.in/dashboard?project=${projectId}`;
                                
                                batch.update(doc.ref, {
                                    pm10mAlertSent: true,
                                    updatedAt: now
                                });
                                
                                void notifyPMDelay10m(
                                    projectId,
                                    projectData.assignedPMId,
                                    projectData.name || 'Project',
                                    link
                                ).catch(err => console.error('[Cron] Failed to send PM 10m alert:', err));
                                
                                pm10mAlertCount++;
                            }
                        }
                    }
                }
            }
        }

        if (processedCount > 0 || reminderCount > 0 || editor10mAlertCount > 0 || pm10mAlertCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processed ${processedCount} expired assignments, ${reminderCount} 24h reminders, ${editor10mAlertCount} editor 10m alerts, and ${pm10mAlertCount} PM 10m alerts`,
            processed: processedCount,
            reminders: reminderCount,
            editor10mAlerts: editor10mAlertCount,
            pm10mAlerts: pm10mAlertCount
        });



    } catch (error: any) {
        console.error('Error processing expired assignments:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
