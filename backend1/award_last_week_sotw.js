const mongoose = require('mongoose');
const User = require('./models/User');
const XpLog = require('./models/XpLog');
const WeeklyWinner = require('./models/WeeklyWinner');
const Badge = require('./models/Badge');
require('dotenv').config();

async function awardLastWeekSOTW() {
  try {
    console.log('\n🎯 Awarding Last Week SOTW...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    
    // Last week's range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffToMonday = (today.getDay() + 6) % 7;
    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() - diffToMonday);
    const lastWeekEnd = new Date(thisWeekMonday);
    lastWeekEnd.setMilliseconds(-1);
    const lastWeekStart = new Date(thisWeekMonday);
    lastWeekStart.setDate(thisWeekMonday.getDate() - 7);
    
    console.log('📅 Last Week Range:');
    console.log('   Start: ' + lastWeekStart.toISOString().split('T')[0]);
    console.log('   End: ' + lastWeekEnd.toISOString().split('T')[0] + '\n');
    
    // Find top user from XP logs
    const pipeline = [
      { $match: { timestamp: { $gte: lastWeekStart, $lte: lastWeekEnd } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 }
    ];
    
    const agg = await XpLog.aggregate(pipeline);
    if (!agg.length) {
      console.log('❌ No XP logs found for last week');
      await mongoose.connection.close();
      return;
    }
    
    const topUser = agg[0];
    const user = await User.findById(topUser._id);
    
    console.log('🏆 Winner Found:');
    console.log('   Name: ' + user.name);
    console.log('   Username: ' + user.username);
    console.log('   XP Earned Last Week: ' + topUser.weekly_score + '\n');
    
    // Create WeeklyWinner record
    const winner = await WeeklyWinner.findOneAndUpdate(
      { startDate: lastWeekStart, endDate: lastWeekEnd },
      {
        userId: topUser._id,
        startDate: lastWeekStart,
        endDate: lastWeekEnd,
        weeklyScore: topUser.weekly_score,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Increment user's SOTW win count
    const updatedUser = await User.findByIdAndUpdate(topUser._id, {
      $inc: { sotwWinCount: 1 }
    }, { new: true });
    
    // Award SOTW badge
    await Badge.create({
      userId: topUser._id,
      type: 'sotw',
      name: 'Student of the Week',
      description: `Achieved Student of the Week with ${topUser.weekly_score} XP (${lastWeekStart.toLocaleDateString()} - ${lastWeekEnd.toLocaleDateString()})`,
      icon: '🏆',
      awardedDate: new Date(),
      metadata: {
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        xpEarned: topUser.weekly_score,
        reason: 'Highest XP earner last week'
      }
    });
    
    console.log('✅ WeeklyWinner record created!');
    console.log('✅ User SOTW win count incremented to: ' + updatedUser.sotwWinCount);
    console.log('✅ SOTW badge awarded!\n');
    console.log('\n========== SUCCESS ==========\n');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

awardLastWeekSOTW();
