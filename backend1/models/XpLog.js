const mongoose = require('mongoose');

const XpLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  xp_earned: {
    type: Number,
    required: true
  },
  activity_type: {
    type: String,
    // Allow various activity strings used across routes
    enum: [
      'QUIZ_COMPLETE',
      'FLASHCARD_COMPLETE',
      'NOTE_SUMMARY',
      'DAILY_STREAK',
      'STREAK_BONUS',
      'DAILY_LOGIN',
      'COMMUNITY_PARTICIPATION',
      'DOCUMENT_UPLOAD',
      'AI_TUTOR_USAGE',
      'daily_login',
      'quiz_completed',
      'flashcard_reviewed',
      'group_message',
      'file_upload',
      'APP_ENTRY'
    ],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient queries
XpLogSchema.index({ user_id: 1, timestamp: -1 });
XpLogSchema.index({ timestamp: -1 });
XpLogSchema.index({ activity_type: 1, timestamp: -1 });

module.exports = mongoose.model('XpLog', XpLogSchema);