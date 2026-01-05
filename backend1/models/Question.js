const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  options: [{
    type: String,
    required: true,
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
  },
  explanation: {
    type: String,
    default: '',
  },
  imageUrl: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Question', questionSchema);