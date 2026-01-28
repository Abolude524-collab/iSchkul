#!/usr/bin/env node
/**
 * Check All SOTW Records and Dashboard Data
 */

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkSOTWRecords() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db('ischkul');
    const weeklyWinnersCollection = db.collection('weeklyWinners');
    const usersCollection = db.collection('users');
    const leaderboardCollection = db.collection('leaderboards');

    console.log('🔍 Checking all SOTW-related records\n');

    // 1. Check weeklyWinners collection
    console.log('📋 weeklyWinners collection:');
    const winners = await weeklyWinnersCollection.find({}).sort({ start_date: -1 }).toArray();
    
    if (winners.length === 0) {
      console.log('   (empty)');
    } else {
      for (const w of winners) {
        const user = await usersCollection.findOne({ _id: w.user_id });
        console.log(`   - ${user?.name || 'Unknown'}: ${w.weekly_score} XP`);
        console.log(`     Period: ${new Date(w.start_date).toLocaleDateString()} - ${new Date(w.end_date).toLocaleDateString()}`);
      }
    }

    // 2. Check leaderboards collection for SOTW-related
    console.log('\n📋 leaderboards collection (Weekly):');
    const leaderboards = await leaderboardCollection.find({ title: /Weekly|SOTW/i }).toArray();
    
    if (leaderboards.length === 0) {
      console.log('   (no weekly leaderboards found)');
    } else {
      for (const lb of leaderboards) {
        console.log(`   - ${lb.title}`);
        console.log(`     Status: ${lb.status}`);
        console.log(`     Period: ${new Date(lb.startDate).toLocaleDateString()} - ${new Date(lb.endDate).toLocaleDateString()}`);
      }
    }

    // 3. Check if there's a frontend cache issue or API response
    console.log('\n✨ What the Frontend might be requesting:');
    const now = new Date();
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

    console.log(`   Today: ${now.toLocaleDateString()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]})`);
    console.log(`   Correct THIS WEEK: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);

    const correctRecord = await weeklyWinnersCollection.findOne({
      start_date: weekStart,
      end_date: weekEnd
    });

    if (correctRecord) {
      const user = await usersCollection.findOne({ _id: correctRecord.user_id });
      console.log(`   ✅ Record exists: ${user?.name || 'Unknown'} - ${correctRecord.weekly_score} XP`);
    } else {
      console.log(`   ⚠️  No record for this exact week range`);
    }

    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSOTWRecords();
