/**
 * Diagnostic Tool: Check XP Sync Between User and Leaderboard
 * 
 * Run with: node diagnose_xp_sync.js <userId>
 * Example: node diagnose_xp_sync.js 507f1f77bcf86cd799439011
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');
const Quiz = require('./models/Quiz');
const Result = require('./models/Result');

async function diagnoseUser(userId) {
  try {
    console.log('\n========== XP SYNC DIAGNOSTIC ==========\n');
    console.log(`Diagnosing XP sync for user: ${userId}\n`);

    // 1. Check user XP in database
    const user = await User.findById(userId).select('_id name username xp level');
    if (!user) {
      console.error('❌ User not found in database');
      return;
    }
    console.log('✅ User Found:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Current XP: ${user.xp}`);
    console.log(`   Current Level: ${user.level}`);

    // 2. Check XP logs for this user
    const xpLogs = await XpLog.find({ user_id: userId }).sort({ timestamp: -1 }).limit(20);
    const totalXpFromLogs = xpLogs.reduce((sum, log) => sum + (log.xp_earned || 0), 0);
    console.log(`\n📊 XP Logs (Last 20):`);
    console.log(`   Total records: ${xpLogs.length}`);
    console.log(`   Total XP from logs: ${totalXpFromLogs}`);
    if (xpLogs.length > 0) {
      console.log(`   Latest log date: ${xpLogs[0].createdAt}`);
      console.log(`   Latest activity: ${xpLogs[0].activityType}`);
    }

    // 3. Check quiz results
    const results = await Result.find({ userId }).select('score percentage completedAt').sort({ completedAt: -1 }).limit(10);
    console.log(`\n📝 Quiz Results (Last 10):`);
    console.log(`   Total quizzes completed: ${results.length}`);
    if (results.length > 0) {
      console.log(`   Latest quiz: ${results[0].completedAt}`);
      console.log(`   Latest score: ${results[0].score}/${results[0].percentage}%`);
      console.log(`   Average score: ${(results.reduce((sum, r) => sum + r.percentage, 0) / results.length).toFixed(1)}%`);
    }

    // 4. Calculate expected XP vs actual
    const expectedXpFromQuizzes = results.reduce((sum, r) => {
      if (r.percentage >= 80) return sum + 20;
      if (r.percentage >= 60) return sum + 15;
      return sum + 10;
    }, 0);
    console.log(`\n🔢 XP Calculation Check:`);
    console.log(`   Expected XP from quizzes: ${expectedXpFromQuizzes}`);
    console.log(`   Actual User XP: ${user.xp}`);
    if (Math.abs(user.xp - expectedXpFromQuizzes) > 5) {
      console.warn(`   ⚠️  Discrepancy detected: ${user.xp - expectedXpFromQuizzes} XP`);
    } else {
      console.log(`   ✅ XP matches expected value`);
    }

    // 5. Check if user appears in leaderboard query
    const leaderboardUsers = await User.find({
      $and: [
        { isAdmin: { $ne: true } },
        { role: { $nin: ['admin', 'superadmin'] } }
      ]
    }).select('_id name xp').sort({ xp: -1 }).limit(100);

    const userRank = leaderboardUsers.findIndex(u => u._id.toString() === userId) + 1;
    console.log(`\n🏆 Leaderboard Position:`);
    if (userRank > 0) {
      console.log(`   Rank: #${userRank} out of ${leaderboardUsers.length}`);
      console.log(`   Top user XP: ${leaderboardUsers[0].xp}`);
    } else {
      console.warn(`   ⚠️  User NOT in top 100 leaderboard`);
    }

    // 6. Summary
    console.log(`\n📋 SUMMARY:`);
    const issues = [];
    if (!xpLogs.length && results.length > 0) {
      issues.push('No XP logs found despite quiz completions - XP may not be recorded');
    }
    if (user.xp !== totalXpFromLogs && totalXpFromLogs > 0) {
      issues.push(`User XP (${user.xp}) doesn't match XP logs total (${totalXpFromLogs})`);
    }
    if (user.xp === 0 && results.length > 0) {
      issues.push('User has 0 XP despite completing quizzes - XP award function may not be working');
    }

    if (issues.length === 0) {
      console.log('✅ No issues detected - XP sync appears to be working correctly');
    } else {
      console.log('⚠️  Issues found:');
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }

    console.log('\n========== END DIAGNOSTIC ==========\n');

  } catch (error) {
    console.error('Diagnostic error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Main
const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node diagnose_xp_sync.js <userId>');
  console.error('Example: node diagnose_xp_sync.js 507f1f77bcf86cd799439011');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  diagnoseUser(userId);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
