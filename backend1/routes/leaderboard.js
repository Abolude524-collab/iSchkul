const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Create leaderboard (admin only)
router.post('/create', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, description, durationDays, prizes, isRestricted, allowedUsers } = req.body;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Create leaderboard object (you might want to create a Leaderboard model)
    const leaderboard = {
      _id: require('mongoose').Types.ObjectId(),
      title,
      description: description || '',
      startDate,
      endDate,
      prizes: prizes || [],
      status: 'active',
      isRestricted: isRestricted || false,
      allowedUsers: allowedUsers || [],
      createdBy: req.user._id,
      createdAt: new Date()
    };

    // For now, store in memory or you can create a proper Leaderboard model
    // This is a simplified implementation
    if (!global.leaderboards) {
      global.leaderboards = [];
    }
    global.leaderboards.push(leaderboard);

    res.status(201).json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Create leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List leaderboards
router.get('/list', auth, async (req, res) => {
  try {
    // Return stored leaderboards (in production, fetch from database)
    const leaderboards = global.leaderboards || [];

    res.json({
      leaderboards: leaderboards.map(lb => ({
        ...lb,
        participantCount: lb.allowedUsers ? lb.allowedUsers.length : 0
      }))
    });
  } catch (error) {
    console.error('List leaderboards error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// End leaderboard (admin only)
router.post('/end/:id', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const leaderboardId = req.params.id;
    const leaderboards = global.leaderboards || [];
    const leaderboard = leaderboards.find(lb => lb._id.toString() === leaderboardId);

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    leaderboard.status = 'ended';
    leaderboard.endedAt = new Date();

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('End leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 10, sortBy = 'xp' } = req.query;

    let sortCriteria = { xp: -1 };
    if (sortBy === 'level') {
      sortCriteria = { level: -1, xp: -1 };
    }

    const users = await User.find({})
      .select('name username avatar xp level')
      .sort(sortCriteria)
      .limit(parseInt(limit));

    res.json({
      leaderboard: users.map((user, index) => ({
        rank: index + 1,
        ...user.toObject()
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's rank
router.get('/rank', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select('xp level');

    const usersAbove = await User.find({
      $or: [
        { xp: { $gt: currentUser.xp } },
        { xp: currentUser.xp, _id: { $lt: req.user._id } }
      ]
    }).countDocuments();

    res.json({
      rank: usersAbove + 1,
      xp: currentUser.xp,
      level: currentUser.level
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;