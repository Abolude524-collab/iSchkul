const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['sotw', 'streak', 'achievement', 'milestone'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '🏆'
  },
  awardedDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    weekStart: Date,
    weekEnd: Date,
    xpEarned: Number,
    reason: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
badgeSchema.index({ userId: 1, type: 1 });
badgeSchema.index({ userId: 1, awardedDate: -1 });

module.exports = mongoose.model('Badge', badgeSchema);
