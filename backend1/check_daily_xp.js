const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function checkDailyXP() {
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

    console.log('User:', user.name || user.username);
    console.log('Current XP:', user.total_xp || 0);

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
    }).sort({ timestamp: -1 });

    console.log('\nDaily login logs today:', todayLogs.length);
    todayLogs.forEach((log, index) => {
      console.log(` ${index + 1}. ${log.timestamp.toISOString()} - ${log.xp_earned} XP`);
    });

    if (todayLogs.length <= 1) {
      console.log('✅ GOOD: Only one daily login award today (or none)');
    } else {
      console.log('❌ PROBLEM: Multiple daily login awards today!');
    }

    // Check recent XP logs
    console.log('\nRecent XP logs:');
    const recentLogs = await XpLog.find({ user_id: user._id })
      .sort({ timestamp: -1 })
      .limit(10);

    recentLogs.forEach((log, index) => {
      console.log(` ${index + 1}. [${log.timestamp.toISOString()}] ${log.activity_type}: ${log.xp_earned} XP`);
    });

  } catch (error) {
    console.error('Check error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Check complete.');
  }
}

checkDailyXP();