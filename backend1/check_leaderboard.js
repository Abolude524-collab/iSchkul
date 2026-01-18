const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function checkLeaderboard() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected.\n');

    // Get all non-admin users sorted by XP
    const users = await User.find({
      $and: [
        { isAdmin: { $ne: true } },
        { role: { $nin: ['admin', 'superadmin'] } }
      ]
    })
    .select('name username email total_xp xp level current_streak last_login_date')
    .sort({ total_xp: -1, xp: -1 });

    console.log('=== LEADERBOARD (Non-Admin Users) ===\n');
    console.log('Rank | Name                    | XP   | Level | Streak | Email');
    console.log('-----|-------------------------|------|-------|--------|-------------------------');
    
    users.forEach((user, index) => {
      const xp = user.total_xp || user.xp || 0;
      const level = user.level || Math.floor(xp / 100) + 1;
      const streak = user.current_streak || 0;
      const name = (user.name || user.username || 'Unknown').padEnd(23).substring(0, 23);
      const email = (user.email || '').substring(0, 25);
      
      console.log(
        `${String(index + 1).padStart(4)} | ${name} | ${String(xp).padStart(4)} | ${String(level).padStart(5)} | ${String(streak).padStart(6)} | ${email}`
      );
    });

    console.log('\n=== DETAILED STATS ===\n');
    
    for (const user of users.slice(0, 5)) { // Top 5 users
      const xp = user.total_xp || user.xp || 0;
      const logs = await XpLog.find({ user_id: user._id }).sort({ timestamp: -1 }).limit(10);
      const logSum = logs.reduce((sum, log) => sum + log.xp_earned, 0);
      
      console.log(`\n👤 ${user.name || user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Total XP: ${xp}`);
      console.log(`   Level: ${user.level || Math.floor(xp / 100) + 1}`);
      console.log(`   Streak: ${user.current_streak || 0}`);
      console.log(`   Last Login: ${user.last_login_date ? user.last_login_date.toISOString() : 'Never'}`);
      console.log(`   Recent Activity (last 10):`);
      
      logs.forEach((log, idx) => {
        console.log(`     ${idx + 1}. [${log.timestamp.toISOString()}] ${log.activity_type}: +${log.xp_earned} XP`);
      });
    }

    // Check for today's activity
    console.log('\n\n=== TODAY\'S ACTIVITY ===\n');
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayActivity = await XpLog.aggregate([
      {
        $match: {
          timestamp: { $gte: todayStart, $lt: todayEnd }
        }
      },
      {
        $group: {
          _id: '$activity_type',
          count: { $sum: 1 },
          totalXp: { $sum: '$xp_earned' }
        }
      },
      {
        $sort: { totalXp: -1 }
      }
    ]);

    if (todayActivity.length === 0) {
      console.log('No activity recorded today.');
    } else {
      console.log('Activity Type         | Count | Total XP');
      console.log('----------------------|-------|----------');
      todayActivity.forEach(act => {
        const type = (act._id || 'Unknown').padEnd(20);
        console.log(`${type} | ${String(act.count).padStart(5)} | ${String(act.totalXp).padStart(8)}`);
      });
    }

    // Check for XP consistency
    console.log('\n\n=== XP CONSISTENCY CHECK ===\n');
    let inconsistentCount = 0;
    
    for (const user of users) {
      const logs = await XpLog.find({ user_id: user._id });
      const calculatedXp = logs.reduce((sum, log) => sum + log.xp_earned, 0);
      const profileXp = user.total_xp || user.xp || 0;
      
      if (calculatedXp !== profileXp) {
        console.log(`❌ ${user.name || user.username}: Profile=${profileXp}, Calculated=${calculatedXp}, Diff=${calculatedXp - profileXp}`);
        inconsistentCount++;
      }
    }
    
    if (inconsistentCount === 0) {
      console.log('✅ All users have consistent XP totals!');
    } else {
      console.log(`\n⚠️  Found ${inconsistentCount} users with inconsistent XP. Run 'node repair_xp.js' to fix.`);
    }

    // Global leaderboards check
    console.log('\n\n=== GLOBAL LEADERBOARDS ===\n');
    if (global.leaderboards && global.leaderboards.length > 0) {
      console.log(`Found ${global.leaderboards.length} leaderboard(s) in memory.`);
      global.leaderboards.forEach((lb, idx) => {
        console.log(`\n${idx + 1}. ${lb.title}`);
        console.log(`   Status: ${lb.status}`);
        console.log(`   Start: ${lb.startDate.toISOString()}`);
        console.log(`   End: ${lb.endDate.toISOString()}`);
        console.log(`   Prizes: ${lb.prizes?.length || 0}`);
      });
    } else {
      console.log('No leaderboards found in memory (check server.js initialization).');
    }

  } catch (error) {
    console.error('Check error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\nCheck complete.');
  }
}

checkLeaderboard();
