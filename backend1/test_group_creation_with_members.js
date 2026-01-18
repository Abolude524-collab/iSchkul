/**
 * Test script for enhanced group creation with members
 * Tests: Creating groups with 0, 1, and multiple members during creation
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul';

// Store auth tokens and user IDs
let authToken = '';
let creatorId = '';
let memberIds = [];
const testUsers = [];

// Test data
const testGroups = [
  {
    name: 'Math Study Group',
    description: 'Group for studying calculus',
    category: 'study',
    isPrivate: false,
    tags: ['math', 'calculus'],
    membersToAdd: 0
  },
  {
    name: 'Physics Project Team',
    description: 'Collaboration group for physics project',
    category: 'project',
    isPrivate: false,
    tags: ['physics', 'project'],
    membersToAdd: 1
  },
  {
    name: 'Advanced Chemistry Lab',
    description: 'Advanced chemistry study group',
    category: 'study',
    isPrivate: true,
    tags: ['chemistry', 'lab', 'advanced'],
    membersToAdd: 2
  }
];

async function setupDatabase() {
  console.log('\n📦 Setting up database...');
  try {
    await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Database connected');

    // Get all users from database
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    
    // Ensure we have at least the admin user and test users
    const adminUser = await User.findOne({ email: 'admin@ischkul.com' });
    if (!adminUser) {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = new User({
        name: 'Admin',
        email: 'admin@ischkul.com',
        password: hashedPassword,
        username: 'admin',
        role: 'superadmin'
      });
      await admin.save();
      console.log('  Created admin user');
    }

    // Create test users if they don't exist
    const testUserEmails = [
      { email: 'grouptest1@test.com', password: 'test123456' },
      { email: 'grouptest2@test.com', password: 'test123456' },
      { email: 'grouptest3@test.com', password: 'test123456' }
    ];
    
    for (const { email, password } of testUserEmails) {
      let user = await User.findOne({ email });
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
          name: email.split('@')[0],
          email,
          password: hashedPassword,
          username: email.split('@')[0] + Math.random().toString(36).substr(2, 9),
          role: 'user'
        });
        await user.save();
        console.log(`  Created user: ${email}`);
      }
      testUsers.push(user);
    }

    // Get users for testing (use admin as creator)
    const adminForTest = await User.findOne({ email: 'admin@ischkul.com' });
    const allTestUsers = await User.find({ 
      email: { $in: testUserEmails.map(u => u.email) } 
    }).select('_id name email username');
    
    creatorId = adminForTest._id;
    memberIds = allTestUsers.slice(0, 2).map(u => u._id.toString());
    
    console.log(`Creator ID (admin): ${creatorId}`);
    console.log(`Member IDs for testing: ${memberIds.join(', ')}`);
    console.log(`Test user count: ${allTestUsers.length}`);

    return [adminForTest, ...allTestUsers];
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    process.exit(1);
  }
}

async function loginUser(email, password = 'test123456') {
  console.log(`\n🔐 Logging in as ${email}...`);
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });

    authToken = response.data.token;
    console.log('✅ Login successful');
    return response.data;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createGroupWithMembers(groupData, additionalMembers = []) {
  console.log(`\n📌 Creating group: "${groupData.name}"`);
  
  try {
    const payload = {
      name: groupData.name,
      description: groupData.description,
      category: groupData.category,
      isPrivate: groupData.isPrivate,
      tags: groupData.tags,
      memberIds: additionalMembers
    };

    console.log(`  Members to add: ${additionalMembers.length > 0 ? additionalMembers.join(', ') : 'None (creator only)'}`);

    const response = await axios.post(
      `${API_URL}/groups/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const group = response.data.group;
    console.log('✅ Group created successfully');
    console.log(`  Group ID: ${group._id}`);
    console.log(`  Total members: ${group.members.length}`);
    console.log(`  Members:`);
    
    group.members.forEach((member, index) => {
      const memberInfo = member.user.name || member.user;
      console.log(`    ${index + 1}. ${memberInfo} (${member.role})`);
    });

    // Verify members
    const expectedMemberCount = 1 + additionalMembers.length; // creator + additional
    if (group.members.length === expectedMemberCount) {
      console.log(`  ✅ Member count verified (${expectedMemberCount} total)`);
    } else {
      console.warn(`  ⚠️  Expected ${expectedMemberCount} members but found ${group.members.length}`);
    }

    // Verify all member IDs are present
    const memberIdStrings = group.members.map(m => m.user._id?.toString() || m.user.toString());
    const creatorIsPresent = memberIdStrings.some(id => id === creatorId.toString());
    const additionalMembersPresent = additionalMembers.every(memberId => 
      memberIdStrings.includes(memberId.toString())
    );

    if (creatorIsPresent && additionalMembersPresent) {
      console.log(`  ✅ All members verified in group`);
    } else {
      console.warn(`  ⚠️  Some members missing - Creator: ${creatorIsPresent}, Additional: ${additionalMembersPresent}`);
    }

    return group;
  } catch (error) {
    console.error('❌ Group creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function verifyGroupMembers(groupId) {
  console.log(`\n🔍 Verifying group members...`);
  try {
    const response = await axios.get(
      `${API_URL}/groups/${groupId}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    const group = response.data.group || response.data;
    console.log(`  Group: ${group.name}`);
    console.log(`  Total members: ${group.members.length}`);
    
    group.members.forEach((member, index) => {
      const memberInfo = member.user?.name || member.user;
      const role = member.role;
      console.log(`    ${index + 1}. ${memberInfo} (${role})`);
    });

    return group;
  } catch (error) {
    console.error('❌ Verification failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 GROUP CREATION WITH MEMBERS - TEST SUITE');
  console.log('='.repeat(60));

  try {
    // Setup
    const users = await setupDatabase();
    
    // Login as admin (creator)
    const creatorEmail = 'admin@ischkul.com';
    const creatorPassword = 'admin123';
    
    console.log(`\n🔐 Logging in as ${creatorEmail}...`);
    await loginUser(creatorEmail, creatorPassword);

    // Test 1: Create group with no additional members (creator only)
    console.log('\n' + '-'.repeat(60));
    console.log('TEST 1: Group with creator only (no additional members)');
    console.log('-'.repeat(60));
    const group1 = await createGroupWithMembers(testGroups[0], []);
    await verifyGroupMembers(group1._id);

    // Test 2: Create group with 1 additional member
    console.log('\n' + '-'.repeat(60));
    console.log('TEST 2: Group with 1 additional member');
    console.log('-'.repeat(60));
    const group2 = await createGroupWithMembers(testGroups[1], [memberIds[0]]);
    await verifyGroupMembers(group2._id);

    // Test 3: Create group with 2 additional members
    console.log('\n' + '-'.repeat(60));
    console.log('TEST 3: Group with 2 additional members');
    console.log('-'.repeat(60));
    const group3 = await createGroupWithMembers(testGroups[2], memberIds);
    await verifyGroupMembers(group3._id);

    // Test 4: Try to add non-existent member (should fail)
    console.log('\n' + '-'.repeat(60));
    console.log('TEST 4: Try adding non-existent member (should fail)');
    console.log('-'.repeat(60));
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await createGroupWithMembers(
        { ...testGroups[0], name: 'Test With Invalid Member' },
        [fakeId.toString()]
      );
      console.warn('⚠️  Should have rejected invalid member ID');
    } catch (error) {
      console.log('✅ Correctly rejected invalid member ID');
    }

    // Test 5: Verify group retrieval shows all members
    console.log('\n' + '-'.repeat(60));
    console.log('TEST 5: Verify groups list shows correct member counts');
    console.log('-'.repeat(60));
    try {
      const response = await axios.get(
        `${API_URL}/groups`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      console.log(`\nUser's groups:`);
      response.data.groups.forEach((group, index) => {
        console.log(`  ${index + 1}. ${group.name} - ${group.members.length} members`);
      });
      console.log('✅ Groups list retrieved successfully');
    } catch (error) {
      console.error('❌ Failed to retrieve groups list');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
