import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { purgeProjectAssets, purgeProjectRevisionVideos } from '@/app/actions/project-actions';
import { Project } from '@/types/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log("[Cron Purge] Starting asset purge sweep...");
    try {
        const now = Date.now();
        
        // Find all projects where cleanup is due (24h after client download)
        // Note: assetsCleanupAfter is set strictly at registerDownload to (downloadedAt + 24 hours)
        const dueSnap = await adminDb
            .collection("projects")
            .where("assetsCleanupAfter", "<=", now)
            .get();

        if (dueSnap.empty) {
            console.log("[Cron Purge] No projects due for asset purging.");
            return NextResponse.json({
                success: true,
                message: "No projects due for asset purging.",
                processedCount: 0,
                purgedCount: 0
            });
        }

        console.log(`[Cron Purge] Found ${dueSnap.docs.length} candidate projects for purging.`);

        let purgedCount = 0;

        for (const projectDoc of dueSnap.docs) {
            const projectId = projectDoc.id;
            const projectData = projectDoc.data() as Project;

            let updated = false;

            // 1. Purge raw files, scripts, audio, reference, and bRole files from Cloud Storage (S3/Firebase Storage)
            if (!projectData.assetsPurgedAt) {
                try {
                    console.log(`[Cron Purge] Purging project assets (raw files, reference files, audio, scripts) for project ${projectId}`);
                    await purgeProjectAssets(projectId, projectData);
                    updated = true;
                } catch (assetsErr) {
                    console.error(`[Cron Purge] Failed to purge project assets for project ${projectId}:`, assetsErr);
                }
            }

            // 2. Purge revision/draft videos from Cloud Storage, thumbnails, HLS folders, and Mux storage assets
            if (!projectData.finalVideoPurged) {
                try {
                    console.log(`[Cron Purge] Purging revision drafts and Mux assets for project ${projectId}`);
                    await purgeProjectRevisionVideos(projectId);
                    updated = true;
                } catch (revErr) {
                    console.error(`[Cron Purge] Failed to purge revisions for project ${projectId}:`, revErr);
                }
            }

            if (updated) {
                purgedCount++;
            }
        }

        console.log(`[Cron Purge] Completed asset purge sweep. Processed: ${dueSnap.docs.length}, Purged: ${purgedCount}`);

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${dueSnap.docs.length} projects. Purged assets/videos for ${purgedCount} projects.`,
            processedCount: dueSnap.docs.length,
            purgedCount
        });
    } catch (error: any) {
        console.error("[Cron Purge] Critical error running asset purge cron:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
