import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { BUCKET_NAME, s3Client as s3 } from "@/lib/s3";

const MAX_OBJECT_UPLOAD_SIZE = 100 * 1024 * 1024;

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "file";
}

function buildStorageUrl(req: Request, key: string, name: string): string {
  const origin = new URL(req.url).origin;
  const params = new URLSearchParams({ key, name });
  return `${origin}/api/storage/s3?${params.toString()}`;
}

export async function POST(req: Request) {
  try {
    if (!BUCKET_NAME) {
      return NextResponse.json({ success: false, error: "AWS bucket is not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = sanitizePathPart(String(formData.get("folder") || "uploads"));
    const ownerId = sanitizePathPart(String(formData.get("ownerId") || "shared"));

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_OBJECT_UPLOAD_SIZE) {
      return NextResponse.json({ success: false, error: "File size must be less than 100MB" }, { status: 400 });
    }

    const safeFileName = sanitizePathPart(file.name);
    const key = `${folder}/${ownerId}/${Date.now()}_${crypto.randomUUID()}_${safeFileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
      ContentLength: file.size,
      Metadata: {
        originalName: encodeURIComponent(file.name),
        ownerId,
      },
    }));

    return NextResponse.json({
      success: true,
      url: buildStorageUrl(req, key, file.name),
      key,
      bucket: BUCKET_NAME,
    });
  } catch (error: any) {
    console.error("[upload/s3/object] Upload failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
