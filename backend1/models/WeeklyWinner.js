const mongoose = require('mongoose');

const weeklyWinnerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    weeklyScore: {
      type: Number,
      default: 0
    },
    winnerQuote: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for efficient querying
weeklyWinnerSchema.index({ startDate: 1, endDate: 1 });
weeklyWinnerSchema.index({ userId: 1 });

module.exports = mongoose.model('WeeklyWinner', weeklyWinnerSchema);
