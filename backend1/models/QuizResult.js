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
  // Store raw submitted answers; can be numbers, arrays (for multi-select), or booleans
  answers: [{
    type: mongoose.Schema.Types.Mixed,
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
  // Per-question breakdown to support multiple question types
  detailedResults: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
    questionType: String,
    question: String,
    // Accept mixed answer formats (number | array | boolean)
    userAnswer: mongoose.Schema.Types.Mixed,
    correctAnswer: mongoose.Schema.Types.Mixed,
    correctAnswers: [mongoose.Schema.Types.Mixed],
    selectedOption: String,
    correctOption: String,
    selectedOptions: [String],
    correctOptions: [String],
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