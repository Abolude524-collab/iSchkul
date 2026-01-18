const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Leaderboard = require('../models/Leaderboard');
const mongoose = require('mongoose');

const router = express.Router();

// Create leaderboard (admin only)
router.post('/create', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, description, durationDays, prizes, isRestricted, allowedUsers } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Convert prize strings to proper format if needed
    const formattedPrizes = (prizes || []).map((prize, index) => ({
      rank: index + 1,
      description: prize
    }));

    const leaderboard = new Leaderboard({
      title,
      description: description || '',
      startDate,
      endDate,
      prizes: formattedPrizes,
      status: 'active',
      isRestricted: isRestricted || false,
      allowedUsers: allowedUsers || [],
      createdBy: req.user._id,
      participantCount: allowedUsers ? allowedUsers.length : 0
    });

    await leaderboard.save();
    await leaderboard.populate('createdBy', 'name email');

    console.log('Leaderboard created:', leaderboard._id);

    res.status(201).json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Create leaderboard error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// List leaderboards
router.get('/list', auth, async (req, res) => {
  try {
    // Fetch from database
    const leaderboards = await Leaderboard.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({
      leaderboards: leaderboards.map(lb => ({
        _id: lb._id,
        title: lb.title,
        description: lb.description,
        startDate: lb.startDate,
        endDate: lb.endDate,
        status: lb.status,
        prizes: lb.prizes,
        isRestricted: lb.isRestricted,
        participantCount: lb.participantCount || lb.allowedUsers.length || 0,
        createdBy: lb.createdBy,
        createdAt: lb.createdAt
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
    
    if (!mongoose.Types.ObjectId.isValid(leaderboardId)) {
      return res.status(400).json({ error: 'Invalid leaderboard ID' });
    }

    const leaderboard = await Leaderboard.findByIdAndUpdate(
      leaderboardId,
      { 
        status: 'ended',
        endedAt: new Date()
      },
      { new: true }
    );

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    console.log('Leaderboard ended:', leaderboardId);

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('End leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active leaderboard (usually the weekly one) - MUST be BEFORE /:id
router.get('/active', auth, async (req, res) => {
  try {
    // First try to find the active weekly leaderboard
    let activeLeaderboard = await Leaderboard.findOne({
      title: 'Weekly Leaderboard',
      status: 'active'
    }).populate('createdBy', 'name email');

    // If no weekly, get any active leaderboard
    if (!activeLeaderboard) {
      activeLeaderboard = await Leaderboard.findOne({
        status: 'active'
      }).populate('createdBy', 'name email');
    }

    if (!activeLeaderboard) {
      return res.status(404).json({ error: 'No active leaderboard' });
    }

    // Get rankings for the active leaderboard
    let users;
    if (activeLeaderboard.isRestricted && activeLeaderboard.allowedUsers && activeLeaderboard.allowedUsers.length > 0) {
      // Restricted leaderboard - only allowed users (exclude admins)
      users = await User.find({
        _id: { $in: activeLeaderboard.allowedUsers },
        $and: [
          { isAdmin: { $ne: true } },
          { role: { $nin: ['admin', 'superadmin'] } }
        ]
      });
    } else {
      // Open leaderboard - all users except admins
      users = await User.find({
        $and: [
          { isAdmin: { $ne: true } },
          { role: { $nin: ['admin', 'superadmin'] } }
        ]
      });
    }

    // Sort users by XP and add rankings
    const rankings = users
      .filter(user => user.xp > 0) // Only include users with XP
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50) // Limit to top 50
      .map((user, index) => ({
        id: user._id.toString(),
        _id: user._id.toString(),
        rank: index + 1,
        name: user.name || user.username || 'Anonymous',
        username: user.username,
        institution: user.institution || '',
        total_xp: user.xp || 0,
        xp: user.xp || 0,
        level: user.level || 0,
        avatar: user.avatar
      }));

    res.json({
      leaderboard: {
        _id: activeLeaderboard._id,
        title: activeLeaderboard.title,
        description: activeLeaderboard.description,
        startDate: activeLeaderboard.startDate,
        endDate: activeLeaderboard.endDate,
        status: activeLeaderboard.status,
        prizes: activeLeaderboard.prizes,
        rankings
      }
    });
  } catch (error) {
    console.error('Get active leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard details
router.get('/:id', auth, async (req, res) => {
  try {
    const leaderboardId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(leaderboardId)) {
      return res.status(400).json({ error: 'Invalid leaderboard ID' });
    }

    const leaderboard = await Leaderboard.findById(leaderboardId)
      .populate('createdBy', 'name email')
      .populate('allowedUsers', 'name username xp level');

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    // Get rankings for this leaderboard
    let users;
    if (leaderboard.isRestricted && leaderboard.allowedUsers.length > 0) {
      // Restricted leaderboard - only allowed users (exclude admins)
      users = await User.find({
        _id: { $in: leaderboard.allowedUsers },
        $and: [
          { isAdmin: { $ne: true } },
          { role: { $nin: ['admin', 'superadmin'] } }
        ]
      })
        .select('name username avatar xp level')
        .sort({ xp: -1 });
    } else {
      // Public leaderboard - all users (exclude admins)
      users = await User.find({
        $and: [
          { isAdmin: { $ne: true } },
          { role: { $nin: ['admin', 'superadmin'] } }
        ]
      })
        .select('name username avatar xp level')
        .sort({ xp: -1 });
    }

    const rankings = users.map((user, index) => ({
      rank: index + 1,
      _id: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      xp: user.xp,
      level: user.level
    }));

    res.json({
      leaderboard,
      rankings
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
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

    // Exclude admins from leaderboard
    const users = await User.find({
      $and: [
        { isAdmin: { $ne: true } },
        { role: { $nin: ['admin', 'superadmin'] } }
      ]
    })
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


// Get user rank
router.get('/rank', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select('xp level');

    // Only count non-admin users for ranking
    const usersAbove = await User.find({
      $and: [
        { isAdmin: { $ne: true } },
        { role: { $nin: ['admin', 'superadmin'] } },
        {
          $or: [
            { xp: { $gt: currentUser.xp } },
            { xp: currentUser.xp, _id: { $lt: req.user._id } }
          ]
        }
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

// Join leaderboard
router.post('/join', auth, async (req, res) => {
  try {
    const { leaderboardId } = req.body;

    // Check if user is admin - admins cannot join leaderboards
    if (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'superadmin') {
      return res.status(403).json({ error: 'Admins cannot join leaderboards' });
    }

    if (!leaderboardId) {
      return res.status(400).json({ error: 'Leaderboard ID is required' });
    }

    const leaderboard = await Leaderboard.findById(leaderboardId);

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    if (leaderboard.status !== 'active') {
      return res.status(400).json({ error: 'Leaderboard is not active' });
    }

    // Check if user is already a participant
    const participantIndex = leaderboard.participants?.findIndex(p => p.toString() === req.user.userId);
    if (participantIndex !== -1 && participantIndex !== undefined) {
      return res.status(400).json({ error: 'Already joined this leaderboard' });
    }

    // Add user to participants
    if (!leaderboard.participants) {
      leaderboard.participants = [];
    }
    leaderboard.participants.push(req.user.userId);
    await leaderboard.save();

    res.json({
      success: true,
      message: 'Successfully joined leaderboard',
      leaderboard: {
        _id: leaderboard._id,
        title: leaderboard.title,
        status: leaderboard.status
      }
    });
  } catch (error) {
    console.error('Join leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave leaderboard
router.post('/leave', auth, async (req, res) => {
  try {
    const { leaderboardId } = req.body;

    // Check if user is admin - admins cannot leave leaderboards (they're not in them)
    if (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'superadmin') {
      return res.status(403).json({ error: 'Admins are not in leaderboards' });
    }

    if (!leaderboardId) {
      return res.status(400).json({ error: 'Leaderboard ID is required' });
    }

    const leaderboard = await Leaderboard.findById(leaderboardId);

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    // Remove user from participants
    if (leaderboard.participants) {
      leaderboard.participants = leaderboard.participants.filter(id => id.toString() !== req.user.userId);
      await leaderboard.save();
    }

    res.json({
      success: true,
      message: 'Successfully left leaderboard'
    });
  } catch (error) {
    console.error('Leave leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard participants
router.get('/participants', auth, async (req, res) => {
  try {
    const { leaderboardId } = req.query;

    if (!leaderboardId) {
      return res.status(400).json({ error: 'Leaderboard ID is required' });
    }

    const leaderboard = await Leaderboard.findById(leaderboardId);

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    // Get participant details
    let participants = [];
    if (leaderboard.participants && leaderboard.participants.length > 0) {
      const users = await User.find({
        _id: { $in: leaderboard.participants },
        $and: [
          { isAdmin: { $ne: true } },
          { role: { $nin: ['admin', 'superadmin'] } }
        ]
      })
        .select('name username avatar xp level')
        .sort({ xp: -1 });

      participants = users.map((user, index) => ({
        id: user._id.toString(),
        rank: index + 1,
        name: user.name || user.username || 'Anonymous',
        avatar: user.avatar,
        xp: user.xp || 0,
        level: user.level || 1
      }));
    }

    res.json({
      participants,
      leaderboard: {
        _id: leaderboard._id,
        title: leaderboard.title,
        participantCount: participants.length
      }
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;