import { S3Client } from "@aws-sdk/client-s3";

const isAccelerateEnabled = process.env.ENABLE_S3_ACCELERATE === 'true';

if (isAccelerateEnabled) {
  console.log("🚀 [S3] Transfer Acceleration is ENABLED. Routing via AWS Global Edge Network.");
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  useAccelerateEndpoint: isAccelerateEnabled,
});

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;
