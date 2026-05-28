'use server';

import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { Project, Revision } from "@/types/schema";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client as s3, BUCKET_NAME } from '@/lib/s3';
import { video } from '@/lib/mux';

const ASSET_PURGE_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * ⚠️ CRITICAL BUSINESS RULE ⚠️
 * 
 * PROJECT COMPLETION REQUIRES DELIVERY AND ADMIN-CONFIRMED EDITOR PAYMENT
 * 
 * A delivered project remains "completed_pending_payment" until the admin
 * confirms the editor payout from the QR settlement flow. A download can only
 * set "completed" when that payout was already confirmed.
 * 
 * @see settleEditorPayment() - Admin QR confirmation completes delivered work.
 */

function extractS3KeyFromUrl(url: string, bucketName: string | undefined): string | null {
    if (!url || !bucketName) return null;
    
    // Check if it's an S3 URL
    if (!url.includes(".s3.") && !url.includes("amazonaws.com")) return null;

    try {
        // Path-style: https://s3.amazonaws.com/bucket-name/key
        // or https://s3.region.amazonaws.com/bucket-name/key
        if (url.includes(`/${bucketName}/`)) {
            const parts = url.split(`/${bucketName}/`);
            if (parts.length > 1) {
                return parts[1].split("?")[0];
            }
        }

        // Virtual-hosted style: https://bucket-name.s3.region.amazonaws.com/key
        const urlObj = new URL(url);
        // If hostname starts with bucket name followed by a dot
        if (urlObj.hostname.startsWith(`${bucketName}.`)) {
            return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1).split("?")[0] : urlObj.pathname.split("?")[0];
        }
        
        // Fallback for custom domains or other variants if the key is the only thing in the path
        if (urlObj.hostname.includes(bucketName)) {
             return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1).split("?")[0] : urlObj.pathname.split("?")[0];
        }

    } catch (e) {
        console.error("[extractS3KeyFromUrl] Error parsing URL:", e);
    }
    
    return null;
}

function extractStoragePathFromUrl(url?: string): string | null {
    if (!url) return null;

    if (url.startsWith("gs://")) {
        const noScheme = url.replace("gs://", "");
        const slashIdx = noScheme.indexOf("/");
        return slashIdx >= 0 ? noScheme.slice(slashIdx + 1) : null;
    }

    if (url.includes("/o/")) {
        const encoded = url.split("/o/")[1]?.split("?")[0];
        return encoded ? decodeURIComponent(encoded) : null;
    }

    return null;
}

async function deleteStorageFileByUrl(url?: string): Promise<void> {
    const path = extractStoragePathFromUrl(url);
    if (!path) return;

    try {
        await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
    } catch {
        // Ignore storage deletion failures to keep lifecycle job resilient.
    }
}

export async function purgeProjectAssets(projectId: string, projectData: any): Promise<void> {
    const rawUrls = (projectData.rawFiles || []).map((f: any) => f?.url).filter(Boolean);
    const referenceUrls = (projectData.referenceFiles || []).map((f: any) => f?.url).filter(Boolean);
    const scriptUrls = (projectData.scripts || []).map((f: any) => f?.url).filter(Boolean);
    const audioUrls = (projectData.audioFiles || []).map((f: any) => f?.url).filter(Boolean);
    const bRoleUrls = ((projectData.bRoleFiles || projectData.broleFiles || []) as any[]).map((f: any) => f?.url).filter(Boolean);
    const footageUrl = projectData.footageLink;

    const allUrls = [...rawUrls, ...referenceUrls, ...scriptUrls, ...audioUrls, ...bRoleUrls, footageUrl].filter(Boolean);
    await Promise.all(allUrls.map((u) => deleteStorageFileByUrl(u)));

    await adminDb.collection("projects").doc(projectId).update({
        rawFiles: [],
        referenceFiles: [],
        scripts: [],
        audioFiles: [],
        bRoleFiles: [],
        assetsPurgedAt: Date.now(),
        updatedAt: Date.now(),
    });
}

export async function finalizePaidDeliveredProject(projectId: string) {
    const projectRef = adminDb.collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
        return { success: false, error: "Project not found" };
    }

    const projectData = projectSnap.data() as Project & { completionNotifiedAt?: number };
    if (projectData.status !== "completed" || !projectData.editorPaid || !projectData.clientHasDownloaded) {
        return { success: false, error: "Project is not ready for paid completion" };
    }

    if (!projectData.completionNotifiedAt) {
        const { handleProjectCompleted } = await import("./notification-actions");
        await handleProjectCompleted(projectId);
        await projectRef.update({
            completionNotifiedAt: Date.now(),
            updatedAt: Date.now(),
        });
    }

    return { success: true };
}

export async function purgeProjectRevisionVideos(projectId: string): Promise<void> {
    const revisionsSnap = await adminDb
        .collection("revisions")
        .where("projectId", "==", projectId)
        .get();

    const now = Date.now();
    const batch = adminDb.batch();

    for (const revisionDoc of revisionsSnap.docs) {
        const revision = revisionDoc.data() as Revision;
        if (revision.videoUrl) {
            await deleteStorageFileByUrl(revision.videoUrl);
        }

        // Delete thumbnail from GCS if it exists
        if (revision.thumbnailUrl) {
            try {
                await deleteStorageFileByUrl(revision.thumbnailUrl);
            } catch (thumbErr) {
                console.error(`[purgeProjectRevisionVideos] Failed to delete thumbnail for revision ${revisionDoc.id}:`, thumbErr);
            }
        }

        // Delete HLS folder from GCS if it exists
        try {
            const hlsPrefix = `projects/${projectId}/hls/${revisionDoc.id}/`;
            console.log(`[purgeProjectRevisionVideos] Deleting GCS HLS folder: ${hlsPrefix}`);
            await adminStorage.bucket().deleteFiles({ prefix: hlsPrefix });
        } catch (hlsErr) {
            console.error(`[purgeProjectRevisionVideos] Failed to delete HLS folder for revision ${revisionDoc.id}:`, hlsErr);
        }

        // Hard-delete the asset from Mux storage if assetId exists
        if (revision.assetId) {
            try {
                console.log(`[purgeProjectRevisionVideos] Deleting Mux asset ${revision.assetId} for revision ${revisionDoc.id}`);
                await video.assets.delete(revision.assetId);
            } catch (muxErr: any) {
                console.error(`[purgeProjectRevisionVideos] Failed to delete Mux asset ${revision.assetId}:`, muxErr);
            }
        }

        batch.update(revisionDoc.ref, {
            videoUrl: "",
            thumbnailUrl: "",
            playbackId: "",
            hlsUrl: "",
            assetId: "",
            videoDeletedAt: now,
            status: "archived",
            description: `${revision.description || ""} [Auto Purged 24h After Download]`.trim(),
            updatedAt: now,
        });
    }

    await batch.commit();
    await adminDb.collection("projects").doc(projectId).update({
        finalVideoPurged: true,
        finalVideoPurgedAt: now,
        updatedAt: now,
    });
}

/**
 * Registers a download attempt for a revision, enforcing a download limit.
 *
 * IMPORTANT: Always uses the original high-quality videoUrl for downloads.
 * The optimizedUrl (360p MP4) is only for display in review systems.
 * This ensures clients always download the highest quality version available.
 */
export async function registerDownload(projectId: string, revisionId: string) {
    console.log(`[registerDownload] Initiating for Project: ${projectId}, Revision: ${revisionId}`);
    try {
        const docRef = adminDb.collection('revisions').doc(revisionId);
        const snap = await docRef.get();
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();

        if (!snap.exists) {
            console.error(`[registerDownload] Revision not found: ${revisionId}`);
            return { success: false, error: "Revision not found" };
        }

        if (!projectSnap.exists) {
            console.error(`[registerDownload] Project not found: ${projectId}`);
            return { success: false, error: "Project not found" };
        }

        const data = snap.data() as Revision;
        const projectData = projectSnap.data() as Project;
        const currentCount = data.downloadCount || 0;

        console.log(`[registerDownload] Current count: ${currentCount} (Unlimited)`);

        const now = Date.now();
        const nextCount = currentCount + 1;

        // Increment per-revision count.
        await docRef.update({
            downloadCount: nextCount
        });

        const newStatus = projectData.editorPaid ? 'completed' : 'completed_pending_payment';
        const projectUpdate: any = {
            clientHasDownloaded: true,
            downloadedAt: now,
            finalDownloadCount: nextCount,
            status: newStatus,
            updatedAt: now,
        };

        console.log(`[registerDownload] Updating project status to: ${newStatus}`);

        // Keep a retention timestamp for audit/history, even though raw assets are purged immediately now.
        if (!projectData.downloadRetentionStartedAt) {
            projectUpdate.downloadRetentionStartedAt = now;
            projectUpdate.assetsCleanupAfter = now + ASSET_PURGE_DELAY_MS;
        }

        await projectRef.update(projectUpdate);

        if (newStatus === 'completed') {
            await finalizePaidDeliveredProject(projectId);
        }

        let downloadUrl = data.videoUrl || "";
        let targetDocRef = docRef;
        let targetRevisionId = revisionId;

        // AUTO-RECOVERY: If the requested revision is empty, try to find the latest valid one for this project
        if (!downloadUrl && !data.s3Key && !data.assetId && !data.playbackId) {
            console.warn(`[registerDownload] Requested revision ${revisionId} is EMPTY. Attempting auto-recovery for Project: ${projectId}`);
            
            const allRevsSnap = await adminDb.collection('revisions')
                .where('projectId', '==', projectId)
                .get();
            
            const validRevs = allRevsSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as Revision))
                .filter(d => d.videoUrl || d.s3Key || d.assetId || d.playbackId)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            if (validRevs.length > 0) {
                const latestValid = validRevs[0];
                console.log(`[registerDownload] Auto-recovered: Falling back to Revision ${latestValid.id} (V${latestValid.version})`);
                downloadUrl = latestValid.videoUrl || "";
                
                // Switch context to the recovered revision
                data.s3Key = latestValid.s3Key;
                data.version = latestValid.version;
                targetDocRef = adminDb.collection('revisions').doc(latestValid.id);
                targetRevisionId = latestValid.id;
                
                const { addProjectLog } = await import("./admin-actions");
                await addProjectLog(projectId, 'DATA_REPAIR', { uid: 'system', displayName: 'EditoHub System' }, `Client tried to download empty revision ${revisionId}. System auto-recovered by serving latest valid revision ${latestValid.id} (V${latestValid.version}).`);
            } else {
                console.error(`[registerDownload] GHOST PROJECT: No valid revisions found for project ${projectId}`);
                return { 
                    success: false, 
                    error: "This project doesn't have any uploaded video files yet. Please contact your editor or support." 
                };
            }
        }

        // If s3Key exists, dynamically generate a fresh S3 presigned URL 
        // This is necessary because the initial presigned URL expires after 1 hour.
        let s3Key = data.s3Key;

        // Fallback: If s3Key is missing but videoUrl looks like an S3 URL, try to extract it
        if (!s3Key && downloadUrl) {
            const extractedKey = extractS3KeyFromUrl(downloadUrl, BUCKET_NAME);
            if (extractedKey) {
                s3Key = extractedKey;
                console.warn(`[registerDownload] CRITICAL: s3Key was missing in database for revision ${targetRevisionId}. Successfully extracted from URL: ${s3Key}. Patching database record.`);
                
                // Repair the database record immediately
                await targetDocRef.update({ 
                    s3Key: extractedKey,
                    updatedAt: now 
                });

                // Log this data inconsistency for admin review
                const { addProjectLog } = await import("./admin-actions");
                await addProjectLog(projectId, 'DATA_REPAIR', { uid: 'system', displayName: 'EditoHub System' }, `Missing s3Key recovered and PATCHED from videoUrl for revision ${targetRevisionId}. URL: ${downloadUrl}`);
            }
        }

        // DEEP RECOVERY: If s3Key is STILL missing but we have an assetId, try to fetch from Mux metadata
        if (!s3Key && data.assetId) {
            try {
                const asset = await video.assets.retrieve(data.assetId);
                if (asset.passthrough) {
                    const pt = JSON.parse(asset.passthrough);
                    if (pt.s3Key) {
                        s3Key = pt.s3Key;
                        console.log(`[registerDownload] Recovered s3Key from Mux metadata for ${targetRevisionId}: ${s3Key}`);
                        await targetDocRef.update({ s3Key, updatedAt: now });
                    }
                }
            } catch (muxErr) {
                console.warn(`[registerDownload] Failed to recover s3Key from Mux:`, muxErr);
            }
        }

        if (s3Key && BUCKET_NAME) {
            try {
                const safeProjectName = projectData.name ? projectData.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'Video';
                const downloadFilename = `${safeProjectName}_V${data.version || 'Draft'}.mp4`;

                const getCommand = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    ResponseContentDisposition: `attachment; filename="${downloadFilename}"`
                });
                downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
            } catch (s3Err) {
                console.error("[registerDownload] Error generating S3 presigned URL:", s3Err);
            }
        }

        // Mux does not support MP4 distribution, strictly prevent Mux URLs
        if (downloadUrl && downloadUrl.includes("stream.mux.com")) {
            downloadUrl = "";
        }

        if (!downloadUrl) {
            console.error(`[registerDownload] No video file available for revision: ${revisionId}`);
            return { success: false, error: "The video file for this revision is not available in our secure storage. Please contact support." };
        }

        // Generate a signed URL to enforce download behavior and bypass CORS, ONLY if it's a Firebase URL
        if (downloadUrl.includes('firebasestorage.googleapis.com')) {
            const safeProjectName = projectData.name ? projectData.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'Video';
            const downloadFilename = `${safeProjectName}_V${data.version || 'Draft'}.mp4`;
            
            const signedUrlRes = await getSignedDownloadUrl(downloadUrl, downloadFilename);
            if (signedUrlRes.success && signedUrlRes.url) {
                downloadUrl = signedUrlRes.url;
            }
        }

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { 
            success: true, 
            count: nextCount, 
            remaining: "unlimited", 
            downloadUrl,
            status: newStatus 
        };

    } catch (error: any) {
        console.error("[registerDownload] Fatal error:", error);
        return { success: false, error: error.message };
    }
}


import { notifyClientProjectCompleted } from "@/lib/whatsapp";

/**
 * Marks a project as paid/deferred based on user's Pay Later status.
 * This function bypasses payment processors.
 */
/**
 * Unlocks project downloads manually (Admin/PM override).
 */
export async function unlockProjectDownloads(projectId: string, userId: string) {
    try {
        // Verify user has permission
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { success: false, error: "User not found" };
        }

        const userData = userDoc.data();
        const allowedRoles = ['admin', 'project_manager'];

        if (!allowedRoles.includes(userData?.role)) {
            return { success: false, error: "Unauthorized: Only Admins or Project Managers can unlock downloads." };
        }

        await adminDb.collection('projects').doc(projectId).update({
            // status: 'completed', // Triggered exclusively by registerDownload
            downloadsUnlocked: true,
            downloadUnlockRequested: false,
            notes: FieldValue.arrayUnion(`Downloads unlocked by ${userData?.email} (${userData?.role}) at ${new Date().toISOString()}`)
        });

        // Notify client that project is completed/ready for download
        const completionNotifyResult = await notifyClientProjectCompleted(projectId);
        if (!completionNotifyResult.success) {
            console.error('[WhatsApp] Client completion notification failed', {
                projectId,
                error: completionNotifyResult.error,
            });
        }

        const { addProjectLog } = await import("./admin-actions");
        await addProjectLog(projectId, 'UNLOCKED', { uid: userId, displayName: userData?.displayName || 'PM/Admin' }, 'Downloads unlocked by Admin/PM override. Project will be marked as completed once the client initiates a download.');

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Locks project downloads manually (Admin/PM override).
 */
export async function lockProjectDownloads(projectId: string, userId: string) {
    try {
        // Verify user has permission
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { success: false, error: "User not found" };
        }

        const userData = userDoc.data();
        const allowedRoles = ['admin', 'project_manager'];

        if (!allowedRoles.includes(userData?.role)) {
            return { success: false, error: "Unauthorized: Only Admins or Project Managers can lock downloads." };
        }

        await adminDb.collection('projects').doc(projectId).update({
            downloadsUnlocked: false,
            notes: FieldValue.arrayUnion(`Downloads locked by ${userData?.email} (${userData?.role}) at ${new Date().toISOString()}`)
        });

        const { addProjectLog } = await import("./admin-actions");
        await addProjectLog(projectId, 'LOCKED', { uid: userId, displayName: userData?.displayName || 'PM/Admin' }, 'Downloads locked by Admin/PM override.');

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Called by a Pay Later client to request download unlock from their PM.
 * Sets downloadUnlockRequested = true on the project document.
 */
export async function requestDownloadUnlock(projectId: string, userId: string) {
    try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) return { success: false, error: "User not found" };

        const project = await adminDb.collection('projects').doc(projectId).get();
        if (!project.exists) return { success: false, error: "Project not found" };

        const projectData = project.data();

        // Allow any user who is the client, owner, or a member of the project
        const isProjectMember =
            projectData?.clientId === userId ||
            projectData?.ownerId === userId ||
            (Array.isArray(projectData?.members) && projectData.members.includes(userId));

        if (!isProjectMember) {
            return { success: false, error: "Unauthorized: You are not a member of this project." };
        }

        await adminDb.collection('projects').doc(projectId).update({
            downloadUnlockRequested: true,
            updatedAt: Date.now()
        });

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function submitEditorRating(projectId: string, rating: number, review: string) {
    try {
        await adminDb.collection('projects').doc(projectId).update({
            editorRating: rating,
            editorReview: review,
            updatedAt: Date.now()
        });
        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Failed to submit rating", e);
        return { success: false, error: e.message };
    }
}

export async function getSignedDownloadUrl(downloadUrl: string, fileName?: string) {
    try {
        if (!downloadUrl) return { success: false, error: "No URL provided" };
        if (!downloadUrl.includes('firebasestorage.googleapis.com')) {
           return { success: true, url: downloadUrl };
        }

        const pathParts = downloadUrl.split('/o/');
        if (pathParts.length > 1) {
            const encodedPath = pathParts[1].split('?')[0];
            const fullPath = decodeURIComponent(encodedPath);

            const bucket = adminStorage.bucket();
            const file = bucket.file(fullPath);
            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'download';

            const signedUrlResponse = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
                promptSaveAs: safeFileName,
                responseDisposition: `attachment; filename="${safeFileName}"`
            });

            if (Array.isArray(signedUrlResponse) && signedUrlResponse.length > 0) {
                return { success: true, url: signedUrlResponse[0] };
            }
        }
        return { success: false, error: "Failed to generate signed URL from path" };
    } catch (err: any) {
        console.error("Failed to generate signed URL:", err);
        return { success: false, error: err.message };
    }
}

/**
 * 🛠️ MUX HARDENING & REPAIR ACTIONS 🛠️
 */

/**
 * Synchronizes a revision's metadata. 
 * If it has an S3 asset but no Mux playbackId, it triggers ingestion.
 */
export async function syncRevisionMetadata(revisionId: string) {
    console.log(`[syncRevisionMetadata] Hardening revision: ${revisionId}`);
    try {
        const revRef = adminDb.collection('revisions').doc(revisionId);
        const snap = await revRef.get();
        
        if (!snap.exists) return { success: false, error: "Revision not found" };
        
        const data = snap.data() as Revision;
        
        // If we already have playbackId, we're good
        if (data.playbackId) {
            return { success: true, playbackId: data.playbackId, status: "ready" };
        }

        // Try to recover s3Key if missing
        let s3Key = data.s3Key;
        if (!s3Key && data.videoUrl) {
            s3Key = extractS3KeyFromUrl(data.videoUrl, BUCKET_NAME) || undefined;
            if (s3Key) {
                await revRef.update({ s3Key, updatedAt: Date.now() });
                console.log(`[syncRevisionMetadata] Recovered missing s3Key from URL for ${revisionId}`);
            }
        }

        if (!s3Key) {
            return { success: false, error: "No S3 asset found to ingest into Mux" };
        }

        // Generate a fresh presigned URL for Mux to ingest
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        });
        const ingestUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

        // Trigger Mux Ingest
        const passthrough = JSON.stringify({
            pid: data.projectId,
            rid: revisionId,
            t: 'revision',
            s3Key: s3Key
        });

        console.log(`[syncRevisionMetadata] Triggering Mux ingest for ${revisionId}...`);
        try {
            const asset = await video.assets.create({
                input: [{ url: ingestUrl }],
                playback_policy: ['public'],
                passthrough
            } as any);

            // Update revision to show it's processing
            await revRef.update({
                assetId: asset.id,
                status: 'active', // keep active while processing
                updatedAt: Date.now()
            });

            return { 
                success: true, 
                status: "processing", 
                assetId: asset.id 
            };
        } catch (muxErr: any) {
            if (muxErr.message?.includes("Free plan is limited to 10 assets")) {
                console.error(`[syncRevisionMetadata] MUX LIMIT REACHED for ${revisionId}`);
                return { success: false, error: "Mux Free Plan limit reached (10 assets). Please upgrade your Mux account or delete old assets." };
            }
            throw muxErr;
        }

    } catch (error: any) {
        console.error(`[syncRevisionMetadata] Failed for ${revisionId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Repairs all revisions for a project that are missing Mux streams.
 */
export async function repairProjectMuxStreams(projectId: string) {
    try {
        const revsSnap = await adminDb.collection('revisions')
            .where('projectId', '==', projectId)
            .get();
        
        const results = [];
        for (const doc of revsSnap.docs) {
            const rev = doc.data() as Revision;
            if (!rev.playbackId && (rev.videoUrl || rev.s3Key)) {
                const res = await syncRevisionMetadata(doc.id);
                results.push({ id: doc.id, ...res });
            }
        }

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true, repairedCount: results.length, details: results };
    } catch (error: any) {
        console.error(`[repairProjectMuxStreams] Error:`, error);
        return { success: false, error: error.message };
    }
}
