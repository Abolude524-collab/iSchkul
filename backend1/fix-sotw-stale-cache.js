#!/usr/bin/env node
/**
 * Fix Stale SOTW Cache
 * - Deletes old SOTW records that are showing wrong data
 * - Forces fresh recalculation for last completed week (Jan 20-26, 2026)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const XpLog = require('./models/XpLog');
const User = require('./models/User');
const WeeklyWinner = require('./models/WeeklyWinner');

// Get LAST COMPLETED week (for SOTW winner display)
function getLastFullWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  // Calculate this week's Monday
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  // Get LAST week (completed) by subtracting 7 days
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  lastWeekMonday.setHours(0, 0, 0, 0);
  
  const lastWeekSunday = new Date(lastWeekMonday);
  lastWeekSunday.setDate(lastWeekMonday.getDate() + 6); // Sunday
  lastWeekSunday.setHours(23, 59, 59, 999);
  
  return { start: lastWeekMonday, end: lastWeekSunday };
}

async function fixSOTW() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected to MongoDB');

    const now = new Date();
    const { start, end } = getLastFullWeekRange(now);

    console.log(`\n📅 Last completed week range:`);
    console.log(`   Start: ${start.toISOString()}`);
    console.log(`   End: ${end.toISOString()}`);

    // Step 1: Delete ALL old SOTW records (keep only the one for last week)
    console.log(`\n🗑️  Deleting stale SOTW records...`);
    const oldRecords = await WeeklyWinner.deleteMany({
      $or: [
        { startDate: { $lt: start } },
        { endDate: { $lt: start } }
      ]
    });
    console.log(`   ✅ Deleted ${oldRecords.deletedCount} old records`);

    // Step 2: Get fresh SOTW winner for last week
    console.log(`\n🏆 Calculating SOTW winner for last week...`);
    const xpStats = await XpLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 }
    ]);

    if (!xpStats || xpStats.length === 0) {
      console.log('   ❌ No XP logs found for this week');
      await mongoose.connection.close();
      return;
    }

    const topUser = xpStats[0];
    console.log(`   User ID: ${topUser._id}`);
    console.log(`   XP Earned: ${topUser.weekly_score}`);

    // Step 3: Get user details
    const user = await User.findById(topUser._id);
    console.log(`   Name: ${user.name || user.username}`);
    console.log(`   Institution: ${user.institution}`);

    // Step 4: Create fresh SOTW record
    console.log(`\n📝 Creating fresh SOTW record...`);
    const winner = await WeeklyWinner.findOneAndUpdate(
      { startDate: start, endDate: end },
      {
        userId: topUser._id,
        startDate: start,
        endDate: end,
        weeklyScore: topUser.weekly_score,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log(`   ✅ SOTW record created/updated`);

    // Step 5: Verify in database
    console.log(`\n✔️  Verifying SOTW in database...`);
    const allWinners = await WeeklyWinner.find({}).sort({ startDate: -1 }).limit(5);
    console.log(`   Total SOTW records in DB: ${allWinners.length}`);
    allWinners.forEach(w => {
      console.log(`   - ${w.startDate.toLocaleDateString()} to ${w.endDate.toLocaleDateString()}: ${w.weeklyScore} XP`);
    });

    console.log(`\n✅ SOTW fix complete!`);
    console.log(`\n🔄 To verify the fix, visit: http://localhost:5173 and check the landing page`);
    console.log(`   or call: curl http://localhost:5000/api/sotw/current`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

fixSOTW();
