// Test script: Ensure daily_login and DAILY_STREAK/STREAK_BONUS are only awarded once per user per day
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const API = process.env.API_URL || 'http://localhost:5000/api/gamification/award';
const USER_TOKEN = process.env.TEST_USER_TOKEN || '';

async function testDailyAward() {
  if (!USER_TOKEN) throw new Error('Set TEST_USER_TOKEN in .env');
  const headers = { Authorization: `Bearer ${USER_TOKEN}` };

  // Try to award daily_login multiple times
  let results = [];
  for (let i = 0; i < 3; i++) {
    const res = await axios.post(API, { activity_type: 'daily_login' }, { headers });
    results.push(res.data.xpAwarded);
  }
  console.log('daily_login awards:', results);

  // Try to award DAILY_STREAK multiple times
  results = [];
  for (let i = 0; i < 3; i++) {
    const res = await axios.post(API, { activity_type: 'DAILY_STREAK' }, { headers });
    results.push(res.data.xpAwarded);
  }
  console.log('DAILY_STREAK awards:', results);

  // Try to trigger STREAK_BONUS (simulate streak = 3 or 7)
  // This requires DB manipulation or a user with streak=2 or 6
  // For now, just check that multiple calls in a day do not double-award
  results = [];
  for (let i = 0; i < 3; i++) {
    const res = await axios.post(API, { activity_type: 'DAILY_STREAK' }, { headers });
    results.push(res.data.xpAwarded);
  }
  console.log('STREAK_BONUS (if eligible) awards:', results);

  console.log('Test complete. Only the first call for each should award XP. Others should be 0.');
}

testDailyAward().catch(e => {
  console.error(e);
  process.exit(1);
});
