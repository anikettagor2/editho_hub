import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { handleNewComment } from '@/app/actions/notification-actions';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            projectId,
            revisionId,
            userId,
            userName,
            userRole,
            content,
            timestamp
        } = body;

        if (!projectId || !revisionId || !content?.trim()) {
            return NextResponse.json({ error: 'Missing required fields or empty content' }, { status: 400 });
        }

        const newCommentPayload = {
            projectId,
            revisionId,
            userId,
            userName,
            userRole,
            content: content.trim(),
            imageUrl: null,
            attachmentUrl: null,
            attachmentName: null,
            attachmentType: null,
            attachmentSize: null,
            timestamp: timestamp || 0,
            createdAt: Date.now(),
            status: "open",
            replies: [],
            isDirectConnection: false,
            notificationSubmitted: false, // will be updated by handleNewComment
        };

        // Add doc using Admin SDK
        const commentRef = await adminDb.collection("comments").add(newCommentPayload);

        // Send WhatsApp notification immediately
        const res = await handleNewComment(
            projectId,
            userId,
            userName,
            userRole === "guest" ? "client" : (userRole || "guest"),
            content.trim(),
            revisionId,
            commentRef.id
        );

        if (!res.success) {
            console.error("[AutoSave] handleNewComment failed:", res.error);
            return NextResponse.json({ success: true, warning: 'WhatsApp notification failed: ' + res.error }, { status: 200 });
        }

        return NextResponse.json({ success: true, commentId: commentRef.id });
    } catch (error: any) {
        console.error("Error in auto-save API route:", error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
