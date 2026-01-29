const express = require('express');
const auth = require('../middleware/auth');
const PersonalChat = require('../models/PersonalChat');
const PersonalMessage = require('../models/PersonalMessage');
const User = require('../models/User');
const { sendPushToUser } = require('../utils/pushNotifications');

const router = express.Router();

// Get io instance
let io;
const setIo = (socketIo) => {
  io = socketIo;
};

// Create or get existing personal chat between two users
router.post('/create', auth, async (req, res) => {
  try {
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Check if chat already exists between these users
    const existingChat = await PersonalChat.findOne({
      participants: { $all: [req.user._id, contactId] }
    }).populate('participants', 'name username avatar');

    if (existingChat) {
      const otherParticipant = existingChat.participants.find(p => p._id.toString() !== req.user._id.toString());
      return res.json({
        chat: {
          _id: existingChat._id,
          participants: existingChat.participants.map(p => ({
            _id: p._id,
            name: p.name,
            username: p.username,
            avatar: p.avatar
          })),
          lastMessage: existingChat.lastMessage,
          otherParticipant: otherParticipant ? {
            _id: otherParticipant._id,
            name: otherParticipant.name,
            username: otherParticipant.username,
            avatar: otherParticipant.avatar
          } : null,
          createdAt: existingChat.createdAt
        }
      });
    }

    // Create new chat
    const newChat = new PersonalChat({
      participants: [req.user._id, contactId]
    });

    await newChat.save();
    await newChat.populate('participants', 'name username avatar');

    const otherParticipant = newChat.participants.find(p => p._id.toString() !== req.user._id.toString());

    res.status(201).json({
      chat: {
        _id: newChat._id,
        participants: newChat.participants.map(p => ({
          _id: p._id,
          name: p.name,
          username: p.username,
          avatar: p.avatar
        })),
        lastMessage: newChat.lastMessage,
        otherParticipant: otherParticipant ? {
          _id: otherParticipant._id,
          name: otherParticipant.name,
          username: otherParticipant.username,
          avatar: otherParticipant.avatar
        } : null,
        createdAt: newChat.createdAt
      }
    });
  } catch (error) {
    console.error('Create personal chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all personal chats for the current user
router.get('/list', auth, async (req, res) => {
  try {
    const chats = await PersonalChat.find({
      participants: req.user._id
    })
      .populate('participants', 'name username avatar')
      .populate('lastMessage.sender', 'name username avatar')
      .sort({ updatedAt: -1 });

    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
      return {
        _id: chat._id,
        participants: chat.participants.map(p => ({
          _id: p._id,
          name: p.name,
          username: p.username,
          avatar: p.avatar
        })),
        lastMessage: chat.lastMessage,
        otherParticipant: otherParticipant ? {
          _id: otherParticipant._id,
          name: otherParticipant.name,
          username: otherParticipant.username,
          avatar: otherParticipant.avatar
        } : null,
        createdAt: chat.createdAt
      };
    });

    res.json({
      chats: formattedChats
    });
  } catch (error) {
    console.error('List personal chats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a specific personal chat
router.get('/messages/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is participant in this chat
    const chat = await PersonalChat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    const messages = await PersonalMessage.find({ chatId })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Mark messages as read by current user
    await PersonalMessage.updateMany(
      {
        chatId,
        'readBy.user': { $ne: req.user._id }
      },
      {
        $push: {
          readBy: {
            user: req.user._id,
            readAt: new Date()
          }
        }
      }
    );

    const formattedMessages = messages.reverse().map(message => ({
      _id: message._id,
      senderId: {
        _id: message.sender._id,
        name: message.sender.name,
        username: message.sender.username,
        avatar: message.sender.avatar
      },
      content: message.content,
      messageType: message.messageType,
      timestamp: message.createdAt, // Use timestamp field as expected by frontend
      createdAt: message.createdAt,
      readBy: message.readBy.map(rb => rb.user.toString())
    }));

    res.json({
      messages: formattedMessages,
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Get personal chat messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message in personal chat
router.post('/send/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify user is participant in this chat
    const chat = await PersonalChat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    // Create new message
    const newMessage = new PersonalMessage({
      chatId,
      sender: req.user._id,
      content,
      messageType
    });

    await newMessage.save();
    await newMessage.populate('sender', 'name username avatar');

    // Update chat's last message
    chat.lastMessage = {
      content,
      sender: req.user._id,
      createdAt: new Date(),
      messageType
    };
    await chat.save();

    // Emit real-time message to other participant
    const otherParticipant = chat.participants.find(p => p.toString() !== req.user._id.toString());
    if (io && otherParticipant) {
      io.to(otherParticipant.toString()).emit('personal-message', {
        chatId,
        message: {
          _id: newMessage._id,
          sender: newMessage.sender._id,
          content: newMessage.content,
          messageType: newMessage.messageType,
          timestamp: newMessage.createdAt,
          readBy: newMessage.readBy.map(rb => rb.user.toString())
        }
      });
    }

    // Push notification to recipient (if registered)
    if (otherParticipant) {
      const senderName = newMessage.sender?.name || newMessage.sender?.username || 'New message';
      await sendPushToUser(otherParticipant, {
        title: senderName,
        body: newMessage.content || 'New message received',
        data: { type: 'personal-message', chatId }
      });
    }

    res.status(201).json({
      message: {
        _id: newMessage._id,
        sender: newMessage.sender._id, // Return as string ID
        content: newMessage.content,
        messageType: newMessage.messageType,
        timestamp: newMessage.createdAt, // Use timestamp field
        readBy: newMessage.readBy.map(rb => rb.user.toString())
      }
    });
  } catch (error) {
    console.error('Send personal message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.setIo = setIo;