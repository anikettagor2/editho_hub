import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { BUCKET_NAME, s3Client as s3 } from "@/lib/s3";

function decodeProxyKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== "/api/storage/s3") return null;
    return parsed.searchParams.get("key");
  } catch {
    return null;
  }
}

function parseS3KeyFromUrl(url: string): string | null {
  if (!url) return null;
  const proxyKey = decodeProxyKey(url);
  if (proxyKey) return proxyKey;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("amazonaws.com") && !parsed.hostname.includes(".s3.")) {
      return null;
    }

    if (BUCKET_NAME && parsed.hostname.startsWith(`${BUCKET_NAME}.`)) {
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    }

    if (BUCKET_NAME && parsed.pathname.includes(`/${BUCKET_NAME}/`)) {
      return decodeURIComponent(parsed.pathname.split(`/${BUCKET_NAME}/`)[1]?.split("?")[0] || "");
    }

    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    if (!BUCKET_NAME) {
      return NextResponse.json({ success: false, error: "AWS bucket is not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const name = url.searchParams.get("name") || "download";
    const download = url.searchParams.get("download") === "1";

    if (!key) {
      return NextResponse.json({ success: false, error: "Missing S3 key" }, { status: 400 });
    }

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="${name.replace(/"/g, "")}"`,
      }),
      { expiresIn: 3600 }
    );

    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error("[storage/s3] Failed to sign object:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load file" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!BUCKET_NAME) {
      return NextResponse.json({ success: false, error: "AWS bucket is not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const key = body?.key || parseS3KeyFromUrl(body?.url || "");

    if (!key) {
      return NextResponse.json({ success: false, error: "Missing S3 key" }, { status: 400 });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[storage/s3] Failed to delete object:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to delete file" }, { status: 500 });
  }
}
