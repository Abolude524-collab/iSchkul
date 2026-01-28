const express = require('express');
const auth = require('../middleware/auth');
const PushToken = require('../models/PushToken');

const router = express.Router();

// Register or update push token
router.post('/register', auth, async (req, res) => {
  try {
    const { token, platform, deviceId } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const updated = await PushToken.findOneAndUpdate(
      { token },
      {
        userId: req.user._id,
        platform: platform || 'unknown',
        deviceId: deviceId || null,
        lastActive: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, tokenId: updated._id });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unregister push token
router.delete('/unregister', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    await PushToken.deleteOne({ token, userId: req.user._id });

    res.json({ success: true });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;