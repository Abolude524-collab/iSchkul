const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web', 'unknown'],
    default: 'unknown'
  },
  deviceId: {
    type: String,
    default: null
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('PushToken', pushTokenSchema);