const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  startDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'upcoming'],
    default: 'active',
    index: true
  },
  prizes: [{
    rank: Number,
    description: String
  }],
  isRestricted: {
    type: Boolean,
    default: false
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,  // Optional - null for system-created weekly leaderboards
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  participantCount: {
    type: Number,
    default: 0
  },
  winners: [{
    rank: Number,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    xp: Number,
    prizeDescription: String
  }]
});

// Index for querying active leaderboards
leaderboardSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
