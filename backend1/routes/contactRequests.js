const express = require('express');
const auth = require('../middleware/auth');
const ContactRequest = require('../models/ContactRequest');
const User = require('../models/User');
const { sendPushToUser } = require('../utils/pushNotifications');

const router = express.Router();

// Get io instance
let io;
const setIo = (socketIo) => {
  io = socketIo;
};
module.exports.setIo = setIo;

// Send contact request
router.post('/send', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID required' });
    }

    if (recipientId === req.user._id) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    // Check if request already exists
    const existingRequest = await ContactRequest.findOne({
      $or: [
        { sender: req.user._id, recipient: recipientId },
        { sender: recipientId, recipient: req.user._id }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    const request = new ContactRequest({
      sender: req.user._id,
      recipient: recipientId
    });

    await request.save();

    // Populate sender info
    await request.populate('sender', 'name username');

    // Emit notification to recipient
    if (io) {
      io.to(recipientId.toString()).emit('contact-request', request);
    }

    // Send push notification to recipient (if registered)
    await sendPushToUser(recipientId, {
      title: 'New Friend Request',
      body: `${request.sender?.name || request.sender?.username || 'Someone'} sent you a friend request`,
      data: { type: 'contact-request', requestId: request._id }
    });

    res.json({ request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get received requests
router.get('/received', auth, async (req, res) => {
  try {
    const requests = await ContactRequest.find({
      recipient: req.user._id,
      status: 'pending'
    }).populate('sender', 'name username avatar chatAvatar');

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get sent requests
router.get('/sent', auth, async (req, res) => {
  try {
    const requests = await ContactRequest.find({
      sender: req.user._id,
      status: 'pending'
    }).populate('recipient', 'name username avatar chatAvatar');

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept request
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const request = await ContactRequest.findOne({
      _id: req.params.id,
      recipient: req.user._id,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.status = 'accepted';
    await request.save();

    // Create a personal chat room
    // Assuming there's a PersonalChat model
    // For now, just return success - frontend can create chat when needed

    // Emit to sender
    if (io) {
      io.to(request.sender.toString()).emit('request-accepted', request);
    }

    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject request
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const request = await ContactRequest.findOne({
      _id: req.params.id,
      recipient: req.user._id,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.status = 'rejected';
    await request.save();

    // Emit to sender
    if (io) {
      io.to(request.sender.toString()).emit('request-rejected', request);
    }

    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.setIo = setIo;