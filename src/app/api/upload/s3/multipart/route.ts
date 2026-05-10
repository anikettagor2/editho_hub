import { NextResponse } from 'next/server';
import { 
  S3Client, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  // Enable Transfer Acceleration for lightning fast uploads if enabled on the bucket
  useAccelerateEndpoint: true,
});

export async function POST(req: Request) {
  try {
    const { filename, type, action, uploadId, key, parts } = await req.json();
    const BUCKET_NAME = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;
    
    if (!BUCKET_NAME) {
      throw new Error("AWS_BUCKET_NAME environment variable is not set");
    }

    // 1. Create Multipart Upload
    if (action === 'create') {
      const command = new CreateMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: `uploads/${Date.now()}-${filename}`,
        ContentType: type,
      });
      const response = await s3.send(command);
      return NextResponse.json({
        uploadId: response.UploadId,
        key: response.Key,
      });
    }

    // 2. Complete Multipart Upload
    if (action === 'complete') {
      const command = new CompleteMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p: any) => ({
            ETag: p.ETag,
            PartNumber: p.PartNumber,
          })),
        },
      });
      await s3.send(command);
      
      // Generate a presigned URL valid for 1 hour so Mux can download it securely
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      const s3Url = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
      
      return NextResponse.json({ location: s3Url });
    }

    // 3. Abort Multipart Upload
    if (action === 'abort') {
      const command = new AbortMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
      });
      await s3.send(command);
      return NextResponse.json({ success: true });
    }

    // 4. List Parts
    if (action === 'listParts') {
      const command = new ListPartsCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
      });
      const response = await s3.send(command);
      return NextResponse.json(response.Parts?.map((p: any) => ({
        PartNumber: p.PartNumber,
        Size: p.Size,
        ETag: p.ETag,
      })) || []);
    }

    return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
  } catch (error: any) {
    console.error("POST S3 Multipart Error:", {
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId,
      httpStatusCode: error.$metadata?.httpStatusCode,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: error.message || 'Unknown Error',
      code: error.code,
      requestId: error.$metadata?.requestId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: error.$metadata?.httpStatusCode || 500 });
  }
}

// Sign parts endpoint
export async function PUT(req: Request) {
  try {
    const { uploadId, key, partNumbers } = await req.json();
    const BUCKET_NAME = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

    if (!BUCKET_NAME) {
      throw new Error("AWS_BUCKET_NAME environment variable is not set");
    }

    const presignedUrls: Record<number, string> = {};
    const numbers = Array.isArray(partNumbers) ? partNumbers : [];
    
    if (numbers.length === 0) {
      console.error("No part numbers provided to sign", { uploadId, key, partNumbers });
    }

    await Promise.all(
      numbers.map(async (partNumber: number) => {
        const command = new UploadPartCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        presignedUrls[partNumber] = url;
      })
    );

    return NextResponse.json({ presignedUrls });
  } catch (error) {
    console.error("S3 Sign Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
