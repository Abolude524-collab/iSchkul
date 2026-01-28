/**
 * Check Student of the Week (SOTW) and Current Week Leaderboard
 * - SOTW: Shows winner from LAST COMPLETED week (Mon-Sun)
 * - Global Competition: Shows THIS WEEK's rankings (in progress)
 * 
 * Usage: node scripts/check-sotw-current-week.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const XpLog = require('../models/XpLog');

// Get LAST COMPLETED week (for SOTW winner display)
function getLastFullWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  // Get LAST week by subtracting 7 days
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  lastWeekMonday.setHours(0, 0, 0, 0);
  
  const lastWeekSunday = new Date(lastWeekMonday);
  lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
  lastWeekSunday.setHours(23, 59, 59, 999);
  
  return { start: lastWeekMonday, end: lastWeekSunday };
}

// Get CURRENT week (for Global Competition leaderboard)
function getCurrentWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  const weekStart = new Date(thisWeekMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(thisWeekMonday);
  weekEnd.setDate(thisWeekMonday.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
}

async function checkSOTW() {
  try {
    console.log('\n🏆 Leaderboard System Check\n');
    console.log('🔌 Connecting to MongoDB...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected\n');

    const now = new Date();
    const lastWeek = getLastFullWeekRange(now);
    const currentWeek = getCurrentWeekRange(now);

    console.log('📅 SOTW (Last Completed Week):');
    console.log(`   Start: ${lastWeek.start.toLocaleDateString()} (${lastWeek.start.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log(`   End:   ${lastWeek.end.toLocaleDateString()} (${lastWeek.end.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log('');
    
    console.log('📅 Global Competition (Current Week):');
    console.log(`   Start: ${currentWeek.start.toLocaleDateString()} (${currentWeek.start.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log(`   End:   ${currentWeek.end.toLocaleDateString()} (${currentWeek.end.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log('\n' + '='.repeat(60) + '\n');

    // Check SOTW (last completed week)
    console.log('🏅 SOTW - Last Week Winner:\n');
    const sotwStats = await XpLog.aggregate([
      {
        $match: {
          timestamp: { $gte: lastWeek.start, $lte: lastWeek.end }
        }
      },
      {
        $group: {
          _id: '$user_id',
          weekly_score: { $sum: '$xp_earned' },
          activity_count: { $sum: 1 }
        }
      },
      {
        $sort: { weekly_score: -1 }
      },
      {
        $limit: 10 // Top 10
      }
    ]);

    if (!sotwStats || sotwStats.length === 0) {
      console.log('   ❌ No XP logs found for last week\n');
      console.log('\n📊 Possible reasons:');
      console.log('   • No users were active this week');
      console.log('   • XpLog collection is empty');
      console.log('   • Week range calculation is incorrect');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('🏅 Weekly Leaderboard (Top 10):\n');

    for (let i = 0; i < xpStats.length; i++) {
      const stat = xpStats[i];
      const user = await User.findById(stat._id).select('name username institution level total_xp badges').lean();

      if (user) {
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `  ${rank}`;
        
        console.log(`${medal} ${user.name || user.username}`);
        console.log(`   📧 Email: ${user._id}`);
        console.log(`   🏢 Institution: ${user.institution || 'N/A'}`);
        console.log(`   ⚡ Weekly XP: ${stat.weekly_score}`);
        console.log(`   📊 Total XP: ${user.total_xp || 0}`);
        console.log(`   📈 Level: ${user.level || 1}`);
        console.log(`   🎯 Activities: ${stat.activity_count}`);
        
        if (rank === 1) {
          console.log(`   🏆 STUDENT OF THE WEEK 🏆`);
          console.log(`   Badges: ${user.badges?.join(', ') || 'None'}`);
        }
        console.log('');
      }
    }

    // Check if SOTW record exists
    console.log('📋 Weekly Winner Record:');
    const WeeklyWinner = require('../models/WeeklyWinner');
    const existingWinner = await WeeklyWinner.findOne({
      startDate: start,
      endDate: end
    }).populate('userId', 'name username email').lean();

    if (existingWinner) {
      console.log(`   ✅ Winner recorded for this week`);
      console.log(`   👤 User: ${existingWinner.userId?.name || existingWinner.userId?.username}`);
      console.log(`   ⚡ Score: ${existingWinner.weeklyScore || xpStats[0]?.weekly_score}`);
      console.log(`   💬 Quote: ${existingWinner.winnerQuote || 'No quote submitted yet'}`);
    } else {
      console.log(`   ⚠️  No winner record found for this week`);
      console.log(`   💡 Tip: Winner record will be created on first query after week ends`);
    }

    // Summary
    console.log('\n📊 Summary:');
    const topUser = await User.findById(xpStats[0]._id).select('name username').lean();
    console.log(`   🏆 This Week's Leader: ${topUser?.name || topUser?.username}`);
    console.log(`   ⚡ XP: ${xpStats[0].weekly_score}`);
    console.log(`   🎯 Activities: ${xpStats[0].activity_count}`);

    console.log('\n✅ Check complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkSOTW();
