const mongoose = require('mongoose');
require('dotenv').config();

const Group = require('./models/Group');
const User = require('./models/User');

async function checkUserGroups(userId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB\n');
    
    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      console.log(`User not found with ID: ${userId}`);
      return;
    }
    
    console.log('=== USER INFO ===');
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Username: ${user.username}`);
    console.log(`ID: ${user._id}\n`);
    
    // Find groups where user is creator
    const createdGroups = await Group.find({ createdBy: userId }).populate('createdBy', 'name email username');
    console.log('=== GROUPS CREATED BY USER ===');
    console.log(`Found ${createdGroups.length} group(s)\n`);
    
    createdGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name}`);
      console.log(`   ID: ${group._id}`);
      console.log(`   Description: ${group.description || 'N/A'}`);
      console.log(`   Category: ${group.category || 'N/A'}`);
      console.log(`   Private: ${group.isPrivate ? 'Yes' : 'No'}`);
      console.log(`   Members: ${group.members ? group.members.length : 0}`);
      console.log(`   Created: ${group.createdAt || 'N/A'}`);
      console.log('');
    });
    
    // Find groups where user is a member
    const memberGroups = await Group.find({ 'members.user': userId }).populate('createdBy', 'name email username');
    console.log('=== GROUPS WHERE USER IS A MEMBER ===');
    console.log(`Found ${memberGroups.length} group(s)\n`);
    
    memberGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name}`);
      console.log(`   ID: ${group._id}`);
      console.log(`   Creator: ${group.createdBy ? group.createdBy.name : 'N/A'}`);
      console.log(`   Description: ${group.description || 'N/A'}`);
      console.log(`   Category: ${group.category || 'N/A'}`);
      console.log(`   Private: ${group.isPrivate ? 'Yes' : 'No'}`);
      console.log(`   Members: ${group.members ? group.members.length : 0}`);
      console.log(`   Created: ${group.createdAt || 'N/A'}`);
      console.log('');
    });
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total groups created: ${createdGroups.length}`);
    console.log(`Total groups as member: ${memberGroups.length}`);
    console.log(`Total groups associated: ${createdGroups.length + memberGroups.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Get user ID from command line or use default
const userId = process.argv[2] || '695c7554f9d6072b4e29fbe6';
checkUserGroups(userId);
