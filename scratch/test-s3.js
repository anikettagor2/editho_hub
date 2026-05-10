
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: './.env.local' });

async function testS3() {
  console.log('Testing S3 with:', {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.substring(0, 5) + '...',
    bucket: process.env.AWS_BUCKET_NAME
  });

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const response = await s3.send(new ListBucketsCommand({}));
    console.log('Success! Buckets:', response.Buckets.map(b => b.Name));
  } catch (error) {
    console.error('S3 Test Failed:', error.message);
  }
}

testS3();
