const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
require('express-async-errors'); // Must be required before any routes
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet()); // Basic security headers
app.use(compression()); // Compress responses
app.use(morgan('dev')); // Logging
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
      // Removed deprecated options (useNewUrlParser, useUnifiedTopology)
      // These are defaults in Mongoose 6+
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectDB();

// Initialize weekly leaderboard
async function initializeWeeklyLeaderboard() {
  try {
    const Leaderboard = require('./models/Leaderboard');

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    // Check if there's already an active weekly leaderboard
    const existingWeekly = await Leaderboard.findOne({
      title: 'Weekly Leaderboard',
      status: 'active'
    });

    if (!existingWeekly) {
      const weeklyLeaderboard = new Leaderboard({
        title: 'Weekly Leaderboard',
        description: 'Compete with others this week! 🏆',
        startDate: startOfWeek,
        endDate: endOfWeek,
        prizes: [
          { rank: 1, description: '🥇 1st Place - 500 XP Bonus' },
          { rank: 2, description: '🥈 2nd Place - 300 XP Bonus' },
          { rank: 3, description: '🥉 3rd Place - 100 XP Bonus' }
        ],
        status: 'active',
        isRestricted: false,
        allowedUsers: [],
        createdBy: null, // System created
        participantCount: 0
      });

      await weeklyLeaderboard.save();
      console.log('✅ Weekly leaderboard created for week of', startOfWeek.toLocaleDateString());
    } else {
      console.log('✅ Active weekly leaderboard already exists');
    }
  } catch (error) {
    console.error('Error initializing weekly leaderboard:', error);
  }
}

// Autonomous weekly leaderboard end/rotation (runs every 24 hours)
async function checkAndRotateWeeklyLeaderboard() {
  try {
    const Leaderboard = require('./models/Leaderboard');
    const User = require('./models/User');

    const now = new Date();

    // Find active weekly leaderboard that has passed its end date
    const expiredWeekly = await Leaderboard.findOne({
      title: 'Weekly Leaderboard',
      status: 'active',
      endDate: { $lt: now }
    });

    if (expiredWeekly) {
      console.log('⏰ Ending expired weekly leaderboard...');

      // Get top 3 participants by XP
      const topUsers = await User.find({
        isAdmin: { $ne: true },
        role: { $nin: ['admin', 'superadmin'] }
      })
        .sort({ xp: -1 })
        .limit(3);

      // Record winners
      const winners = topUsers.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        xp: user.xp,
        prizeDescription: expiredWeekly.prizes[index]?.description || 'Participant'
      }));

      // Update leaderboard with winners and end it
      await Leaderboard.findByIdAndUpdate(expiredWeekly._id, {
        status: 'ended',
        endedAt: now,
        winners: winners
      });

      console.log('✅ Weekly leaderboard ended. Winners recorded:', winners.length);

      // Create new weekly leaderboard for the next week
      await initializeWeeklyLeaderboard();
    }
  } catch (error) {
    console.error('Error rotating weekly leaderboard:', error);
  }
}

// Initialize on startup
initializeWeeklyLeaderboard();

// Check every hour if we need to rotate the weekly leaderboard
setInterval(checkAndRotateWeeklyLeaderboard, 60 * 60 * 1000);

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/personal-chat', require('./routes/personal-chat'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/files', require('./routes/files'));
app.use('/api/generate', require('./routes/generate'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/sotw', require('./routes/sotw'));
app.use('/api/gamification', require('./routes/gamification')(app));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/contact-requests', require('./routes/contactRequests'));
app.use('/api', require('./routes/notifications'));
app.use('/api/flashcard-sets', require('./routes/flashcard-sets'));
app.use('/api/flashcards', require('./routes/flashcards'));
app.use('/api/xp-history', require('./routes/xpHistory'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/co-reader', require('./routes/coReader'));

// Set io for routes that need it
require('./routes/contactRequests').setIo(io);
require('./routes/admin').setIo(io);
require('./routes/personal-chat').setIo(io);
require('./routes/groups').setIo(io);

// Socket.io for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-user', (userId) => {
    socket.join(userId);
  });

  socket.on('join-group', (groupId) => {
    socket.join(groupId);
  });

  socket.on('leave-group', (groupId) => {
    socket.leave(groupId);
  });

  socket.on('send-message', (data) => {
    io.to(data.groupId).emit('new-message', data.message);
  });

  // === WebRTC Call Signaling (Google Meet/Zoom style) ===

  // Step 1: Initiate personal call - send to specific user
  socket.on('initiate-personal-call', ({ callerId, callerName, recipientId, roomId, isGroup }) => {
    console.log(`[CALL] ${callerName} (${callerId}) initiating personal call to ${recipientId}, room: ${roomId}`);

    // Send call invitation to recipient
    io.to(recipientId).emit('call-incoming', {
      callerId,
      callerName,
      roomId,
      isGroup: false,
      timestamp: Date.now()
    });
  });

  // Step 1b: Initiate group call - send to all group members
  socket.on('initiate-group-call', ({ callerId, callerName, groupId, groupName }) => {
    console.log(`[CALL] ${callerName} (${callerId}) initiating group call in ${groupId} (${groupName})`);

    // Send call invitation to all members in the group room
    io.to(groupId).emit('call-incoming', {
      callerId,
      callerName,
      roomId: groupId,
      isGroup: true,
      timestamp: Date.now()
    });
  });

  // Step 2: Recipient accepts the call
  socket.on('accept-call', ({ callerId, recipientId, roomId }) => {
    console.log(`[CALL] ${recipientId} accepted personal call from ${callerId}, room: ${roomId}`);

    // Notify caller that call was accepted
    io.to(callerId).emit('call-accepted', {
      recipientId,
      roomId
    });
  });

  // Step 2b: Group member accepts group call
  socket.on('accept-group-call', ({ callerId, userId, groupId }) => {
    console.log(`[CALL] ${userId} accepted group call initiated by ${callerId}, group: ${groupId}`);

    // Notify all members that someone joined
    io.to(groupId).emit('group-call-user-accepted', {
      userId,
      callerId
    });
  });

  // Step 3: Recipient declines the call
  socket.on('decline-call', ({ callerId, recipientId, roomId }) => {
    console.log(`[CALL] ${recipientId} declined personal call from ${callerId}`);

    // Notify caller
    io.to(callerId).emit('call-declined', {
      recipientId,
      roomId
    });
  });

  // Step 3b: Group member declines group call
  socket.on('decline-group-call', ({ callerId, userId, groupId }) => {
    console.log(`[CALL] ${userId} declined group call initiated by ${callerId}`);

    // Notify all members that someone declined
    io.to(groupId).emit('group-call-user-declined', {
      userId
    });
  });

  // Step 4: Join call room (both participants)
  socket.on('join-call', ({ roomId, userId, isPersonalChat }) => {
    console.log(`[CALL] User ${userId} joining call room: ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit('call-user-joined', { userId, roomId });
  });

  socket.on('join-personal-chat', (chatId) => {
    console.log(`[CHAT] User joining personal chat room: ${chatId}`);
    socket.join(chatId);
  });

  socket.on('leave-call', ({ roomId, userId }) => {
    console.log(`[CALL] User ${userId} leaving call room: ${roomId}`);
    socket.leave(roomId);
    socket.to(roomId).emit('call-user-left', { userId });
  });

  socket.on('call-offer', ({ to, offer, roomId }) => {
    socket.to(roomId).emit('call-offer', {
      from: socket.id,
      offer
    });
  });

  socket.on('call-answer', ({ to, answer, roomId }) => {
    socket.to(roomId).emit('call-answer', {
      from: socket.id,
      answer
    });
  });

  socket.on('call-ice-candidate', ({ to, candidate, roomId }) => {
    socket.to(roomId).emit('call-ice-candidate', {
      from: socket.id,
      candidate
    });
  });

  // === Whiteboard Events ===
  socket.on('whiteboard-draw', ({ roomId, event }) => {
    socket.to(roomId).emit('whiteboard-draw', event);
  });

  socket.on('whiteboard-clear', ({ roomId }) => {
    socket.to(roomId).emit('whiteboard-clear');
  });

  socket.on('whiteboard-permissions-update', ({ roomId, permissions }) => {
    socket.to(roomId).emit('whiteboard-permissions', permissions);
  });

  // === Whiteboard Permission Request/Approval ===
  socket.on('whiteboard-request-permission', ({ roomId, userId, username }) => {
    console.log(`[Whiteboard] ${username} (${userId}) requesting drawing permission in ${roomId}`);
    // Broadcast request to all admins in the room
    io.to(roomId).emit('whiteboard-permission-request', {
      userId,
      username,
      timestamp: Date.now()
    });
  });

  socket.on('whiteboard-permission-approve', ({ roomId, userId, approvedBy }) => {
    console.log(`[Whiteboard] Admin ${approvedBy} approved drawing for ${userId} in ${roomId}`);
    // Notify the user their request was approved
    io.to(roomId).emit('whiteboard-permission-approved', {
      userId,
      approvedBy
    });
  });

  socket.on('whiteboard-permission-reject', ({ roomId, userId }) => {
    console.log(`[Whiteboard] Admin rejected drawing permission for ${userId} in ${roomId}`);
    // Notify the user their request was rejected
    io.to(roomId).emit('whiteboard-permission-rejected', {
      userId
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error Handling Middleware (must be after all routes)
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;