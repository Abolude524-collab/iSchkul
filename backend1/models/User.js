const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  studentCategory: {
    type: String,
    default: ''
  },
  institution: {
    type: String,
    default: ''
  },
  securityQuestion: {
    type: String,
    default: ''
  },
  securityAnswer: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: ''
  },
  chatAbout: {
    type: String,
    default: ''
  },
  chatAvatar: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  xp: {
    type: Number,
    default: 0,
    index: true // Index for leaderboard queries
  },
  level: {
    type: Number,
    default: 1,
    index: true // Index for level-based queries
  },
  // Gamification fields (matching student-web-app)
  total_xp: {
    type: Number,
    default: 0,
    min: 0,
    index: true // Index for gamification queries
  },
  last_active_date: {
    type: Date,
    default: null
  },
  current_streak: {
    type: Number,
    default: 0,
    min: 0
  },
  is_leaderboard_visible: {
    type: Boolean,
    default: false
  },
  badges: {
    type: [String],
    default: []
  },
  sotw_win_count: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compound indexes for common queries
userSchema.index({ xp: -1, role: 1 }); // Leaderboard queries
userSchema.index({ email: 1, username: 1 }); // Auth queries
userSchema.index({ isAdmin: 1, role: 1 }); // Admin filtering

module.exports = mongoose.model('User', userSchema);