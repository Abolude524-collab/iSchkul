const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500
  },
  avatar: {
    type: String, // URL to group avatar
    default: null
  },
  coverImage: {
    type: String, // URL to cover image
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  inviteLink: {
    code: {
      type: String,
      unique: true,
      sparse: true
      // Note: unique:true already creates an index, so we don't need to add it separately
    },
    expiresAt: {
      type: Date,
      default: null
    },
    maxUses: {
      type: Number,
      default: null // null means unlimited
    },
    usesCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  settings: {
    isPrivate: {
      type: Boolean,
      default: false
    },
    allowInvites: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    maxMembers: {
      type: Number,
      default: null // null means unlimited
    }
  },
  stats: {
    messageCount: {
      type: Number,
      default: 0
    },
    memberCount: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    enum: ['study', 'general', 'project', 'social', 'other'],
    default: 'general'
  }
}, {
  timestamps: true
});

// Indexes for performance
groupSchema.index({ 'members.user': 1 });
// Removed: groupSchema.index({ 'inviteLink.code': 1 }); - redundant with unique:true
groupSchema.index({ createdBy: 1 });
groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ category: 1 });
groupSchema.index({ 'stats.lastActivity': -1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Pre-save middleware to update stats
groupSchema.pre('save', function(next) {
  this.stats.memberCount = this.members.length;
  this.stats.lastActivity = new Date();
  next();
});

// Instance methods
groupSchema.methods.generateInviteLink = function(adminId, expiresInDays = 7, maxUses = null) {
  const crypto = require('crypto');
  const code = crypto.randomBytes(8).toString('hex');

  this.inviteLink = {
    code,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
    maxUses,
    usesCount: 0,
    createdBy: adminId,
    createdAt: new Date()
  };

  return this.save();
};

groupSchema.methods.revokeInviteLink = function() {
  this.inviteLink = null;
  return this.save();
};

groupSchema.methods.isMember = function(userId) {
  return this.members.some(member => {
    // Handle both ObjectId and populated object formats
    const memberId = member.user._id ? member.user._id : member.user;
    return memberId.toString() === userId.toString();
  });
};

groupSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(member => {
    // Handle both ObjectId and populated object formats
    const memberId = member.user._id ? member.user._id : member.user;
    return memberId.toString() === userId.toString();
  });
  return member ? member.role : null;
};

groupSchema.methods.isAdmin = function(userId) {
  return this.getMemberRole(userId) === 'admin';
};

groupSchema.methods.canManageMembers = function(userId) {
  const role = this.getMemberRole(userId);
  return role === 'admin' || role === 'moderator';
};

groupSchema.methods.addMember = function(userId, role = 'member', invitedBy = null) {
  if (this.isMember(userId)) {
    throw new Error('User is already a member');
  }

  if (this.settings.maxMembers && this.members.length >= this.settings.maxMembers) {
    throw new Error('Group has reached maximum member limit');
  }

  this.members.push({
    user: userId,
    role,
    invitedBy,
    joinedAt: new Date()
  });

  return this.save();
};

groupSchema.methods.removeMember = function(userId) {
  const memberIndex = this.members.findIndex(member => {
    // Handle both ObjectId and populated object formats
    const memberId = member.user._id ? member.user._id : member.user;
    return memberId.toString() === userId.toString();
  });
  if (memberIndex === -1) {
    throw new Error('User is not a member');
  }

  // Prevent removing the last admin
  const member = this.members[memberIndex];
  if (member.role === 'admin' && this.members.filter(m => m.role === 'admin').length === 1) {
    throw new Error('Cannot remove the last admin');
  }

  this.members.splice(memberIndex, 1);
  return this.save();
};

groupSchema.methods.updateMemberRole = function(userId, newRole, updatedBy) {
  if (!['admin', 'moderator', 'member'].includes(newRole)) {
    throw new Error('Invalid role');
  }

  const member = this.members.find(member => {
    // Handle both ObjectId and populated object formats
    const memberId = member.user._id ? member.user._id : member.user;
    return memberId.toString() === userId.toString();
  });
  if (!member) {
    throw new Error('User is not a member');
  }

  // Only admins can change roles
  if (!this.isAdmin(updatedBy)) {
    throw new Error('Only admins can change member roles');
  }

  // Prevent demoting the last admin
  if (member.role === 'admin' && newRole !== 'admin' &&
      this.members.filter(m => m.role === 'admin').length === 1) {
    throw new Error('Cannot demote the last admin');
  }

  member.role = newRole;
  return this.save();
};

groupSchema.methods.validateInviteLink = function(code) {
  if (!this.inviteLink || this.inviteLink.code !== code) {
    return { valid: false, reason: 'Invalid invite link' };
  }

  if (this.inviteLink.expiresAt && this.inviteLink.expiresAt < new Date()) {
    return { valid: false, reason: 'Invite link has expired' };
  }

  if (this.inviteLink.maxUses && this.inviteLink.usesCount >= this.inviteLink.maxUses) {
    return { valid: false, reason: 'Invite link has reached maximum uses' };
  }

  return { valid: true };
};

groupSchema.methods.useInviteLink = function(userId) {
  if (!this.inviteLink) {
    throw new Error('No active invite link');
  }

  this.inviteLink.usesCount += 1;
  return this.addMember(userId, 'member', null);
};

// Static methods
groupSchema.statics.findByInviteCode = function(code) {
  return this.findOne({ 'inviteLink.code': code });
};

groupSchema.statics.findUserGroups = function(userId, options = {}) {
  const { role, category, limit = 50, skip = 0 } = options;
  let query = { 'members.user': userId };

  if (role) {
    query['members.role'] = role;
  }

  if (category) {
    query.category = category;
  }

  return this.find(query)
    .populate('members.user', 'name username avatar')
    .populate('createdBy', 'name username')
    .sort({ 'stats.lastActivity': -1 })
    .limit(limit)
    .skip(skip);
};

// Add indexes for common queries
groupSchema.index({ 'members.user': 1 }); // Find user's groups
groupSchema.index({ category: 1, 'stats.lastActivity': -1 }); // Category + activity
groupSchema.index({ 'inviteLink.code': 1 }); // Invite link lookups
groupSchema.index({ createdBy: 1, createdAt: -1 }); // Creator's groups

module.exports = mongoose.model('Group', groupSchema);