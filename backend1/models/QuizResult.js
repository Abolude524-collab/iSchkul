const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  answers: [{
    type: Number,
    required: true,
  }],
  score: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  detailedResults: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
    question: String,
    userAnswer: Number,
    correctAnswer: Number,
    isCorrect: Boolean,
    explanation: String,
  }],
}, {
  timestamps: true,
});

// Compound index for efficient queries
quizResultSchema.index({ quizId: 1, userId: 1 });
quizResultSchema.index({ userId: 1, completedAt: -1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);