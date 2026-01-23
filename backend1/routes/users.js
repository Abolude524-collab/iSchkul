const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { transformUserAvatar, transformUsersAvatar } = require('../middleware/avatarTransform');

const router = express.Router();

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    console.log('[User Search] Query:', q);
    console.log('[User Search] Current user ID:', req.user._id);
    
    if (!q) {
      console.log('[User Search] No query provided, returning empty array');
      return res.json({ users: [] });
    }

    // First check total users in database
    const totalUsers = await User.countDocuments();
    console.log('[User Search] Total users in database:', totalUsers);

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    }).select('name username email avatar').limit(10);

    console.log('[User Search] Found', users.length, 'users matching query:', q);
    console.log('[User Search] Results:', users.map(u => ({ id: u._id, name: u.name, username: u.username, email: u.email })));

    const transformedUsers = transformUsersAvatar(users);
    res.json({ users: transformedUsers });
  } catch (error) {
    console.error('[User Search] Error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get current user's chat profile
router.get('/chat-profile', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('name username chatAbout chatAvatar avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser, bio: transformedUser.chatAbout, status: transformedUser.chatAvatar });
  } catch (error) {
    console.error('Get chat profile error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Update chat profile
router.put('/chat-profile', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { bio, status, chatAbout, chatAvatar } = req.body;
    // Support both bio/status and chatAbout/chatAvatar naming
    const updateData = {
      chatAbout: bio || chatAbout,
      chatAvatar: status || chatAvatar
    };
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser, bio: transformedUser.chatAbout, status: transformedUser.chatAvatar });
  } catch (error) {
    console.error('Update chat profile error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get user profile
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific user's chat profile by ID
router.get('/:id/chat-profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name username chatAbout chatAvatar avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser });
  } catch (error) {
    console.error('Get user chat profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user badges
router.get('/:userId/badges', async (req, res) => {
  try {
    const badges = await Badge.find({ userId: req.params.userId })
      .sort({ awardedDate: -1 })
      .lean();

    res.json({ success: true, badges });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's badges
router.get('/badges/my', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const badges = await Badge.find({ userId })
      .sort({ awardedDate: -1 })
      .lean();

    res.json({ success: true, badges });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;