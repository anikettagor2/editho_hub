import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";
import { s3Client as s3, BUCKET_NAME } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const fileName = searchParams.get("filename");
    
    return handleDownload(url, fileName);
}

export async function POST(req: NextRequest) {
    try {
        const { url, fileName } = await req.json();
        return handleDownload(url, fileName);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
}

async function handleDownload(url: string | null, fileName: string | null) {
    console.log('[API Download] Processing download request:', { url, fileName });

    if (!url) {
        console.log('[API Download] No URL provided');
        return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    try {
        // 1. Handle S3 URLs
        if (url.includes(".amazonaws.com/") || (BUCKET_NAME && url.includes(BUCKET_NAME))) {
            console.log('[API Download] Handling S3 URL');
            
            let key = "";
            try {
                const s3Url = new URL(url);
                key = decodeURIComponent(s3Url.pathname.substring(1));
            } catch (e) {
                // Fallback for cases where it might be a relative path or key
                key = url.includes('.com/') ? url.split('.com/')[1] : url;
            }

            if (!BUCKET_NAME) {
                throw new Error("AWS_BUCKET_NAME not configured");
            }

            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            const response = await s3.send(command);
            const stream = response.Body as any;

            if (!stream) {
                throw new Error("Failed to get stream from S3");
            }

            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "video.mp4";

            const headers = new Headers();
            headers.set('Content-Type', response.ContentType || 'video/mp4');
            headers.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
            if (response.ContentLength) {
                headers.set('Content-Length', response.ContentLength.toString());
            }
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

            return new NextResponse(stream, {
                status: 200,
                headers,
            });
        }

        // 2. Handle Firebase Storage URLs
        if (url.includes("firebasestorage.googleapis.com")) {
            const pathParts = url.split("/o/");
            if (pathParts.length > 1) {
                const encodedPath = pathParts[1].split("?")[0];
                const fullPath = decodeURIComponent(encodedPath);
                console.log('[API Download] Extracted Firebase path:', fullPath);

                const file = adminStorage.bucket().file(fullPath);
                const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "video.mp4";

                const [metadata] = await file.getMetadata().catch(() => [{}]);
                const contentType = (metadata as any)?.contentType || 'video/mp4';

                const [signedUrl] = await file.getSignedUrl({
                    version: "v4",
                    action: "read",
                    expires: Date.now() + 60 * 60 * 1000,
                });

                const response = await fetch(signedUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status}`);
                }

                const headers = new Headers();
                headers.set('Content-Type', contentType);
                headers.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
                if (response.headers.get('Content-Length')) {
                    headers.set('Content-Length', response.headers.get('Content-Length')!);
                }
                headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

                return new NextResponse(response.body, {
                    status: 200,
                    headers,
                });
            }
        }

        // 3. Fallback: Direct Fetch (for Mux or other URLs)
        console.log('[API Download] Falling back to direct fetch');
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "video.mp4";
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
        headers.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
        if (response.headers.get('Content-Length')) {
            headers.set('Content-Length', response.headers.get('Content-Length')!);
        }

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (err: any) {
        console.error('[API Download] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
