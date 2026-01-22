const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  // QUESTION TYPE: Determine how to interpret correct answer fields
  // "mcq_single" (default) - single correct answer (backward compatible)
  // "mcq_multiple" - multiple correct answers
  // "true_false" - boolean true/false question
  type: {
    type: String,
    enum: ['mcq_single', 'mcq_multiple', 'true_false'],
    default: 'mcq_single',
    index: true,
  },
  // MCQ OPTIONS (for mcq_single and mcq_multiple)
  options: [{
    type: String,
  }],
  // Single correct answer (mcq_single) - ORIGINAL FIELD - now optional
  // Kept for backward compatibility with existing questions
  correctAnswer: {
    type: Number,
    min: 0,
  },
  // Multiple correct answers (mcq_multiple) - array of option indices
  // Optional: used only when type === 'mcq_multiple'
  correctAnswers: {
    type: [Number],
    default: [],
  },
  // TRUE/FALSE answer (true_false) - direct boolean
  // Optional: used only when type === 'true_false'
  correctAnswerBoolean: {
    type: Boolean,
  },
  explanation: {
    type: String,
    default: '',
  },
  imageUrl: {
    type: String,
    default: null,
  },
  // Track difficulty for adaptive learning
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
}, {
  timestamps: true,
});

// Validate that at least one correct answer is present based on type
questionSchema.pre('save', function(next) {
  if (this.type === 'mcq_single' && this.correctAnswer === undefined) {
    return next(new Error('mcq_single questions must have a correctAnswer'));
  }
  if (this.type === 'mcq_multiple' && (!this.correctAnswers || this.correctAnswers.length === 0)) {
    return next(new Error('mcq_multiple questions must have correctAnswers array with at least one answer'));
  }
  if (this.type === 'true_false' && this.correctAnswerBoolean === undefined) {
    return next(new Error('true_false questions must have a correctAnswerBoolean'));
  }
  next();
});

module.exports = mongoose.model('Question', questionSchema);