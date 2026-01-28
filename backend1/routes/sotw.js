const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

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

// Get CURRENT week (for weekly leaderboard in progress)
function getCurrentWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
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

function uniqueActiveDaysWithinRange(logs, start, end) {
  const days = new Set();
  (logs || []).forEach((log) => {
    const ts = new Date(log.timestamp || log);
    if (ts >= start && ts <= end) {
      const dayStart = new Date(ts);
      dayStart.setHours(0, 0, 0, 0);
      days.add(dayStart.toISOString());
    }
  });
  return days.size;
}

// GET /api/sotw/current
router.get('/current', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
  await client.connect();
  const db = client.db('ischkul');
  const xpLogsCollection = db.collection('xpLogs');
  const usersCollection = db.collection('users');
  const weeklyWinnersCollection = db.collection('weeklyWinners');

  try {
    const now = new Date();
    const { start, end } = getLastFullWeekRange(now);

    // Clean up old SOTW records (older than 2 weeks) to prevent stale data
    await weeklyWinnersCollection.deleteMany({
      end_date: { $lt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }
    });

    // Check if we already have a winner for THIS EXACT week
    const existingWinner = await weeklyWinnersCollection.findOne({
      start_date: start,
      end_date: end
    });

    if (existingWinner && existingWinner.updated_at) {
      // If we have a recent record (updated within last 2 hours), use it
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      if (new Date(existingWinner.updated_at) > twoHoursAgo) {
        const winner = await usersCollection.findOne({ _id: existingWinner.user_id });
        if (winner) {
          res.json({
            success: true,
            winner: {
              user_id: winner._id.toString(),
              name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username || 'Student',
              user: {
                name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username,
                institution: winner.institution,
                profilePicture: winner.profilePicture,
                username: winner.username
              },
              institution: winner.institution || '',
              weekly_score: existingWinner.weekly_score,
              start_date: start,
              end_date: end,
              winner_quote: existingWinner.winner_quote || '',
            }
          });
          return;
        }
      }
    }

    // Always recalculate for this week to ensure fresh data
    const pipeline = [
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 },
    ];

    const agg = await xpLogsCollection.aggregate(pipeline).toArray();
    if (!agg || agg.length === 0) {
      res.json({ success: true, winner: null });
      return;
    }

    const top = agg[0];
    const winner = await usersCollection.findOne({ _id: top._id });
    if (!winner) {
      res.json({ success: true, winner: null });
      return;
    }

    // Get activity logs for streak calculation
    const weekLogs = await xpLogsCollection.find({
      user_id: winner._id,
      timestamp: { $gte: start, $lte: end }
    }, { timestamp: 1 }).toArray();

    const activeDays = uniqueActiveDaysWithinRange(weekLogs, start, end);
    const streakWeekWinner = activeDays >= 7;

    // Update user's SOTW win count and add badge if applicable
    await usersCollection.findOneAndUpdate(
      { _id: winner._id },
      {
        $inc: { sotw_win_count: 1 },
        $addToSet: streakWeekWinner ? { badges: 'StreakWeekWinner' } : {}
      },
      { new: true }
    );

    // Update or create weekly winner record with timestamp for cache control
    const winnerRecord = await weeklyWinnersCollection.findOneAndUpdate(
      { start_date: start, end_date: end },
      {
        $set: {
          user_id: winner._id,
          start_date: start,
          end_date: end,
          weekly_score: top.weekly_score,
          winner_quote: '',
          updated_at: new Date(), // Add timestamp for cache control
          created_at: new Date()
        }
      },
      { upsert: true, new: true, returnDocument: 'after' }
    );

    const winnerData = {
      user_id: winner._id.toString(),
      name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username || 'Student',
      user: {
        name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username,
        institution: winner.institution,
        profilePicture: winner.avatar,
        username: winner.username
      },
      institution: winner.institution || '',
      weekly_score: top.weekly_score,
      start_date: start,
      end_date: end,
      winner_quote: winnerRecord.winner_quote || '',
    };

    res.json({ success: true, winner: winnerData });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
});

// GET /api/sotw/archive
router.get('/archive', async (req, res) => {
  try {
    // Use Mongoose for consistent field naming
    const WeeklyWinner = require('../models/WeeklyWinner');
    const User = require('../models/User');
    
    const winners = await WeeklyWinner.find({})
      .populate('userId', 'name username institution avatar')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const archive = winners.map((winner) => ({
      id: winner._id.toString(),
      name: winner.userId?.name || winner.userId?.username || 'Unknown',
      institution: winner.userId?.institution || '',
      user: {
        name: winner.userId?.name || winner.userId?.username || 'Unknown',
        institution: winner.userId?.institution || '',
        profilePicture: winner.userId?.avatar || '',
        username: winner.userId?.username || ''
      },
      start_date: winner.startDate,
      end_date: winner.endDate,
      weekly_score: winner.weeklyScore,
      winner_quote: winner.winnerQuote || '',
    }));

    res.json({ success: true, archive });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sotw/quote
router.post('/quote', authenticateToken, async (req, res) => {
  const { quote } = req.body;
  if (!quote || !quote.trim()) {
    return res.status(400).json({ error: 'Quote is required' });
  }

  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
  await client.connect();
  const db = client.db('ischkul');
  const weeklyWinnersCollection = db.collection('weeklyWinners');

  try {
    const now = new Date();
    const { start, end } = getLastFullWeekRange(now);

    const currentWinner = await weeklyWinnersCollection.findOne({
      start_date: start,
      end_date: end
    });

    if (!currentWinner) {
      return res.status(404).json({ error: 'No current winner' });
    }

    if (currentWinner.user_id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the current winner can submit a quote' });
    }

    await weeklyWinnersCollection.updateOne(
      { _id: currentWinner._id },
      { $set: { winner_quote: quote.trim() } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
});

// Export helper functions for use in other modules
module.exports = router;
module.exports.getLastFullWeekRange = getLastFullWeekRange;
module.exports.getCurrentWeekRange = getCurrentWeekRange;