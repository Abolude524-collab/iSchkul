const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function testS3Connection() {
  console.log('\n📋 AWS S3 Connection Test\n');
  console.log('='.repeat(60));

  try {
    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      console.log('❌ AWS credentials not configured in .env');
      process.exit(1);
    }

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials,
    });

    console.log('🔍 Testing bucket access...');
    console.log(`📍 Bucket: ${process.env.S3_BUCKET_NAME}`);
    console.log(`📍 Region: ${process.env.AWS_REGION}\n`);

    const command = new HeadBucketCommand({
      Bucket: process.env.S3_BUCKET_NAME,
    });

    await s3Client.send(command);

    console.log('✅ Successfully connected to S3 bucket!');
    console.log('✅ S3 is ready for document storage\n');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ S3 Connection failed:', error.message);
    console.error('\nPossible causes:');
    console.error('  1. Invalid AWS credentials');
    console.error('  2. Bucket does not exist');
    console.error('  3. Region mismatch');
    console.error('  4. Network connectivity issue');
    console.error('  5. IAM permissions issue');
    process.exit(1);
  }
}

testS3Connection();
