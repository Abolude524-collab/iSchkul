const mongoose = require('mongoose');
const Badge = require('./models/Badge');
require('dotenv').config();

async function verifyBadgeModel() {
  try {
    console.log('\n🔍 Verifying Badge Model...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Check if Badge collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const badgeCollection = collections.find(c => c.name === 'badges');
    
    if (badgeCollection) {
      console.log('✅ Badge collection exists in database');
    } else {
      console.log('⚠️  Badge collection does not exist yet (will be created on first insert)');
    }
    
    // Test creating a sample badge
    console.log('\n📝 Testing badge creation...\n');
    
    // Create a test user first (skip if user already exists)
    const User = require('./models/User');
    let testUser = await User.findOne({ email: 'test-badge@ischkul.com' });
    
    if (!testUser) {
      const bcryptjs = require('bcryptjs');
      const hashedPassword = await bcryptjs.hash('test123', 10);
      testUser = await User.create({
        username: 'badgetester',
        email: 'test-badge@ischkul.com',
        password: hashedPassword,
        name: 'Badge Tester'
      });
      console.log('✅ Test user created:', testUser.name);
    } else {
      console.log('✅ Test user already exists:', testUser.name);
    }
    
    // Create a test badge
    const testBadge = await Badge.create({
      userId: testUser._id,
      type: 'sotw',
      name: 'Test SOTW Badge',
      description: 'This is a test SOTW badge',
      icon: '🏆',
      metadata: {
        weekStart: new Date(),
        weekEnd: new Date(),
        xpEarned: 100,
        reason: 'Test badge creation'
      }
    });
    
    console.log('✅ Badge created successfully!');
    console.log('   Badge ID:', testBadge._id);
    console.log('   User ID:', testBadge.userId);
    console.log('   Type:', testBadge.type);
    console.log('   Name:', testBadge.name);
    
    // Query the badge back
    const retrievedBadge = await Badge.findById(testBadge._id).populate('userId', 'name email');
    console.log('\n✅ Badge retrieved successfully!');
    console.log('   Name:', retrievedBadge.name);
    console.log('   User:', retrievedBadge.userId.name);
    
    // List all badges for the test user
    const userBadges = await Badge.find({ userId: testUser._id }).sort({ awardedDate: -1 });
    console.log('\n✅ User has', userBadges.length, 'badge(s)');
    userBadges.forEach((badge, idx) => {
      console.log(`   ${idx + 1}. ${badge.name} (${badge.type})`);
    });
    
    // Cleanup - delete test badge
    await Badge.deleteOne({ _id: testBadge._id });
    console.log('\n✅ Cleanup complete - test badge deleted');
    
    console.log('\n========== BADGE MODEL VERIFICATION SUCCESS ==========\n');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n========== BADGE MODEL VERIFICATION FAILED ==========\n');
    process.exit(1);
  }
}

verifyBadgeModel();
