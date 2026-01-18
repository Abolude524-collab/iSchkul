const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const XpLog = require('../models/XpLog');

const router = express.Router();

// XP values for different activities
const BASE_XP_MAP = {
  QUIZ_COMPLETE: 10,
  FLASHCARD_COMPLETE: 5,
  NOTE_SUMMARY: 5,
  daily_login: 10,
  quiz_completed: 20,
  flashcard_reviewed: 5,
  group_message: 2,
  file_upload: 15,
};

const DAILY_BASE_CAP = 50;

// Helper functions
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isYesterday(date, now = new Date()) {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  return date >= yesterdayStart && date < todayStart;
}

// Award XP for activities (updated implementation)
router.post('/award', auth, async (req, res) => {
  try {
    const { activity_type } = req.body;
    const userId = req.user._id;

    // Check if user is admin - admins don't earn XP
    if (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'superadmin') {
      return res.json({
        xpAwarded: 0,
        totalXp: req.user.total_xp || 0,
        currentStreak: req.user.current_streak || 0,
        level: req.user.level || 1,
        badges: req.user.badges || [],
        message: 'Admins do not earn XP'
      });
    }

    if (!activity_type) {
      return res.status(400).json({ error: 'activity_type is required' });
    }

    const result = await performAward(userId, activity_type);

    res.json({
      xpAwarded: result.total_awarded,
      totalXp: result.total_xp,
      currentStreak: result.current_streak,
      level: Math.floor(result.total_xp / 100) + 1,
      badges: result.badges
    });
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Central award implementation
async function performAward(user_id, activity_type) {
  const baseXp = BASE_XP_MAP[activity_type] || 0;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const user = await User.findById(user_id);
  if (!user) throw new Error('User not found');

  let totalAwarded = 0;
  const logsToInsert = [];

  // 1. XP Award Logic
  if (baseXp > 0) {
    if (activity_type === 'daily_login') {
      // Special handling for daily login - only award once per day using atomic upsert
      const dailyLoginResult = await XpLog.findOneAndUpdate(
        {
          user_id: user._id,
          activity_type: 'daily_login',
          timestamp: { $gte: todayStart, $lt: todayEnd }
        },
        {
          $setOnInsert: {
            user_id: user._id,
            xp_earned: baseXp,
            activity_type: 'daily_login',
            timestamp: now
          }
        },
        { upsert: true, new: true, rawResult: true }
      );

      // If lastErrorObject.updatedExisting is false, it means we inserted a new doc -> Award!
      if (dailyLoginResult.lastErrorObject && !dailyLoginResult.lastErrorObject.updatedExisting) {
        totalAwarded += baseXp;
      }
    } else if (activity_type === 'quiz_completed' || activity_type === 'FLASHCARD_COMPLETE') {
      logsToInsert.push({ user_id: user._id, xp_earned: baseXp, activity_type, timestamp: now });
      totalAwarded += baseXp;
    } else {
      const todayBase = await XpLog.aggregate([
        { $match: { user_id: user._id, timestamp: { $gte: todayStart, $lt: todayEnd }, activity_type: { $in: ['quiz_completed', 'FLASHCARD_COMPLETE', 'NOTE_SUMMARY', 'flashcard_reviewed', 'group_message', 'file_upload'] } } },
        { $group: { _id: null, xp: { $sum: '$xp_earned' } } }
      ]);
      const todaysXp = todayBase?.[0]?.xp || 0;
      if (todaysXp < DAILY_BASE_CAP) {
        const allowable = Math.min(baseXp, DAILY_BASE_CAP - todaysXp);
        if (allowable > 0) {
          logsToInsert.push({ user_id: user._id, xp_earned: allowable, activity_type, timestamp: now });
          totalAwarded += allowable;
        }
      }
    }
  }

  // 2. Streak Logic (Atomic Upsert to prevent race conditions)
  let streakAwarded = false;
  let newStreak = user.current_streak || 0;

  try {
    // Attempt to atomically insert a DAILY_STREAK log if one doesn't exist for today
    const streakResult = await XpLog.findOneAndUpdate(
      {
        user_id: user._id,
        activity_type: 'DAILY_STREAK',
        timestamp: { $gte: todayStart, $lt: todayEnd }
      },
      {
        $setOnInsert: {
          user_id: user._id,
          activity_type: 'DAILY_STREAK',
          xp_earned: 5,
          timestamp: now
        }
      },
      { upsert: true, new: true, rawResult: true }
    );

    // If lastErrorObject.updatedExisting is false, it means we inserted a new doc -> Award Streak!
    if (streakResult.lastErrorObject && !streakResult.lastErrorObject.updatedExisting) {
      streakAwarded = true;
      totalAwarded += 5; // Base streak XP

      // Update streak count logic
      if (user.last_active_date && isYesterday(new Date(user.last_active_date), now)) {
        newStreak = (user.current_streak || 0) + 1;
      } else {
        newStreak = 1;
      }
      // Bonus for 3 days
      if (newStreak === 3) {
        logsToInsert.push({ user_id: user._id, xp_earned: 10, activity_type: 'STREAK_BONUS', timestamp: now });
        totalAwarded += 10;
      }
    }
  } catch (e) {
    console.error('Streak atomic error', e);
  }

  // Insert other logs (Quiz/Flashcard/Bonus)
  if (logsToInsert.length > 0) {
    await XpLog.insertMany(logsToInsert);
  }

  // Atomic Update to prevent race conditions
  let updatedUser = await User.findOneAndUpdate(
    { _id: user._id },
    {
      $inc: { total_xp: totalAwarded, xp: totalAwarded },
      $set: {
        current_streak: newStreak,
        last_active_date: now,
        lastActive: now
      }
    },
    { new: true }
  );

  // Update level based on total_xp
  const newLevel = Math.floor(updatedUser.total_xp / 100) + 1;
  if (newLevel > updatedUser.level) {
    updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { level: newLevel } },
      { new: true }
    );
  }

  // Check for Badges based on new total
  if (updatedUser.total_xp >= 50 && !updatedUser.badges.includes('ActiveLearner')) {
    updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $addToSet: { badges: 'ActiveLearner' } },
      { new: true }
    );
  }

  return {
    total_awarded: totalAwarded,
    total_xp: updatedUser.total_xp,
    current_streak: updatedUser.current_streak,
    level: updatedUser.level,
    badges: updatedUser.badges
  };
}

// Get leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find({ is_leaderboard_visible: true })
      .select('_id name username institution total_xp level avatar current_streak badges')
      .sort({ total_xp: -1 })
      .limit(50);

    const leaderboard = users.map((user, index) => ({
      id: user._id.toString(),
      _id: user._id.toString(),
      rank: index + 1,
      name: user.name,
      username: user.username,
      institution: user.institution || '',
      total_xp: user.total_xp,
      level: user.level,
      avatar: user.avatar,
      current_streak: user.current_streak,
      badges: user.badges
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user XP history (recent activities)
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const logs = await XpLog.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('xp_earned activity_type timestamp');

    const user = await User.findById(userId).select('total_xp level current_streak');

    res.json({
      currentXp: user.total_xp,
      level: user.level,
      currentStreak: user.current_streak,
      history: logs
    });
  } catch (error) {
    console.error('XP history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user activity stats
router.get('/activity', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('total_xp level current_streak last_active_date badges createdAt');

    // Get today's XP
    const todayStart = startOfDay(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayLogs = await XpLog.find({
      user_id: userId,
      timestamp: { $gte: todayStart, $lt: todayEnd }
    });

    const todaysXp = todayLogs.reduce((sum, log) => sum + log.xp_earned, 0);

    res.json({
      totalXp: user.total_xp,
      level: user.level,
      currentStreak: user.current_streak,
      todaysXp: todaysXp,
      lastActive: user.last_active_date,
      joinDate: user.createdAt,
      badges: user.badges
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get streak information
router.get('/streak', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('current_streak last_active_date');

    // Check if streak is active (last activity was yesterday or today)
    const now = new Date();
    const lastActive = user.last_active_date ? new Date(user.last_active_date) : null;
    const isStreakActive = lastActive && (
      isYesterday(lastActive, now) ||
      startOfDay(lastActive).getTime() === startOfDay(now).getTime()
    );

    res.json({
      currentStreak: user.current_streak || 0,
      lastActiveDate: user.last_active_date,
      isStreakActive: isStreakActive
    });
  } catch (error) {
    console.error('Streak error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User enters the platform (for daily XP and streak tracking)
router.post('/enter', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Award daily login XP if not already awarded today
    await performAward(userId, 'daily_login');

    // Update last active
    await User.findByIdAndUpdate(userId, {
      lastActive: new Date(),
      last_active_date: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Enter error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user badges/awards (placeholder)
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('xp level');
    const badges = [];

    if (user.xp >= 100) badges.push({ name: 'Century Club', description: 'Earned 100 XP' });
    if (user.level >= 2) badges.push({ name: 'Level Up', description: 'Reached level 2' });
    if (user.level >= 5) badges.push({ name: 'Expert', description: 'Reached level 5' });

    res.json({ badges });
  } catch (error) {
    console.error('Badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user awards (placeholder)
router.get('/awards', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('xp level');
    const awards = [];

    if (user.xp >= 500) awards.push({ name: 'XP Master', description: 'Earned 500 XP' });
    if (user.level >= 10) awards.push({ name: 'Elite Learner', description: 'Reached level 10' });

    res.json({ awards });
  } catch (error) {
    console.error('Awards error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join/Leave leaderboard (placeholder - all users are on leaderboard)
router.post('/join-leaderboard', auth, async (req, res) => {
  res.json({ success: true, message: 'Already on leaderboard' });
});

router.post('/leave-leaderboard', auth, async (req, res) => {
  res.json({ success: true, message: 'Cannot leave leaderboard' });
});

// POST /api/gamification/user/enter - called by client on app entry to trigger daily streak logic server-side
router.post('/user/enter', auth, async (req, res) => {
  try {
    const result = await performAward(String(req.user._id), 'APP_ENTRY');
    return res.json(result);
  } catch (err) {
    console.error('[user/enter] error', err);
    return res.status(500).json({ error: 'Failed to process app entry' });
  }
});

module.exports = function(app) {
  // Set the awardXp function for other routes to use
  app.locals.awardXp = performAward;
  return router;
};