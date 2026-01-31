#!/usr/bin/env node
/**
 * Get JWT token for testing
 * Usage: node get-token.js [email] [password]
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const DEFAULT_EMAIL = 'admin@ischkul.com';
const DEFAULT_PASSWORD = 'admin123';

async function getToken(email, password) {
    console.log('\n🔐 Getting JWT Token\n');
    console.log('=' .repeat(60));

    try {
        console.log(`Logging in as: ${email}`);

        const response = await axios.post(`${API_BASE}/auth/login`, {
            email,
            password
        });

        if (response.status === 200 && response.data.token) {
            const token = response.data.token;
            console.log('\n✅ Login successful!\n');
            console.log('Token:');
            console.log(token);
            console.log('\n' + '=' .repeat(60));
            console.log('\nUsage in test script:');
            console.log(`  node test-pdf-import.js "${token}"\n`);
            console.log('Or add to browser localStorage:');
            console.log(`  localStorage.setItem('token', '${token}')\n`);
            console.log('=' .repeat(60) + '\n');
            
            return token;
        }
    } catch (error) {
        console.log('❌ Login failed:');
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${error.response.data.error || error.response.data}`);
        } else {
            console.log(`   ${error.message}`);
        }
        console.log('\nMake sure:');
        console.log('  1. Backend is running: node backend1/server.js');
        console.log('  2. MongoDB is running');
        console.log('  3. Email/password are correct\n');
        process.exit(1);
    }
}

// Get credentials from args or use defaults
const email = process.argv[2] || DEFAULT_EMAIL;
const password = process.argv[3] || DEFAULT_PASSWORD;

getToken(email, password).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
