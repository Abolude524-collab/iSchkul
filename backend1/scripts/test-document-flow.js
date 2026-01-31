#!/usr/bin/env node

/**
 * Complete Auth & Document Flow Tester
 * Tests: Login → Token retrieval → Document fetch → Proxy access
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000';
const TEST_EMAIL = 'admin@ischkul.com';
const TEST_PASSWORD = 'admin123';

let testToken = '';
let documentId = '';

console.log('\n📋 === COMPLETE AUTH & DOCUMENT FLOW TEST ===\n');

async function test() {
  try {
    // 1. Login and get token
    console.log('1️⃣ Testing Login...');
    let response = await axios.post(`${API_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    testToken = response.data.token;
    console.log('   ✅ Login successful');
    console.log('   📝 Token:', testToken.substring(0, 30) + '...');
    console.log('   📏 Token length:', testToken.length);
    
    // 2. Get user info to verify auth works
    console.log('\n2️⃣ Testing GET /api/users/me (auth verification)...');
    response = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    
    console.log('   ✅ Auth verified');
    console.log('   👤 User:', response.data.email);
    console.log('   🆔 User ID:', response.data._id);
    
    // 3. Get list of documents
    console.log('\n3️⃣ Testing GET /api/documents (list documents)...');
    response = await axios.get(`${API_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    
    if (response.data.length === 0) {
      console.log('   ⚠️  No documents found. Upload one first:');
      console.log('   📝 Use POST /api/documents/upload to upload a PDF');
      process.exit(0);
    }
    
    documentId = response.data[0]._id;
    console.log('   ✅ Document list retrieved');
    console.log('   📚 Found', response.data.length, 'document(s)');
    console.log('   🆔 First document ID:', documentId);
    
    // 4. Get document metadata
    console.log('\n4️⃣ Testing GET /api/documents/:id (fetch metadata)...');
    response = await axios.get(`${API_URL}/api/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    
    console.log('   ✅ Document metadata retrieved');
    console.log('   📄 Document:', response.data.filename || response.data.title);
    console.log('   💾 File URL:', response.data.fileUrl);
    console.log('   📊 Pages:', response.data.pages);
    
    // 5. Get document content (proxy)
    console.log('\n5️⃣ Testing GET /api/documents/:id/content (proxy access)...');
    response = await axios.get(`${API_URL}/api/documents/${documentId}/content`, {
      headers: { Authorization: `Bearer ${testToken}` },
      maxRedirects: 5
    });
    
    console.log('   ✅ Document content proxy successful');
    console.log('   📦 Content type:', response.headers['content-type']);
    console.log('   📏 Content size:', response.data.length, 'bytes');
    console.log('   ✓ Valid PDF:', response.data.substring(0, 4) === '%PDF');
    
    console.log('\n✅ === ALL TESTS PASSED ===\n');
    console.log('📊 Summary:');
    console.log('   ✓ Login works');
    console.log('   ✓ JWT authentication works');
    console.log('   ✓ Document listing works');
    console.log('   ✓ Document metadata retrieval works');
    console.log('   ✓ Document proxy service works');
    console.log('\n🎉 Complete document flow is operational!\n');
    
  } catch (error) {
    if (error.response) {
      console.error('\n❌ API Error:');
      console.error('   📍 Endpoint:', error.config.url);
      console.error('   🔴 Status:', error.response.status);
      console.error('   📝 Message:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n💡 This is a 401 Unauthorized error. Check:');
        console.error('   1. Is token stored correctly in localStorage?');
        console.error('   2. Is token format valid (starts with "eyJ")?');
        console.error('   3. Is JWT_SECRET configured in backend .env?');
        console.error('   4. Is MongoDB running?');
        console.error('\n📚 See 401-TROUBLESHOOTING.md for detailed diagnostics');
      }
    } else {
      console.error('\n❌ Connection Error:');
      console.error('   📍 Cannot connect to backend at', API_URL);
      console.error('   🔧 Make sure backend is running: npm run dev');
      console.error('   💡 Error:', error.message);
    }
    process.exit(1);
  }
}

test();
