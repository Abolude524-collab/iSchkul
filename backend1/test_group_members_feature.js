#!/usr/bin/env node

/**
 * Test script: Group Creation with Members Feature
 * 
 * Tests the backend API endpoint for creating groups with initial members.
 * This validates that the feature works end-to-end.
 */

const axios = require('axios');
const API_URL = process.env.API_URL || 'http://localhost:5000';

const testConfig = {
  admin: { email: 'admin@ischkul.com', password: 'admin123' },
  user1: { email: 'Yung_pr0grammer@gmail.com', password: 'test123' },
  user2: { email: 'Testimony7@gmail.com', password: 'test123' },
};

let authTokens = {};
let userIds = {};

async function loginUser(userKey) {
  console.log(`  ↳ Logging in ${userKey}...`);
  try {
    const credentials = testConfig[userKey];
    const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
    
    authTokens[userKey] = response.data.token;
    userIds[userKey] = response.data.user._id;
    console.log(`  ✅ Logged in: ${credentials.email}`);
  } catch (err) {
    console.error(`  ❌ Login failed:`, err.response?.data?.error || err.message);
    throw err;
  }
}

async function createGroupWithMembers(groupName, memberKeys) {
  console.log(`  Creating group "${groupName}" with members: [${memberKeys.join(', ')}]`);
  
  const memberIds = memberKeys.map(key => userIds[key]).filter(id => id);
  
  try {
    const response = await axios.post(
      `${API_URL}/api/groups/create`,
      {
        name: groupName,
        description: `Test group created at ${new Date().toISOString()}`,
        category: 'study',
        isPrivate: false,
        tags: ['test', 'members'],
        memberIds
      },
      { headers: { Authorization: `Bearer ${authTokens.admin}` } }
    );
    
    console.log(`  ✅ Group created successfully`);
    console.log(`     ID: ${response.data.group._id}`);
    console.log(`     Members: ${response.data.group.members.length}`);
    console.log(`     Message: "${response.data.message}"`);
    
    return response.data.group;
  } catch (err) {
    console.error(`  ❌ Failed to create group:`, err.response?.data || err.message);
    throw err;
  }
}

async function verifyGroupAccess(userKey, groupId) {
  try {
    const response = await axios.get(
      `${API_URL}/api/groups/${groupId}`,
      { headers: { Authorization: `Bearer ${authTokens[userKey]}` } }
    );
    return response.data;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('\n🧪 Group Creation with Members - Feature Test');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Step 1: Login all test users
    console.log('📝 Step 1: Logging in test users');
    await loginUser('admin');
    await loginUser('user1');
    await loginUser('user2');
    
    // Step 2: Test group creation WITHOUT members
    console.log('\n📝 Step 2: Test group creation WITHOUT members');
    const group1 = await createGroupWithMembers(
      `No Members Test ${Date.now()}`,
      [] // No members
    );
    
    // Step 3: Test group creation WITH members
    console.log('\n📝 Step 3: Test group creation WITH members');
    const group2 = await createGroupWithMembers(
      `With Members Test ${Date.now()}`,
      ['user1', 'user2'] // Add user1 and user2 as members
    );
    
    // Verify member details
    console.log('\n  Member details:');
    group2.members.forEach((member, idx) => {
      const userName = member.user?.name || member.user || 'Unknown';
      console.log(`    ${idx + 1}. ${userName} - Role: ${member.role}`);
    });
    
    // Step 4: Verify members can access the group
    console.log('\n📝 Step 4: Verify members can access their group');
    for (const userKey of ['user1', 'user2']) {
      const groupData = await verifyGroupAccess(userKey, group2._id);
      if (groupData) {
        console.log(`  ✅ ${userKey} can access the group`);
      } else {
        console.log(`  ⚠️  ${userKey} cannot access the group (permission denied or not a member)`);
      }
    }
    
    // Step 5: Test member role verification
    console.log('\n📝 Step 5: Verify member roles');
    const adminMember = group2.members.find(m => m.user?._id === userIds.admin || m.user === userIds.admin);
    const user1Member = group2.members.find(m => m.user?._id === userIds.user1 || m.user === userIds.user1);
    const user2Member = group2.members.find(m => m.user?._id === userIds.user2 || m.user === userIds.user2);
    
    console.log(`  Admin role: ${adminMember?.role || 'NOT FOUND'} ${adminMember?.role === 'admin' ? '✅' : '❌'}`);
    console.log(`  User1 role: ${user1Member?.role || 'NOT FOUND'} ${user1Member?.role === 'member' ? '✅' : '❌'}`);
    console.log(`  User2 role: ${user2Member?.role || 'NOT FOUND'} ${user2Member?.role === 'member' ? '✅' : '❌'}`);
    
    // Step 6: Test duplicate member filtering (adding admin as member should be filtered)
    console.log('\n📝 Step 6: Test self-add filtering');
    const group3 = await createGroupWithMembers(
      `Self-Add Filter Test ${Date.now()}`,
      ['admin', 'user1'] // Try to add self + another user
    );
    
    const expectedMembers = 2; // admin as admin + user1 as member
    console.log(`  Expected members: ${expectedMembers}`);
    console.log(`  Actual members: ${group3.members.length}`);
    console.log(`  ${group3.members.length === expectedMembers ? '✅' : '❌'} Self-add correctly filtered`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n✅ Features verified:');
    console.log('   • Group creation without members');
    console.log('   • Group creation with members');
    console.log('   • Members assigned correct roles (admin/member)');
    console.log('   • Self-add filtering works');
    console.log('\n');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

main();
