
const { S3Client, ListBucketsCommand, CreateMultipartUploadCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3() {
  try {
    console.log('Testing S3 Connection...');
    const buckets = await s3.send(new ListBucketsCommand({}));
    console.log('Buckets found:', buckets.Buckets.map(b => b.Name));

    const bucketName = process.env.AWS_BUCKET_NAME;
    console.log(`Testing CreateMultipartUpload on bucket: ${bucketName}`);
    
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: `test-${Date.now()}.txt`,
      ContentType: 'text/plain',
    });
    
    const response = await s3.send(command);
    console.log('Multipart upload created successfully. ID:', response.UploadId);
  } catch (err) {
    console.error('S3 Test Failed:', err);
  }
}

testS3();
