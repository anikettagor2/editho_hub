import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client as s3, BUCKET_NAME } from "@/lib/s3";

const MAX_COMMENT_ATTACHMENT_SIZE = 20 * 1024 * 1024;

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "file";
}

function toS3ObjectUrl(bucket: string, key: string): string {
  const region = process.env.AWS_REGION || "us-east-1";
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function POST(req: Request) {
  try {
    if (!BUCKET_NAME) {
      return NextResponse.json({ success: false, error: "AWS bucket is not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const projectId = String(formData.get("projectId") || "");
    const revisionId = String(formData.get("revisionId") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!projectId || !revisionId) {
      return NextResponse.json({ success: false, error: "Missing project or revision id" }, { status: 400 });
    }

    if (file.size > MAX_COMMENT_ATTACHMENT_SIZE) {
      return NextResponse.json({ success: false, error: "File size must be less than 20MB" }, { status: 400 });
    }

    const safeProjectId = sanitizePathPart(projectId);
    const safeRevisionId = sanitizePathPart(revisionId);
    const safeFileName = sanitizePathPart(file.name);
    const key = `comments/${safeProjectId}/${safeRevisionId}/${Date.now()}_${crypto.randomUUID()}_${safeFileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
      ContentLength: file.size,
      Metadata: {
        originalName: encodeURIComponent(file.name),
        projectId: safeProjectId,
        revisionId: safeRevisionId,
      },
    }));

    return NextResponse.json({
      success: true,
      url: toS3ObjectUrl(BUCKET_NAME, key),
      bucket: BUCKET_NAME,
      key,
    });
  } catch (error: any) {
    console.error("[comments/attachments] Upload failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload comment attachment" },
      { status: 500 }
    );
  }
}
