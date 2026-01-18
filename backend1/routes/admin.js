const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Notification = require('../models/Notification');
const XpLog = require('../models/XpLog');
const WeeklyWinner = require('../models/WeeklyWinner');

const router = express.Router();

// Get io instance
let io;
const setIo = (socketIo) => {
  io = socketIo;
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Make user admin
router.post('/users/role', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = role;
    user.isAdmin = role === 'admin' || role === 'superadmin';
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('username email name role isAdmin xp level createdAt lastActive')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get analytics overview
router.get('/analytics/overview', auth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const adminUsers = await User.countDocuments({ isAdmin: true });

    // Mock additional analytics data
    const analytics = {
      totalUsers,
      activeUsers,
      adminUsers,
      totalQuizzes: 0, // Would need Quiz model
      totalFlashcards: 0, // Would need Flashcard model
      totalGroups: 0, // Would need Group model
      recentActivity: []
    };

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send notification to all users (placeholder)
router.post('/notifications/send', auth, requireAdmin, async (req, res) => {
  try {
    const { title, message, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    // Get all non-admin users
    const users = await User.find({
      $and: [
        { isAdmin: { $ne: true } },
        { role: { $nin: ['admin', 'superadmin'] } }
      ]
    }).select('_id');

    // Create notifications for all users
    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      type: type || 'info',
      createdBy: req.user._id
    }));

    await Notification.insertMany(notifications);

    console.log(`Admin notification sent to ${users.length} users: ${title} - ${message}`);

    // Emit real-time notification to all users
    if (io) {
      users.forEach(user => {
        io.to(user._id.toString()).emit('new-notification', {
          title,
          message,
          type: type || 'info',
          createdAt: new Date(),
          createdBy: { name: req.user.name || 'Admin' }
        });
      });
    }

    res.json({
      success: true,
      message: `Notification sent to ${users.length} users`,
      recipientCount: users.length
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get sent notifications history (admin only)
router.get('/notifications/sent', auth, requireAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const notifications = await Notification.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('createdBy', 'name username');

    const totalCount = await Notification.countDocuments({ createdBy: req.user._id });

    // Group by title/message to show unique notifications with recipient count
    const groupedNotifications = notifications.reduce((acc, notification) => {
      const key = `${notification.title}-${notification.message}-${notification.type}`;
      if (!acc[key]) {
        acc[key] = {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          createdAt: notification.createdAt,
          recipientCount: 0,
          readCount: 0
        };
      }
      acc[key].recipientCount++;
      if (notification.isRead) {
        acc[key].readCount++;
      }
      return acc;
    }, {});

    const sentNotifications = Object.values(groupedNotifications);

    res.json({
      notifications: sentNotifications,
      totalCount: sentNotifications.length
    });
  } catch (error) {
    console.error('Get sent notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * XP SYNC ENDPOINTS - Admin tools for fixing gamification data
 */

// POST /api/admin/sync-xp - Sync single user's XP with XP logs
router.post('/sync-xp', auth, requireAdmin, async (req, res) => {
  try {
    console.log('[admin-sync-xp] Starting XP sync');
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Get all XP logs for user
    const xpLogs = await XpLog.find({ user_id: userId });
    const totalXp = xpLogs.reduce((sum, log) => sum + (log.xp_earned || 0), 0);

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        xp: totalXp,
        level: Math.floor(Math.sqrt(totalXp / 100)) + 1
      },
      { new: true }
    );

    console.log(`[admin-sync-xp] User ${userId} synced: ${totalXp} XP, Level ${user.level}`);

    res.json({
      success: true,
      message: `Synced user ${userId}`,
      data: {
        userId,
        xp: totalXp,
        level: user.level,
        logsCount: xpLogs.length
      }
    });
  } catch (error) {
    console.error('[admin-sync-xp] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/sync-all-xp - Sync ALL users' XP with XP logs
router.post('/sync-all-xp', auth, requireAdmin, async (req, res) => {
  try {
    console.log('[admin-sync-all-xp] Starting full XP sync');

    const users = await User.find({
      role: { $nin: ['admin', 'superadmin'] }
    });

    const results = [];
    for (const user of users) {
      const xpLogs = await XpLog.find({ user_id: user._id });
      const totalXp = xpLogs.reduce((sum, log) => sum + (log.xp_earned || 0), 0);
      const newLevel = Math.floor(Math.sqrt(totalXp / 100)) + 1;

      if (user.xp !== totalXp) {
        await User.findByIdAndUpdate(user._id, {
          xp: totalXp,
          level: newLevel
        });

        results.push({
          userId: user._id,
          name: user.name,
          oldXp: user.xp,
          newXp: totalXp,
          change: totalXp - user.xp
        });
      }
    }

    console.log(`[admin-sync-all-xp] Synced ${results.length} users`);

    res.json({
      success: true,
      message: `Synced ${results.length} users out of ${users.length}`,
      synced: results.length,
      total: users.length,
      changes: results
    });
  } catch (error) {
    console.error('[admin-sync-all-xp] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/recalculate-sotw - Recalculate Student of the Week
router.post('/recalculate-sotw', auth, requireAdmin, async (req, res) => {
  try {
    console.log('[admin-recalculate-sotw] Starting SOTW recalculation');

    async function getWeekRange() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffToMonday = (today.getDay() + 6) % 7;
      const thisWeekMonday = new Date(today);
      thisWeekMonday.setDate(today.getDate() - diffToMonday);
      const lastWeekEnd = new Date(thisWeekMonday);
      lastWeekEnd.setMilliseconds(-1);
      const lastWeekStart = new Date(thisWeekMonday);
      lastWeekStart.setDate(thisWeekMonday.getDate() - 7);
      return { start: lastWeekStart, end: lastWeekEnd };
    }

    const { start, end } = await getWeekRange();

    // Get top user by XP logs this week
    const pipeline = [
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 }
    ];

    const agg = await XpLog.aggregate(pipeline);
    if (!agg.length) {
      return res.json({ success: true, message: 'No XP logs found for this week' });
    }

    const topUser = agg[0];
    const user = await User.findById(topUser._id);

    // Update or create WeeklyWinner
    const winner = await WeeklyWinner.findOneAndUpdate(
      { startDate: start, endDate: end },
      {
        userId: topUser._id,
        startDate: start,
        endDate: end,
        weeklyScore: topUser.weekly_score,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Update user's SOTW count
    await User.findByIdAndUpdate(topUser._id, {
      $inc: { sotwWinCount: 1 }
    });

    // Award SOTW badge
    const Badge = require('../models/Badge');
    await Badge.create({
      userId: topUser._id,
      type: 'sotw',
      name: 'Student of the Week',
      description: `Achieved Student of the Week with ${topUser.weekly_score} XP (${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()})`,
      icon: '🏆',
      awardedDate: new Date(),
      metadata: {
        weekStart: start,
        weekEnd: end,
        xpEarned: topUser.weekly_score,
        reason: 'Highest XP earner this week'
      }
    });

    console.log(`[admin-recalculate-sotw] Winner: ${user?.name} with ${topUser.weekly_score} XP`);

    res.json({
      success: true,
      message: 'SOTW recalculated',
      winner: {
        name: user?.name,
        userId: topUser._id,
        weeklyScore: topUser.weekly_score,
        startDate: start,
        endDate: end
      }
    });
  } catch (error) {
    console.error('[admin-recalculate-sotw] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/xp-debug/:userId - Debug XP sync for specific user
router.get('/xp-debug/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('name username xp level');
    const xpLogs = await XpLog.find({ user_id: userId }).sort({ timestamp: -1 }).limit(20);
    const totalXpFromLogs = xpLogs.reduce((sum, log) => sum + (log.xp_earned || 0), 0);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        xp: user.xp,
        level: user.level
      },
      xpLogs: {
        count: xpLogs.length,
        total: totalXpFromLogs,
        latest: xpLogs[0] ? {
          amount: xpLogs[0].xp_earned,
          type: xpLogs[0].activity_type,
          date: xpLogs[0].timestamp
        } : null
      },
      discrepancy: user.xp - totalXpFromLogs,
      needsSync: Math.abs(user.xp - totalXpFromLogs) > 5
    });
  } catch (error) {
    console.error('[admin-xp-debug] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.setIo = setIo;