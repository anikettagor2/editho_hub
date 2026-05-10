import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
    request: NextRequest,
    { params }: { params: any }
) {
    try {
        const resolvedParams = await params;
        const uploadId = resolvedParams.uploadId;

        if (!uploadId) {
            return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
        }

        // We track jobs in the 'video_jobs' collection, keyed by either Mux Upload ID or our Revision ID
        const jobRef = adminDb.collection("video_jobs").doc(uploadId);
        const jobSnap = await jobRef.get();

        if (!jobSnap.exists) {
            return NextResponse.json({ status: "waiting" });
        }

        const jobData = jobSnap.data();

        return NextResponse.json({
            status: jobData?.status || "pending",
            playbackId: jobData?.playbackId || null,
            hlsUrl: jobData?.hlsUrl || null,
            error: jobData?.error || null
        });

    } catch (error: unknown) {
        console.error("[API Status] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
