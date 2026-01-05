const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ users: [] });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    }).select('name username avatar').limit(10);

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;