const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'link'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String
    },
    size: {
      type: Number
    },
    mimeType: {
      type: String
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupMessage',
    default: null
  },
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    }
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  edited: {
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    originalContent: {
      type: String
    }
  },
  deleted: {
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ sender: 1 });
groupMessageSchema.index({ 'readBy.user': 1 });
groupMessageSchema.index({ 'mentions': 1 });

// Virtual for formatted timestamp
groupMessageSchema.virtual('formattedTimestamp').get(function() {
  return this.createdAt.toISOString();
});

// Instance methods
groupMessageSchema.methods.markAsRead = function(userId) {
  const readEntry = this.readBy.find(read => read.user.toString() === userId.toString());
  if (!readEntry) {
    this.readBy.push({ user: userId, readAt: new Date() });
  }
  return this.save();
};

groupMessageSchema.methods.addReaction = function(userId, emoji) {
  let reaction = this.reactions.find(r => r.emoji === emoji);
  if (!reaction) {
    reaction = { emoji, users: [], count: 0 };
    this.reactions.push(reaction);
  }

  if (!reaction.users.includes(userId)) {
    reaction.users.push(userId);
    reaction.count += 1;
  }

  return this.save();
};

groupMessageSchema.methods.removeReaction = function(userId, emoji) {
  const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
  if (reactionIndex === -1) return this;

  const reaction = this.reactions[reactionIndex];
  const userIndex = reaction.users.indexOf(userId);
  if (userIndex !== -1) {
    reaction.users.splice(userIndex, 1);
    reaction.count -= 1;

    if (reaction.count === 0) {
      this.reactions.splice(reactionIndex, 1);
    }
  }

  return this.save();
};

groupMessageSchema.methods.edit = function(newContent, userId) {
  if (this.sender.toString() !== userId.toString()) {
    throw new Error('Only the sender can edit messages');
  }

  this.edited = {
    isEdited: true,
    editedAt: new Date(),
    originalContent: this.content
  };
  this.content = newContent;

  return this.save();
};

groupMessageSchema.methods.softDelete = function(userId) {
  if (this.sender.toString() !== userId.toString()) {
    throw new Error('Only the sender can delete messages');
  }

  this.deleted = {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId
  };

  return this.save();
};

// Pre-save middleware
groupMessageSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Update group stats
    const Group = mongoose.model('Group');
    await Group.findByIdAndUpdate(this.groupId, {
      $inc: { 'stats.messageCount': 1 },
      $set: { 'stats.lastActivity': new Date() }
    });
  }
  next();
});

// Static methods
groupMessageSchema.statics.getUnreadCount = function(groupId, userId) {
  return this.countDocuments({
    groupId,
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    'deleted.isDeleted': { $ne: true }
  });
};

groupMessageSchema.statics.markGroupAsRead = function(groupId, userId) {
  return this.updateMany(
    {
      groupId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId }
    },
    {
      $push: {
        readBy: {
          user: userId,
          readAt: new Date()
        }
      }
    }
  );
};

module.exports = mongoose.model('GroupMessage', groupMessageSchema);