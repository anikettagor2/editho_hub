import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import Mux from "@mux/mux-node";
import { notifyClientDraftSubmitted } from "@/lib/whatsapp";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function POST(request: NextRequest) {
    try {
        const signature = request.headers.get("mux-signature");
        const webhookSecret = process.env.MUX_WEBHOOK_SECRET;

        if (webhookSecret && !signature) {
            console.error("[MuxWebhook] Missing mux-signature header");
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }

        const rawBody = await request.text();

        if (webhookSecret && signature) {
            try {
                mux.webhooks.verifySignature(rawBody, request.headers, webhookSecret);
            } catch (err) {
                console.error("[MuxWebhook] Invalid signature:", err);
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const body = JSON.parse(rawBody);
        const { type, data } = body;

        console.log(`[MuxWebhook] Received event: ${type}`);

        if (type === "video.asset.ready") {
            const asset = data;
            const playbackId = asset.playback_ids?.[0]?.id;
            let metadata: Record<string, unknown> = asset.metadata || {};
            if (asset.passthrough) {
                try {
                    metadata = JSON.parse(asset.passthrough);
                } catch {
                    console.warn("[MuxWebhook] Failed to parse passthrough JSON");
                }
            }
            
            const metadataRaw = metadata as any;
            const projectId = metadataRaw.projectId || metadataRaw.pid;
            const revisionId = metadataRaw.revisionId || metadataRaw.rid;
            const uploadType = metadataRaw.type || metadataRaw.t;
            const s3Key = metadataRaw.s3Key;
            
            console.log(`[MuxWebhook] Metadata extracted:`, { 
                projectId, 
                revisionId, 
                uploadType, 
                hasS3Key: !!s3Key 
            });

            if (playbackId) {
                if (uploadType === "revision" && revisionId) {
                    await adminDb.collection("revisions").doc(revisionId).set({
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        status: "ready",
                        updatedAt: Date.now(),
                        ...(s3Key ? { s3Key } : {}),
                    }, { merge: true });

                    // Persist on both revisionId and upload_id keyed job docs
                    const jobUpdate: any = {
                        status: "ready",
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        updatedAt: Date.now(),
                    };
                    if (s3Key) jobUpdate.s3Key = s3Key;

                    await adminDb.collection("video_jobs").doc(revisionId).set(jobUpdate, { merge: true });
                    if (asset.upload_id) {
                        await adminDb.collection("video_jobs").doc(asset.upload_id).set(jobUpdate, { merge: true });
                    }
                    
                    console.log(`[MuxWebhook] Updated revision ${revisionId} to ready`);

                    // Send the draft submitted notification now that the Mux video is ready!
                    try {
                        const revisionSnap = await adminDb.collection("revisions").doc(revisionId).get();
                        if (revisionSnap.exists) {
                            const revisionData = revisionSnap.data();
                            const clientNotified = revisionData?.clientNotified || false;

                            if (!clientNotified) {
                                const versionNumber = revisionData?.version || 1;
                                const finalProjectId = revisionData?.projectId || projectId;

                                if (finalProjectId) {
                                    const clientDashboardLink = `https://www.editohub.com/dashboard/${finalProjectId}`;

                                    console.log(`[MuxWebhook] Sending draft ready notification for project ${finalProjectId}, version ${versionNumber}`);
                                    const draftNotifyResult = await notifyClientDraftSubmitted(finalProjectId, versionNumber, clientDashboardLink);
                                    if (!draftNotifyResult.success) {
                                        console.error('[MuxWebhook] Draft submitted notification failed', {
                                            projectId: finalProjectId,
                                            error: draftNotifyResult.error,
                                        });
                                    } else {
                                        console.log('[MuxWebhook] Draft submitted notification sent successfully', {
                                            projectId: finalProjectId,
                                            versionNumber,
                                        });
                                        // Mark as notified in revision doc to prevent duplicates
                                        await adminDb.collection("revisions").doc(revisionId).set({
                                            clientNotified: true,
                                            clientNotifiedAt: Date.now()
                                        }, { merge: true });
                                    }
                                } else {
                                    console.warn(`[MuxWebhook] Could not determine projectId for revision ${revisionId}. Notification skipped.`);
                                }
                            } else {
                                console.log(`[MuxWebhook] Draft notification already sent for revision ${revisionId}. Skipping.`);
                            }
                        } else {
                            console.warn(`[MuxWebhook] Revision doc ${revisionId} not found in Firestore. Cannot send draft notification.`);
                        }
                    } catch (notifyError) {
                        console.error('[MuxWebhook] Error in draft notification block:', notifyError);
                    }
                } else if (projectId) {
                    // Handle raw footage/assets
                    const projectRef = adminDb.collection("projects").doc(projectId);
                    const projectSnap = await projectRef.get();
                    if (projectSnap.exists) {
                        const projectData = projectSnap.data();
                        const uploadId = asset.upload_id;
                        if (uploadId) {
                            const fieldName = 
                                (uploadType === "raw_footage" || uploadType === "raw") ? "rawFiles" : 
                                uploadType === "brole_footage" ? "bRoleFiles" : 
                                uploadType === "pm_file" ? "pmFiles" :
                                "deliveredFiles";
                            
                            const files = [...(projectData?.[fieldName] || [])];
                            const fileIndex = files.findIndex((f: any) => f.url === `mux://${uploadId}` || f.storagePath === `mux://${uploadId}`);
                            
                            if (fileIndex !== -1) {
                                files[fileIndex].playbackId = playbackId;
                                files[fileIndex].url = `https://stream.mux.com/${playbackId}.m3u8`;
                                await projectRef.update({ [fieldName]: files });
                            }
                        }
                    }
                }
            }
        } else if (type === "video.asset.created" || type === "video.upload.completed") {
            // Transition to processing state
            const asset = data;
            let metadata: Record<string, unknown> = asset.metadata || {};
            if (asset.passthrough) {
                try {
                    metadata = JSON.parse(asset.passthrough);
                } catch { /* ignore */ }
            }
            
            const metadataRaw = metadata as any;
            const revisionId = metadataRaw.revisionId || metadataRaw.rid;
            const s3Key = metadataRaw.s3Key;
            const uploadId = asset.upload_id || (type === "video.upload.completed" ? asset.id : null);

            const jobUpdate: any = {
                status: "processing",
                updatedAt: Date.now(),
            };
            if (s3Key) jobUpdate.s3Key = s3Key;

            if (revisionId) {
                await adminDb.collection("video_jobs").doc(revisionId).set(jobUpdate, { merge: true });
            }
            if (uploadId) {
                await adminDb.collection("video_jobs").doc(uploadId).set(jobUpdate, { merge: true });
            }
            console.log(`[MuxWebhook] Job ${revisionId || uploadId} transitioned to processing`);
        }

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error("[MuxWebhook] Error:", error);
        const message = error instanceof Error ? error.message : "Webhook processing failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
