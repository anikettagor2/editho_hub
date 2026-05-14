import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature');
        const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;

        // Verify signature if secret is provided
        if (secret && signature) {
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');

            if (expectedSignature !== signature) {
                console.error('[RazorpayX Webhook] Signature verification failed');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
            }
        } else if (secret && !signature) {
            console.error('[RazorpayX Webhook] Missing signature header');
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        const event = JSON.parse(rawBody);
        const { event: eventType, payload } = event;

        console.log(`[RazorpayX Webhook] Received event: ${eventType}`);

        // Handle Payout Events
        if (eventType.startsWith('payout.')) {
            const payout = payload.payout.entity;
            const projectId = payout.reference_id;
            const status = payout.status; // processed, failed, reversed, cancelled, etc.
            const payoutId = payout.id;

            if (projectId) {
                const projectRef = adminDb.collection('projects').doc(projectId);
                const projectDoc = await projectRef.get();

                if (projectDoc.exists) {
                    await projectRef.update({
                        payoutStatus: status,
                        payoutUpdatedAt: Date.now(),
                        // If it's reversed or failed, we might want to allow re-triggering
                        editorPaid: status === 'processed', 
                    });

                    console.log(`[RazorpayX Webhook] Updated project ${projectId} (Payout ID: ${payoutId}) status to ${status}`);
                } else {
                    console.warn(`[RazorpayX Webhook] Project ${projectId} not found in Firestore`);
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('[RazorpayX Webhook] Error processing webhook:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
