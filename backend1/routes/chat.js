const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Mock data for demo - in production, use database
let messages = [
  {
    _id: '1',
    content: 'Welcome to the group chat!',
    sender: { _id: '1', name: 'System', avatar: '' },
    groupId: '1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    type: 'text'
  }
];

// Get messages for a group
router.get('/messages/:groupId', auth, (req, res) => {
  try {
    const { groupId } = req.params;
    const groupMessages = messages.filter(msg => msg.groupId === groupId);
    res.json({ messages: groupMessages });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message to group
router.post('/send', auth, (req, res) => {
  try {
    const { content, groupId, type = 'text' } = req.body;

    if (!content || !groupId) {
      return res.status(400).json({ error: 'Content and groupId are required' });
    }

    const newMessage = {
      _id: Date.now().toString(),
      content,
      sender: {
        _id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar
      },
      groupId,
      createdAt: new Date().toISOString(),
      type
    };

    messages.push(newMessage);

    // In production, emit to socket.io here
    // io.to(groupId).emit('new-message', newMessage);

    res.status(201).json({ message: newMessage });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get online users (mock)
router.get('/online', auth, (req, res) => {
  // Mock online users
  res.json({
    onlineUsers: [
      { _id: '1', name: 'John Doe', isOnline: true },
      { _id: '2', name: 'Jane Smith', isOnline: true }
    ]
  });
});

module.exports = router;