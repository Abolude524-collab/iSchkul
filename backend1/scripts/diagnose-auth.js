#!/usr/bin/env node

/**
 * Authentication Diagnostic Script
 * Helps identify JWT token and auth middleware issues
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('\n🔐 === AUTHENTICATION DIAGNOSTICS ===\n');

// 1. Check JWT_SECRET
console.log('1️⃣ JWT_SECRET Configuration:');
if (!process.env.JWT_SECRET) {
  console.log('   ❌ JWT_SECRET is NOT set in environment variables');
  console.log('   🔧 Add JWT_SECRET to .env file');
} else {
  console.log('   ✅ JWT_SECRET is configured');
  console.log('   📏 Length:', process.env.JWT_SECRET.length);
}

// 2. Test token generation
console.log('\n2️⃣ Token Generation Test:');
const testUserId = 'test-user-id-12345';
const testEmail = 'test@example.com';

try {
  const testToken = jwt.sign(
    { id: testUserId, email: testEmail },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' }
  );
  
  console.log('   ✅ Token generated successfully');
  console.log('   📝 Token:', testToken);
  console.log('   📏 Length:', testToken.length);
  console.log('   ✓ Starts with "eyJ":', testToken.startsWith('eyJ'));
  
  // 3. Test token verification
  console.log('\n3️⃣ Token Verification Test:');
  try {
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET || 'default-secret');
    console.log('   ✅ Token verified successfully');
    console.log('   👤 Decoded user ID:', decoded.id);
    console.log('   ✉️  Decoded email:', decoded.email);
  } catch (err) {
    console.log('   ❌ Token verification failed:', err.message);
  }
} catch (err) {
  console.log('   ❌ Token generation failed:', err.message);
}

// 4. Check token extraction logic
console.log('\n4️⃣ Token Extraction Logic Test:');
const testAuthHeaders = [
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTc2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  'Bearer  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTc2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // extra space
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTc2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c\n', // newline
];

testAuthHeaders.forEach((header, idx) => {
  console.log(`\n   Test ${idx + 1}:`);
  console.log('   📥 Header:', JSON.stringify(header));
  
  // Old extraction method
  const oldExtracted = header.replace('Bearer ', '');
  console.log('   🔧 Old method result:', JSON.stringify(oldExtracted));
  console.log('   ✓ Valid JWT format:', oldExtracted.startsWith('eyJ'));
  
  // New extraction method
  const newExtracted = header.replace(/^Bearer\s+/i, '').trim();
  console.log('   🔧 New method result:', JSON.stringify(newExtracted));
  console.log('   ✓ Valid JWT format:', newExtracted.startsWith('eyJ'));
});

// 5. Check MongoDB connection
console.log('\n5️⃣ MongoDB Connection:');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul';
console.log('   📍 Connection string:', mongoUri.includes('password') ? '***' : mongoUri);

const mongoose = require('mongoose');
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('   ✅ MongoDB connected successfully');
  const User = require('../models/User');
  return User.findOne();
}).then((user) => {
  if (user) {
    console.log('   ✅ Sample user found:', user.email);
  } else {
    console.log('   ⚠️  No users found in database');
  }
  process.exit(0);
}).catch((err) => {
  console.log('   ❌ MongoDB connection failed:', err.message);
  console.log('   🔧 Make sure MongoDB is running: mongosh mongodb://localhost:27017');
  process.exit(1);
});

console.log('\n⏳ Running diagnostics...\n');
