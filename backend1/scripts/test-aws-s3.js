const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function testAWSS3() {
  console.log('\n📋 AWS S3 Configuration Test\n');
  console.log('=' .repeat(50));

  // Check if credentials are set
  const credentials = {
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY,
    'AWS_REGION': process.env.AWS_REGION || 'us-east-1',
    'S3_BUCKET_NAME': process.env.S3_BUCKET_NAME
  };

  console.log('\n✓ Checking credentials in .env:');
  for (const [key, value] of Object.entries(credentials)) {
    if (value) {
      const masked = value.length > 10 ? value.substring(0, 10) + '...' : value;
      console.log(`  ✅ ${key}: ${masked}`);
    } else {
      console.log(`  ❌ ${key}: NOT SET`);
    }
  }

  // Validate all credentials are present
  if (!credentials.AWS_ACCESS_KEY_ID || !credentials.AWS_SECRET_ACCESS_KEY || !credentials.S3_BUCKET_NAME) {
    console.log('\n❌ Missing required AWS credentials in .env file');
    console.log('\nRequired variables:');
    console.log('  - AWS_ACCESS_KEY_ID');
    console.log('  - AWS_SECRET_ACCESS_KEY');
    console.log('  - S3_BUCKET_NAME');
    console.log('  - AWS_REGION (optional, defaults to us-east-1)');
    process.exit(1);
  }

  console.log('\n✓ All credentials present. Attempting connection...\n');

  try {
    // Create S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    console.log('🔗 S3 Client created successfully\n');

    // Test: Upload a test file
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = `AWS S3 Connection Test\nTimestamp: ${new Date().toISOString()}\nThis is a test file to verify S3 upload functionality.`;

    console.log(`📤 Uploading test file: ${testFileName}`);
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testFileName,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const uploadResult = await s3Client.send(uploadCommand);
    console.log(`✅ Upload successful!`);
    console.log(`   ETag: ${uploadResult.ETag}`);
    console.log(`   Location: https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${testFileName}\n`);

    // Test: Read the file back
    console.log(`📥 Reading test file back from S3...`);
    
    const getCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testFileName,
    });

    const getResult = await s3Client.send(getCommand);
    const body = await getResult.Body.transformToString();
    console.log(`✅ Read successful!`);
    console.log(`   Content: ${body.substring(0, 50)}...\n`);

    // Test: Delete the test file
    console.log(`🗑️  Cleaning up - deleting test file...`);
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testFileName,
    });

    await s3Client.send(deleteCommand);
    console.log(`✅ Deletion successful!\n`);

    console.log('=' .repeat(50));
    console.log('\n✅ AWS S3 Connection Test PASSED!\n');
    console.log('Summary:');
    console.log(`  ✓ Credentials validated`);
    console.log(`  ✓ S3 client created`);
    console.log(`  ✓ File upload successful`);
    console.log(`  ✓ File read successful`);
    console.log(`  ✓ File cleanup successful`);
    console.log(`\nYour AWS S3 setup is working correctly! 🎉\n`);

  } catch (error) {
    console.log('=' .repeat(50));
    console.log('\n❌ AWS S3 Connection Test FAILED!\n');
    console.log('Error Details:');
    console.log(`  Type: ${error.name}`);
    console.log(`  Message: ${error.message}\n`);

    if (error.message.includes('InvalidAccessKeyId')) {
      console.log('💡 Suggestion: Your AWS_ACCESS_KEY_ID is invalid.');
      console.log('   Check that you copied it correctly from AWS IAM console.');
    } else if (error.message.includes('InvalidSecretAccessKey')) {
      console.log('💡 Suggestion: Your AWS_SECRET_ACCESS_KEY is invalid.');
      console.log('   Check that you copied it correctly from AWS IAM console.');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('💡 Suggestion: The S3_BUCKET_NAME does not exist or you don\'t have access to it.');
      console.log('   Create a new bucket in AWS S3 console or check the bucket name.');
    } else if (error.message.includes('AccessDenied')) {
      console.log('💡 Suggestion: Your IAM user doesn\'t have S3 permissions.');
      console.log('   Go to AWS IAM → Policies → Attach policy like "AmazonS3FullAccess" to your user.');
    } else {
      console.log('💡 Common issues:');
      console.log('   1. AWS credentials are invalid');
      console.log('   2. S3 bucket doesn\'t exist');
      console.log('   3. IAM user doesn\'t have S3 permissions');
      console.log('   4. Network connectivity issue');
    }

    console.log('\n📖 How to fix:');
    console.log('   1. Verify credentials: https://console.aws.amazon.com/iam/');
    console.log('   2. Create S3 bucket: https://console.aws.amazon.com/s3/');
    console.log('   3. Check IAM permissions for S3 access');
    console.log('   4. Update .env file with correct values\n');

    process.exit(1);
  }
}

// Run the test
testAWSS3().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
