const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/files', require('./routes/files'));
app.use('/api/generate', require('./routes/generate'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/sotw', require('./routes/sotw'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/admin', require('./routes/admin'));

// Socket.io for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-group', (groupId) => {
    socket.join(groupId);
  });

  socket.on('leave-group', (groupId) => {
    socket.leave(groupId);
  });

  socket.on('send-message', (data) => {
    io.to(data.groupId).emit('new-message', data.message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;