const admin = require("firebase-admin");
const Mux = require("@mux/mux-node");
const dotenv = require("dotenv");
const path = require("path");

// Load local env if exists
dotenv.config({ path: path.join(__dirname, ".env.local") });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_S3_BUCKET_NAME || "editohub-uploads";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
});

function extractS3KeyFromUrl(url, bucketName) {
    if (!url || !bucketName) return null;
    if (!url.includes(".s3.") && !url.includes("amazonaws.com")) return null;

    try {
        if (url.includes(`/${bucketName}/`)) {
            const parts = url.split(`/${bucketName}/`);
            if (parts.length > 1) return parts[1].split("?")[0];
        }
        const urlObj = new URL(url);
        if (urlObj.hostname.startsWith(`${bucketName}.`)) {
            return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1).split("?")[0] : urlObj.pathname.split("?")[0];
        }
        if (urlObj.hostname.includes(bucketName)) {
            return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1).split("?")[0] : urlObj.pathname.split("?")[0];
        }
    } catch (e) {
        return null;
    }
    return null;
}

async function auditAndRepair() {
    console.log("🚀 Starting EditoHub Audit & Repair...");
    const revisionsSnap = await db.collection("revisions").get();

    let total = 0;
    let repairedKeys = 0;
    let missingMux = 0;
    let emptyRevisions = 0;

    for (const doc of revisionsSnap.docs) {
        total++;
        const data = doc.data();
        const id = doc.id;
        let needsUpdate = false;
        const updateData = { updatedAt: Date.now() };

        // 1. Repair missing s3Key from videoUrl
        if (!data.s3Key && data.videoUrl) {
            const key = extractS3KeyFromUrl(data.videoUrl, BUCKET_NAME);
            if (key) {
                console.log(`[FIX] Recovered s3Key for ${id}: ${key}`);
                updateData.s3Key = key;
                data.s3Key = key; // Update local copy for next checks
                needsUpdate = true;
                repairedKeys++;
            }
        }

        // 2. Identify missing playbackId
        if (!data.playbackId && (data.s3Key || data.videoUrl)) {
            missingMux++;
            console.log(`[WARN] Missing playbackId for ${id}. (Has S3 asset)`);
        }

        // 3. Identify completely empty revisions
        if (!data.videoUrl && !data.s3Key && !data.playbackId && !data.assetId) {
            emptyRevisions++;
            console.log(`[CRITICAL] Revision ${id} is EMPTY (No file reference)`);
        }

        // 4. Try to recover s3Key from Mux Asset if we have assetId
        if (!data.s3Key && data.assetId && mux.tokenId) {
            try {
                const asset = await mux.video.assets.retrieve(data.assetId);
                if (asset.passthrough) {
                    const pt = JSON.parse(asset.passthrough);
                    if (pt.s3Key) {
                        console.log(`[FIX] Recovered s3Key from Mux metadata for ${id}: ${pt.s3Key}`);
                        updateData.s3Key = pt.s3Key;
                        data.s3Key = pt.s3Key;
                        needsUpdate = true;
                        repairedKeys++;
                    }
                }
            } catch (e) {
                // Asset might be deleted
            }
        }

        // 5. ACTIVE REPAIR: Trigger Mux ingestion if S3 exists but no PlaybackId
        // Limit to 10 repairs per run for safety
        if (!data.playbackId && data.s3Key && repairedKeys < 10) {
            try {
                console.log(`[REPAIR] Triggering Mux ingest for ${id}...`);
                const { GetObjectCommand } = require("@aws-sdk/client-s3");
                const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
                const { S3Client } = require("@aws-sdk/client-s3");

                const s3 = new S3Client({
                    region: process.env.AWS_REGION || "us-east-1",
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    }
                });

                const getCommand = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: data.s3Key,
                });
                const ingestUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

                const asset = await mux.video.assets.create({
                    input: [{ url: ingestUrl }],
                    playback_policy: ['public'],
                    passthrough: JSON.stringify({
                        pid: data.projectId,
                        rid: id,
                        t: 'revision',
                        s3Key: data.s3Key
                    })
                });

                updateData.assetId = asset.id;
                updateData.status = 'active';
                needsUpdate = true;
                console.log(`[REPAIR] Ingest started for ${id}. AssetID: ${asset.id}`);
            } catch (e) {
                console.error(`[REPAIR] Failed for ${id}:`, e.message);
            }
        }

        if (needsUpdate) {
            await doc.ref.update(updateData);
        }
    }

    console.log("\n--- Audit Summary ---");
    console.log(`Total Revisions: ${total}`);
    console.log(`Repaired S3 Keys: ${repairedKeys}`);
    console.log(`Missing Mux Streams: ${missingMux}`);
    console.log(`Empty Revisions: ${emptyRevisions}`);
    console.log("----------------------\n");
}

auditAndRepair().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
