const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('\n📋 Local Storage Configuration Test\n');
console.log('='.repeat(50));

// Check upload directory
const uploadDir = path.join(__dirname, 'uploads', 'documents');
console.log(`\n✓ Checking upload directory: ${uploadDir}`);

if (!fs.existsSync(uploadDir)) {
  console.log('  ⚠️  Directory does not exist. Creating...');
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('  ✅ Directory created');
} else {
  console.log('  ✅ Directory exists');
  
  // List files in directory
  const files = fs.readdirSync(uploadDir);
  console.log(`  📁 Files in directory: ${files.length}`);
  if (files.length > 0) {
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`    - ${file} (${sizeKB} KB)`);
    });
  }
}

// Check AWS configuration
console.log(`\n✓ Checking AWS Configuration:`);
const hasAwsKey = !!process.env.AWS_ACCESS_KEY_ID;
const hasAwsSecret = !!process.env.AWS_SECRET_ACCESS_KEY;

if (hasAwsKey && hasAwsSecret) {
  console.log('  ✅ AWS credentials found - will use S3');
  console.log(`  📍 Bucket: ${process.env.S3_BUCKET_NAME || 'not set'}`);
  console.log(`  📍 Region: ${process.env.AWS_REGION || 'us-east-1'}`);
} else {
  console.log('  ⚠️  AWS credentials NOT found - will use local storage');
  console.log('  📍 Files will be stored in: ' + uploadDir);
}

console.log('\n' + '='.repeat(50));
console.log('\n✅ Local storage test complete!\n');
