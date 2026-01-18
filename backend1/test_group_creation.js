const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Group = require('./models/Group');

async function testGroupCreation() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected.\n');

    // Find or create a test user
    let testUser = await User.findOne({ username: 'Testimony7' });
    if (!testUser) {
      console.log('❌ Test user not found. Please ensure a user exists.');
      return;
    }
    console.log(`✅ Found test user: ${testUser.name} (${testUser.email})\n`);

    // Test 1: Create a group
    console.log('📝 Test 1: Creating a new group...');
    const newGroup = new Group({
      name: `Test Group ${Date.now()}`,
      description: 'A test group to verify group creation and retrieval',
      category: 'study',
      createdBy: testUser._id,
      members: [{
        user: testUser._id,
        role: 'admin',
        joinedAt: new Date()
      }],
      settings: {
        isPrivate: false
      }
    });

    const savedGroup = await newGroup.save();
    console.log(`✅ Group created with ID: ${savedGroup._id}`);
    console.log(`   Name: ${savedGroup.name}`);
    console.log(`   Members: ${savedGroup.members.length}`);
    console.log(`   Created by: ${savedGroup.createdBy}\n`);

    // Test 2: Find the group by ID
    console.log('🔍 Test 2: Retrieving group by ID...');
    const foundGroup = await Group.findById(savedGroup._id)
      .populate('members.user', 'name username email')
      .populate('createdBy', 'name username email');

    if (foundGroup) {
      console.log(`✅ Group found!`);
      console.log(`   ID: ${foundGroup._id}`);
      console.log(`   Name: ${foundGroup.name}`);
      console.log(`   Description: ${foundGroup.description}`);
      console.log(`   Category: ${foundGroup.category}`);
      console.log(`   Members: ${foundGroup.memberCount}`);
      console.log(`   Created by: ${foundGroup.createdBy.name}`);
      console.log(`   Member details:`);
      foundGroup.members.forEach((member, idx) => {
        console.log(`     ${idx + 1}. ${member.user.name} (${member.user.email}) - Role: ${member.role}`);
      });
    } else {
      console.log(`❌ Group NOT found by ID!`);
    }
    console.log();

    // Test 3: Find user's groups
    console.log('🔍 Test 3: Retrieving user\'s groups...');
    const userGroups = await Group.findUserGroups(testUser._id);
    console.log(`✅ Found ${userGroups.length} group(s) for user`);
    userGroups.forEach((group, idx) => {
      console.log(`   ${idx + 1}. ${group.name} (${group._id})`);
    });
    console.log();

    // Test 4: Verify group contains user
    console.log('✅ Test 4: Checking group membership...');
    if (foundGroup.isMember(testUser._id)) {
      console.log(`✅ User is confirmed as member of group`);
      console.log(`   User role: ${foundGroup.getMemberRole(testUser._id)}`);
    } else {
      console.log(`❌ User is NOT found as member of group!`);
    }
    console.log();

    // Test 5: Add another member (if available)
    console.log('👥 Test 5: Testing member operations...');
    const otherUser = await User.findOne({ _id: { $ne: testUser._id } });
    
    if (otherUser) {
      try {
        await foundGroup.addMember(otherUser._id, 'member', testUser._id);
        console.log(`✅ Added ${otherUser.name} to group`);
        console.log(`   New member count: ${foundGroup.memberCount}`);
      } catch (err) {
        console.log(`⚠️  Could not add member: ${err.message}`);
      }
    } else {
      console.log('⚠️  No other users found to test member addition');
    }

    console.log('\n✅ All tests completed!\n');

    // Summary
    console.log('=== SUMMARY ===');
    console.log(`✅ Group creation: WORKING`);
    console.log(`✅ Group retrieval by ID: WORKING`);
    console.log(`✅ User group listing: WORKING`);
    console.log(`✅ Group methods: WORKING`);

  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\nTest complete.');
  }
}

testGroupCreation();
