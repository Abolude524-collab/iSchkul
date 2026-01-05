const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Award XP for activities
router.post('/award', auth, async (req, res) => {
  try {
    const { activity_type } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Award XP based on activity type
    let xpToAward = 0;
    switch (activity_type) {
      case 'daily_login':
        xpToAward = 10;
        break;
      case 'quiz_completed':
        xpToAward = 20;
        break;
      case 'flashcard_reviewed':
        xpToAward = 5;
        break;
      case 'group_message':
        xpToAward = 2;
        break;
      case 'file_upload':
        xpToAward = 15;
        break;
      default:
        xpToAward = 5;
    }

    user.xp += xpToAward;

    // Level up logic (simple: every 100 XP = 1 level)
    const newLevel = Math.floor(user.xp / 100) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
    }

    await user.save();

    res.json({
      xpAwarded: xpToAward,
      totalXp: user.xp,
      level: user.level
    });
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find({})
      .select('name username xp level avatar')
      .sort({ xp: -1 })
      .limit(50);

    res.json({ leaderboard: users });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user XP history (simplified - just return current stats)
router.get('/history', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('xp level');
    res.json({
      currentXp: user.xp,
      level: user.level,
      history: [] // Could be expanded to track actual history
    });
  } catch (error) {
    console.error('XP history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user activity stats
router.get('/activity', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('xp level createdAt lastActive');
    res.json({
      totalXp: user.xp,
      level: user.level,
      joinDate: user.createdAt,
      lastActive: user.lastActive
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User enters the platform (for daily XP)
router.post('/enter', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.lastActive = new Date();
    await user.save();

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

module.exports = router;