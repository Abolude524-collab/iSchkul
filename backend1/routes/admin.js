const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

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

    // In a real implementation, this would send notifications
    // For now, just return success
    console.log(`Admin notification: ${title} - ${message}`);

    res.json({ success: true, message: 'Notification sent to all users' });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;