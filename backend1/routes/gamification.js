const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const XpLog = require('../models/XpLog');
const mongoose = require('mongoose');

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

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function isYesterday(date, now = new Date()) {
  const d = startOfDay(now);
  d.setDate(d.getDate() - 1);
  const yesterdayStart = d.getTime();
  
  const lastStart = startOfDay(date).getTime();
  return lastStart === yesterdayStart;
}

function isToday(date, now = new Date()) {
  return startOfDay(date).getTime() === startOfDay(now).getTime();
}

// Award XP for activities (updated implementation)
router.post('/award', auth, async (req, res) => {
  try {
    const { activity_type, xp_amount, metadata } = req.body;
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

    const result = await performAward(userId, activity_type, xp_amount, metadata);

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
async function performAward(user_id, activity_type, requestXp = null, metadata = null) {
  let baseXp = requestXp || BASE_XP_MAP[activity_type] || 0;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Use a fresh user fetch to avoid some stale data issues, 
  // though we'll use atomic operators ($inc) for the actual update.
  const user = await User.findById(user_id);
  if (!user) throw new Error('User not found');

  let totalAwarded = 0;
  const logsToInsert = [];

  // 1. XP Award Logic
  if (baseXp > 0) {
    if (activity_type === 'daily_login') {
      // --- PRODUCTION-GRADE: Only award once per user per day, even under race conditions ---
      // Use findOneAndUpdate with $setOnInsert and unique index for (user_id, activity_type, day)
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
            timestamp: now,
            metadata: metadata
          }
        },
        { upsert: true, new: true, includeResultMetadata: true }
      );
      // Defensive: Only award if this is the first insert today
      const wasInserted = dailyLoginResult.lastErrorObject && !dailyLoginResult.lastErrorObject.updatedExisting;
      if (wasInserted) {
        totalAwarded += baseXp;
      }
    } else if (['quiz_completed', 'FLASHCARD_COMPLETE', 'QUIZ_COMPLETE'].includes(activity_type)) {
      logsToInsert.push({ user_id: user._id, xp_earned: baseXp, activity_type, timestamp: now, metadata: metadata });
      totalAwarded += baseXp;
    } else {
      // Check daily cap for minor activities
      const todayBase = await XpLog.aggregate([
        { $match: { user_id: user._id, timestamp: { $gte: todayStart, $lt: todayEnd }, activity_type: { $in: ['NOTE_SUMMARY', 'flashcard_reviewed', 'group_message', 'file_upload', 'COMMUNITY_PARTICIPATION', 'AI_TUTOR_USAGE'] } } },
        { $group: { _id: null, xp: { $sum: '$xp_earned' } } }
      ]);
      const todaysXp = todayBase?.[0]?.xp || 0;
      if (todaysXp < DAILY_BASE_CAP) {
        const allowable = Math.min(baseXp, DAILY_BASE_CAP - todaysXp);
        if (allowable > 0) {
          logsToInsert.push({ user_id: user._id, xp_earned: allowable, activity_type, timestamp: now, metadata: metadata });
          totalAwarded += allowable;
        }
      }
    }
  }

  // 2. Streak Logic
  let streakUpdate = {};
  try {
    // Only award DAILY_STREAK once per user per day
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
      { upsert: true, new: true, includeResultMetadata: true }
    );

    const isNewStreakDay = streakResult.lastErrorObject && !streakResult.lastErrorObject.updatedExisting;
    if (isNewStreakDay) {
      totalAwarded += 5; // Base streak XP

      // Calculate new streak count
      let nextStreak = 1;
      if (user.last_active_date) {
        if (isYesterday(user.last_active_date, now)) {
          nextStreak = (user.current_streak || 0) + 1;
        } else if (isToday(user.last_active_date, now)) {
          nextStreak = user.current_streak || 1;
        }
      }
      streakUpdate = { $set: { current_streak: nextStreak } };

      // --- PRODUCTION-GRADE: Only award each STREAK_BONUS once per user per day ---
      if (nextStreak === 3 || nextStreak === 7) {
        const bonusAmount = nextStreak === 3 ? 10 : 50;
        // Check if bonus already awarded today
        const bonusExists = await XpLog.findOne({
          user_id: user._id,
          activity_type: 'STREAK_BONUS',
          timestamp: { $gte: todayStart, $lt: todayEnd },
          xp_earned: bonusAmount
        });
        if (!bonusExists) {
          logsToInsert.push({ user_id: user._id, xp_earned: bonusAmount, activity_type: 'STREAK_BONUS', timestamp: now });
          totalAwarded += bonusAmount;
        }
      }
    }
  } catch (e) {
    console.error('Streak check error:', e);
  }

  // 3. Bulk insert other logs
  if (logsToInsert.length > 0) {
    await XpLog.insertMany(logsToInsert);
  }

  // 4. Atomic Update of User Stats
  const userUpdate = {
    $inc: { xp: totalAwarded, total_xp: totalAwarded },
    $set: { last_active_date: now, lastActive: now },
    ...streakUpdate
  };

  let updatedUser = await User.findOneAndUpdate(
    { _id: user._id },
    userUpdate,
    { new: true }
  );

  // Check for Level Up
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
    // Exclude admins and superadmins from leaderboard
    const users = await User.find({ 
      is_leaderboard_visible: true,
      isAdmin: { $ne: true },
      role: { $nin: ['admin', 'superadmin'] }
    })
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

// Get user XP history (recent activities) - FIXED for XP sync
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    // Fetch XP logs - filter out entries without activity_type
    const logs = await XpLog.find({ user_id: userId, activity_type: { $exists: true, $ne: null } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('xp_earned activity_type timestamp metadata')
      .lean();

    // Get single source of truth - recalculate from logs if mismatch detected
    const user = await User.findById(userId).select('xp total_xp level current_streak');
    
    // Calculate total from logs to verify
    const totalFromLogs = await XpLog.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$xp_earned' } } }
    ]);
    
    const calculatedXp = totalFromLogs[0]?.total || 0;
    const dbXp = user.total_xp || user.xp || 0;
    
    // If mismatch > 30, flag it for repair
    if (Math.abs(calculatedXp - dbXp) > 30) {
      console.warn(`[XP SYNC ALERT] User ${userId}: DB=${dbXp}, Calculated=${calculatedXp}`);
      // Use calculated value as single source of truth
      await User.findByIdAndUpdate(userId, { 
        $set: { xp: calculatedXp, total_xp: calculatedXp } 
      });
    }

    res.json({
      currentXp: calculatedXp || dbXp,
      level: user.level,
      currentStreak: user.current_streak,
      history: logs.map(log => ({
        id: log._id,
        xpEarned: log.xp_earned,
        activityType: log.activity_type || 'UNKNOWN',
        activity_type: log.activity_type || 'UNKNOWN',
        metadata: log.metadata || {},
        timestamp: log.timestamp
      }))
    });
  } catch (error) {
    console.error('XP history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user activity stats - FIXED for dashboard display
router.get('/activity', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('xp total_xp level current_streak last_active_date badges createdAt').lean();

    // Calculate total XP from logs (single source of truth)
    const xpStats = await XpLog.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$xp_earned' } } }
    ]);
    const totalXp = xpStats[0]?.total || 0;

    // Get today's XP
    const todayStart = startOfDay(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayStats = await XpLog.aggregate([
      { 
        $match: { 
          user_id: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: todayStart, $lt: todayEnd }
        }
      },
      { $group: { _id: null, total: { $sum: '$xp_earned' } } }
    ]);
    const todaysXp = todayStats[0]?.total || 0;

    // Sync if mismatch detected
    if (totalXp > 0 && Math.abs(totalXp - (user.total_xp || 0)) > 30) {
      await User.findByIdAndUpdate(userId, { $set: { xp: totalXp, total_xp: totalXp } });
    }

    res.json({
      totalXp: totalXp,
      xp: totalXp,
      level: Math.floor(totalXp / 100) + 1,
      currentStreak: user.current_streak || 0,
      todaysXp: todaysXp,
      lastActive: user.last_active_date,
      joinDate: user.createdAt,
      badges: user.badges || []
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
    const isStreakActive = !!(lastActive && (
      isYesterday(lastActive, now) ||
      isToday(lastActive, now)
    ));

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
    await performAward(userId, 'daily_login', null, { 
      description: 'Welcome back! Your daily learning session has started.',
      client: 'web-app'
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

// Unified statistics endpoint for Dashboard
router.get('/profile-stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const unifiedXp = Math.max(user.xp || 0, user.total_xp || 0);
    
    // Check if streak is active (last activity was yesterday or today)
    const now = new Date();
    const lastActive = user.last_active_date ? new Date(user.last_active_date) : null;
    const isStreakActive = !!(lastActive && (
      isYesterday(lastActive, now) ||
      isToday(lastActive, now)
    ));

    // Calculate real weekly XP
    const weekStart = startOfWeek(now);
    const weekLogs = await XpLog.find({
      user_id: userId,
      timestamp: { $gte: weekStart }
    });
    const weeklyXp = weekLogs.reduce((sum, log) => sum + log.xp_earned, 0);

    // Calculate dynamic badges matching /gamification/badges
    const allBadges = [...(user.badges || [])];
    if (unifiedXp >= 100 && !allBadges.includes('Century Club')) allBadges.push('Century Club');
    if (user.level >= 2 && !allBadges.includes('Level Up')) allBadges.push('Level Up');
    if (user.level >= 5 && !allBadges.includes('Expert')) allBadges.push('Expert');

    res.json({
      xp: unifiedXp,
      totalXp: unifiedXp,
      weeklyXp: weeklyXp,
      level: user.level,
      currentStreak: user.current_streak || 0,
      isStreakActive: !!isStreakActive,
      lastActiveDate: user.last_active_date,
      badges: allBadges,
      badgeCount: allBadges.length,
      achievements: [] // Placeholder for future
    });
  } catch (error) {
    console.error('Profile stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent activity for dashboard
router.get('/recent-activity', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    // Get recent XP logs
    const recentActivity = await XpLog.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('xp_earned activity_type timestamp metadata')
      .lean();

    // Format activity for dashboard
    const formatted = recentActivity.map(log => ({
      id: log._id,
      type: log.activity_type,
      xpEarned: log.xp_earned,
      description: getActivityDescription(log.activity_type),
      timestamp: log.timestamp,
      metadata: log.metadata
    }));

    res.json({
      success: true,
      activities: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to get activity description
function getActivityDescription(activityType) {
  const descriptions = {
    'QUIZ_COMPLETE': 'Completed a quiz',
    'FLASHCARD_COMPLETE': 'Reviewed flashcards',
    'NOTE_SUMMARY': 'Summarized notes',
    'DAILY_STREAK': 'Daily login streak',
    'STREAK_BONUS': 'Streak bonus earned',
    'daily_login': 'Logged in',
    'quiz_completed': 'Quiz completed',
    'flashcard_reviewed': 'Flashcards reviewed',
    'group_message': 'Group message sent',
    'file_upload': 'File uploaded',
    'COMMUNITY_PARTICIPATION': 'Community participation',
    'DOCUMENT_UPLOAD': 'Document uploaded',
    'AI_TUTOR_USAGE': 'Used AI tutor',
    'APP_ENTRY': 'Entered app'
  };
  return descriptions[activityType] || 'Activity completed';
}

module.exports = function(app) {
  // Set the awardXp function for other routes to use
  app.locals.awardXp = performAward;
  return router;
};