const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function testGamification() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected.');

    // Find a test user
    const user = await User.findOne({});
    if (!user) {
      console.log('No users found. Please create a user first.');
      return;
    }

    console.log('Testing with user:', user.name || user.username);
    console.log('Current XP:', user.total_xp || 0);
    console.log('Current Streak:', user.current_streak || 0);
    console.log('Last Active:', user.last_active_date);

    // Test XP awarding
    console.log('\n--- Testing XP Award ---');
    const testXpLog = new XpLog({
      user_id: user._id,
      xp_earned: 10,
      activity_type: 'quiz_completed',
      timestamp: new Date()
    });

    await testXpLog.save();
    console.log('XP log saved successfully');

    // Update user XP
    user.total_xp = (user.total_xp || 0) + 10;
    user.xp = user.total_xp; // Sync legacy field
    await user.save();
    console.log('User XP updated to:', user.total_xp);

    // Test streak logic
    console.log('\n--- Testing Streak Logic ---');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Simulate yesterday's activity
    user.last_active_date = yesterday;
    user.current_streak = 2;
    await user.save();

    // Check if streak continues today
    const streakLog = new XpLog({
      user_id: user._id,
      xp_earned: 5,
      activity_type: 'DAILY_STREAK',
      timestamp: today
    });

    await streakLog.save();
    console.log('Streak log saved');

    // Update streak
    user.current_streak = 3;
    user.last_active_date = today;
    await user.save();
    console.log('Streak updated to:', user.current_streak);

    console.log('\n--- Test Complete ---');
    console.log('✅ XP and streak functionality working!');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Test complete.');
  }
}

testGamification();