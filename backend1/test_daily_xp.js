const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function testDailyLoginXP() {
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

    // Simulate multiple daily login attempts (should only award XP once)
    const performAward = require('./routes/gamification.js').performAward;
    if (!performAward) {
      console.log('performAward function not available');
      return;
    }

    console.log('\n--- Testing Multiple Daily Login Attempts ---');

    const initialXp = user.total_xp || 0;

    // First attempt - should award XP
    console.log('Attempt 1:');
    const result1 = await performAward(user._id, 'daily_login');
    console.log('Result:', result1);

    // Second attempt - should NOT award XP (already awarded today)
    console.log('Attempt 2:');
    const result2 = await performAward(user._id, 'daily_login');
    console.log('Result:', result2);

    // Third attempt - should NOT award XP
    console.log('Attempt 3:');
    const result3 = await performAward(user._id, 'daily_login');
    console.log('Result:', result3);

    // Check final XP
    const updatedUser = await User.findById(user._id);
    console.log('\nFinal XP:', updatedUser.total_xp);
    console.log('XP awarded in total:', (updatedUser.total_xp || 0) - initialXp);

    // Check XP logs for today
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayLogs = await XpLog.find({
      user_id: user._id,
      activity_type: 'daily_login',
      timestamp: { $gte: todayStart, $lt: todayEnd }
    });

    console.log('Daily login logs today:', todayLogs.length);
    todayLogs.forEach(log => console.log(' -', log.timestamp, log.xp_earned + ' XP'));

    console.log('\n--- Test Complete ---');
    if (todayLogs.length === 1 && (updatedUser.total_xp || 0) === initialXp + 10) {
      console.log('✅ SUCCESS: Daily XP awarded only once!');
    } else {
      console.log('❌ FAILED: Daily XP logic not working correctly');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Test complete.');
  }
}

testDailyLoginXP();