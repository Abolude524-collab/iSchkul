const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  }],
  timeLimit: {
    type: Number, // in seconds
    default: 1800, // 30 minutes
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'veryhard'],
    default: 'medium',
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  totalAttempts: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Index for better query performance
quizSchema.index({ subject: 1, difficulty: 1, isPublic: 1 });
quizSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Quiz', quizSchema);