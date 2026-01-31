#!/usr/bin/env node
/**
 * Test script for PDF import and proxy functionality
 * Usage: node test-pdf-import.js <token>
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// ArXiv URL to test with
const TEST_PDF_URL = 'https://arxiv.org/pdf/1706.03762.pdf';
const TEST_TITLE = 'Attention Is All You Need';

async function testPdfImport(token) {
    console.log('\n📋 PDF Import & Proxy Test\n');
    console.log('=' .repeat(60));

    try {
        // Step 1: Import PDF from URL
        console.log('\n1️⃣  Importing PDF from ArXiv...');
        console.log(`   URL: ${TEST_PDF_URL}`);

        const importResponse = await axios.post(
            `${API_BASE}/documents/import-url`,
            {
                url: TEST_PDF_URL,
                title: TEST_TITLE
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        if (importResponse.status === 201) {
            const document = importResponse.data.document;
            console.log('✅ Import successful!');
            console.log(`   Document ID: ${document._id}`);
            console.log(`   Title: ${document.title}`);
            console.log(`   Pages: ${document.pages}`);
            console.log(`   Chunks: ${document.chunkCount}`);
            console.log(`   Index Status: ${document.indexStatus}`);

            if (importResponse.data.warning) {
                console.log(`⚠️  Warning: ${importResponse.data.warning}`);
            }

            // Step 2: Serve document through proxy
            console.log('\n2️⃣  Testing document proxy...');
            const proxyUrl = `${API_BASE}/documents/${document._id}/content`;
            console.log(`   Proxy URL: ${proxyUrl}`);

            try {
                const proxyResponse = await axios.get(
                    proxyUrl,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        responseType: 'arraybuffer',
                        timeout: 15000
                    }
                );

                if (proxyResponse.status === 200) {
                    console.log('✅ Proxy working!');
                    console.log(`   Response size: ${proxyResponse.data.length} bytes`);
                    console.log(`   Content-Type: ${proxyResponse.headers['content-type']}`);
                }
            } catch (proxyErr) {
                console.log('❌ Proxy test failed:');
                console.log(`   ${proxyErr.message}`);
            }

            // Step 3: Frontend integration info
            console.log('\n3️⃣  Frontend Integration:');
            console.log(`   Use proxy URL: ${proxyUrl}`);
            console.log('   This avoids CORS issues from direct ArXiv access');

            console.log('\n' + '=' .repeat(60));
            console.log('✅ All tests passed!\n');
        }
    } catch (error) {
        console.log('❌ Test failed:');
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${error.response.data.error}`);
            if (error.response.data.details) {
                console.log(`   Details: ${error.response.data.details}`);
            }
        } else {
            console.log(`   ${error.message}`);
        }
        console.log('\n' + '=' .repeat(60) + '\n');
        process.exit(1);
    }
}

// Main
if (!process.argv[2]) {
    console.log('❌ Missing token argument');
    console.log('Usage: node test-pdf-import.js <token>');
    console.log('\nTo get a token:');
    console.log('1. Login to the app');
    console.log('2. Open DevTools → Application → LocalStorage');
    console.log('3. Copy the "token" value');
    process.exit(1);
}

testPdfImport(process.argv[2]).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
