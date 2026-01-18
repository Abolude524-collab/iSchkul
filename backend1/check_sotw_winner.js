/**
 * SOTW (Student of the Week) Award Checker
 * 
 * This script verifies the Student of the Week award calculation
 * and ensures winners are correctly determined based on XP logs.
 * 
 * Run with: node check_sotw_winner.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');
const WeeklyWinner = require('./models/WeeklyWinner');

async function getWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate Monday of this week
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  // Last week's range
  const lastWeekEnd = new Date(thisWeekMonday);
  lastWeekEnd.setMilliseconds(-1);
  const lastWeekStart = new Date(thisWeekMonday);
  lastWeekStart.setDate(thisWeekMonday.getDate() - 7);
  
  // This week's range
  const thisWeekEnd = new Date(lastWeekEnd);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  thisWeekEnd.setMilliseconds(-1);
  
  return {
    lastWeek: { start: lastWeekStart, end: lastWeekEnd },
    thisWeek: { start: thisWeekMonday, end: thisWeekEnd }
  };
}

async function checkSotwWinner() {
  try {
    console.log('\n========== SOTW WINNER CHECKER ==========\n');

    const weekRanges = await getWeekRange();
    
    // Check this week
    console.log('📅 Checking THIS WEEK:');
    console.log(`   Start: ${weekRanges.thisWeek.start.toISOString().split('T')[0]}`);
    console.log(`   End: ${weekRanges.thisWeek.end.toISOString().split('T')[0]}\n`);

    // Get XP logs for this week
    const thisWeekLogs = await XpLog.find({
      timestamp: {
        $gte: weekRanges.thisWeek.start,
        $lte: weekRanges.thisWeek.end
      }
    });

    console.log(`Total XP logs this week: ${thisWeekLogs.length}`);

    // Aggregate by user
    const userXp = {};
    thisWeekLogs.forEach(log => {
      const userId = log.user_id.toString();
      if (!userXp[userId]) {
        userXp[userId] = 0;
      }
      userXp[userId] += log.xp_earned || 0;
    });

    // Sort and get top user
    const sortedUsers = Object.entries(userXp)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    console.log(`\n🏆 Top 10 Users by XP (This Week):`);
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, xp] = sortedUsers[i];
      const user = await User.findById(userId).select('name username xp');
      console.log(`   ${i + 1}. ${user?.name || user?.username || 'Unknown'} - ${xp} XP (DB: ${user?.xp})`);
    }

    // Check last week's winner
    console.log(`\n\n📅 Checking LAST WEEK:`);
    console.log(`   Start: ${weekRanges.lastWeek.start.toISOString().split('T')[0]}`);
    console.log(`   End: ${weekRanges.lastWeek.end.toISOString().split('T')[0]}\n`);

    const lastWeekLogs = await XpLog.find({
      timestamp: {
        $gte: weekRanges.lastWeek.start,
        $lte: weekRanges.lastWeek.end
      }
    });

    console.log(`Total XP logs last week: ${lastWeekLogs.length}`);

    // Aggregate last week
    const lastWeekUserXp = {};
    lastWeekLogs.forEach(log => {
      const userId = log.user_id.toString();
      if (!lastWeekUserXp[userId]) {
        lastWeekUserXp[userId] = 0;
      }
      lastWeekUserXp[userId] += log.xp_earned || 0;
    });

    const lastWeekSorted = Object.entries(lastWeekUserXp)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    console.log(`🏆 Top 5 Users by XP (Last Week):`);
    for (let i = 0; i < lastWeekSorted.length; i++) {
      const [userId, xp] = lastWeekSorted[i];
      const user = await User.findById(userId).select('name username xp');
      console.log(`   ${i + 1}. ${user?.name || user?.username || 'Unknown'} - ${xp} XP`);
    }

    // Check WeeklyWinner records
    console.log(`\n\n📋 WeeklyWinner Records (Last 5):`);
    const winners = await WeeklyWinner.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name username xp');

    if (winners.length === 0) {
      console.log('   No weekly winner records found');
    } else {
      for (const winner of winners) {
        const startDate = new Date(winner.startDate).toISOString().split('T')[0];
        const endDate = new Date(winner.endDate).toISOString().split('T')[0];
        console.log(`   ${startDate} to ${endDate}: ${winner.userId?.name || 'Unknown'} (${winner.weeklyScore} XP)`);
      }
    }

    console.log('\n========== END SOTW CHECK ==========\n');

  } catch (error) {
    console.error('SOTW check error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Main
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  checkSotwWinner();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
