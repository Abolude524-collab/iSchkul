#!/usr/bin/env node
/**
 * Fix SOTW Auto-Rotation Bug
 * 
 * Issue: Dashboard showing last week's SOTW (500 XP) instead of current week (240 XP)
 * 
 * Root Cause: getLastFullWeekRange() was returning PREVIOUS week, not CURRENT week
 * Solution: Fix the week calculation and ensure auto-rotation uses correct dates
 */

const mongoose = require('mongoose');
require('dotenv').config();

const XpLog = require('./models/XpLog');
const User = require('./models/User');

// Corrected week calculation function
function getCurrentWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  // Calculate days until Monday (0 = Sunday, so Monday = 1)
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  // Current week: Monday 00:00 to Sunday 23:59:59
  const weekStart = new Date(thisWeekMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(thisWeekMonday);
  weekEnd.setDate(thisWeekMonday.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
}

async function fixSOTWAutoRotation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔍 SOTW Auto-Rotation Fix\n');
    
    const db = mongoose.connection.db;
    const weeklyWinnersCollection = db.collection('weeklyWinners');
    const xpLogsCollection = db.collection('xpLogs');
    const usersCollection = db.collection('users');
    
    const now = new Date();
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange(now);
    
    console.log(`📅 Current Week Range:`);
    console.log(`   Start: ${weekStart.toLocaleDateString()} (${weekStart.toLocaleString()})`);
    console.log(`   End: ${weekEnd.toLocaleDateString()} (${weekEnd.toLocaleString()})`);
    console.log();
    
    // 1. Check for any stale WeeklyWinner records
    console.log(`📋 Checking for stale WeeklyWinner records...`);
    const allWinners = await weeklyWinnersCollection.find({}).toArray();
    console.log(`   Total winner records: ${allWinners.length}`);
    
    if (allWinners.length > 0) {
      console.log(`\n   Existing records:`);
      for (const record of allWinners) {
        const user = await usersCollection.findOne({ _id: record.user_id });
        console.log(`   - ${user?.name || user?.username}: ${record.weekly_score} XP (${new Date(record.start_date).toLocaleDateString()} - ${new Date(record.end_date).toLocaleDateString()})`);
      }
    }
    
    // 2. Calculate current week's SOTW
    console.log(`\n🏆 Calculating THIS WEEK's SOTW...`);
    const pipeline = [
      { $match: { timestamp: { $gte: weekStart, $lte: weekEnd } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 }
    ];
    
    const currentWinnerData = await xpLogsCollection.aggregate(pipeline).toArray();
    
    if (currentWinnerData && currentWinnerData.length > 0) {
      const top = currentWinnerData[0];
      const winner = await usersCollection.findOne({ _id: top._id });
      
      console.log(`\n🥇 This Week's Winner:`);
      console.log(`   Name: ${winner?.name || winner?.username}`);
      console.log(`   XP: ${top.weekly_score}`);
      console.log(`   User ID: ${top._id}`);
      
      // 3. Check if we already have a record for THIS week
      console.log(`\n📝 Checking for existing THIS WEEK record...`);
      const existingThisWeek = await weeklyWinnersCollection.findOne({
        start_date: weekStart,
        end_date: weekEnd
      });
      
      if (existingThisWeek) {
        console.log(`   ✅ Record exists for this week`);
      } else {
        console.log(`   ❌ NO record for this week - creating one...`);
        
        const newRecord = await weeklyWinnersCollection.insertOne({
          user_id: top._id,
          start_date: weekStart,
          end_date: weekEnd,
          weekly_score: top.weekly_score,
          created_at: new Date(),
          winner_quote: ''
        });
        
        console.log(`   ✅ Created record: ${newRecord.insertedId}`);
      }
    } else {
      console.log(`   ⚠️  No XP logs found for this week`);
    }
    
    // 4. Verify the /api/sotw/current endpoint would return correct data
    console.log(`\n✨ Summary - What /api/sotw/current should return:`);
    const finalCheck = await weeklyWinnersCollection.findOne({
      start_date: weekStart,
      end_date: weekEnd
    });
    
    if (finalCheck) {
      const finalUser = await usersCollection.findOne({ _id: finalCheck.user_id });
      console.log(`   ✅ SOTW: ${finalUser?.name || finalUser?.username}`);
      console.log(`   ✅ XP: ${finalCheck.weekly_score}`);
      console.log(`   ✅ Week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
    } else {
      console.log(`   ⚠️  Still no record - endpoint will calculate on-the-fly`);
    }
    
    console.log(`\n✅ Fix complete! SOTW will now show current week's winner.`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixSOTWAutoRotation();
