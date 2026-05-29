import Mux from "@mux/mux-node";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export async function POST(request: NextRequest) {
    try {
        const { uploadId, revisionId } = await request.json();

        if (!uploadId || !revisionId) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Firebase Document IDs are precisely 20 characters alphanumeric (base62).
        // Mux Upload IDs will not fit this pattern. This prevents a crash when a duplicate video job doc is passed.
        if (uploadId.length === 20) {
            console.log(`[SyncMuxVideo] Ignoring Sync request: ${uploadId} appears to be a Firebase doc ID, not a Mux Upload ID.`);
            return NextResponse.json({ success: false, error: "Invalid Mux Upload ID format" }, { status: 400 });
        }

        // 1. Fetch the upload from Mux
        const upload = await mux.video.uploads.retrieve(uploadId);
        
        if (upload.status === "asset_created" && upload.asset_id) {
            // 2. Fetch the asset
            const asset = await mux.video.assets.retrieve(upload.asset_id);
            
            if (asset.status === "ready") {
                const playbackId = asset.playback_ids?.[0]?.id;
                if (playbackId) {
                    await adminDb.collection("revisions").doc(revisionId).set({
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        status: "ready",
                        updatedAt: Date.now(),
                    }, { merge: true });

                    await adminDb.collection("video_jobs").doc(uploadId).set({
                        status: "ready",
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        updatedAt: Date.now(),
                    }, { merge: true });
                    
                    console.log(`[SyncMuxVideo] Manually synced revision ${revisionId} with playbackId ${playbackId}`);

                    // Send the draft submitted notification as a fallback
                    try {
                        const revisionSnap = await adminDb.collection("revisions").doc(revisionId).get();
                        if (revisionSnap.exists) {
                            const revisionData = revisionSnap.data();
                            const clientNotified = revisionData?.clientNotified || false;

                            if (!clientNotified) {
                                const versionNumber = revisionData?.version || 1;
                                const finalProjectId = revisionData?.projectId;

                                if (finalProjectId) {
                                    const DEFAULT_APP_BASE_URL = "https://www.editohub.com";
                                    const appBaseUrl = (
                                        process.env.NEXT_PUBLIC_APP_URL ||
                                        process.env.APP_URL ||
                                        DEFAULT_APP_BASE_URL
                                    ).replace(/\/+$/, "");
                                    
                                    const clientDashboardLink = `https://www.editohub.com/dashboard/${finalProjectId}`;

                                    console.log(`[SyncMuxVideo] Sending draft ready notification for project ${finalProjectId}, version ${versionNumber}`);
                                    const { notifyClientDraftSubmitted } = await import("@/lib/whatsapp");
                                    const draftNotifyResult = await notifyClientDraftSubmitted(finalProjectId, versionNumber, clientDashboardLink);
                                    if (!draftNotifyResult.success) {
                                        console.error('[SyncMuxVideo] Draft submitted notification failed', {
                                            projectId: finalProjectId,
                                            error: draftNotifyResult.error,
                                        });
                                    } else {
                                        console.log('[SyncMuxVideo] Draft submitted notification sent successfully (via sync)', {
                                            projectId: finalProjectId,
                                            versionNumber,
                                        });
                                        // Mark as notified in revision doc
                                        await adminDb.collection("revisions").doc(revisionId).set({
                                            clientNotified: true,
                                            clientNotifiedAt: Date.now()
                                        }, { merge: true });
                                    }
                                } else {
                                    console.warn(`[SyncMuxVideo] Could not determine projectId for revision ${revisionId}. Notification skipped.`);
                                }
                            } else {
                                console.log(`[SyncMuxVideo] Draft notification already sent for revision ${revisionId}. Skipping.`);
                            }
                        }
                    } catch (notifyError) {
                        console.error('[SyncMuxVideo] Error in draft notification block:', notifyError);
                    }

                    return NextResponse.json({ success: true, playbackId });
                }
            }
        }

        return NextResponse.json({ success: false, status: upload.status });
    } catch (error: unknown) {
        console.error("[SyncMuxVideo] Error:", error);
        const message = error instanceof Error ? error.message : "Mux sync failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
