const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const User = require('../models/User');
const { transformGroupAvatar, transformMessageAvatar } = require('../middleware/avatarTransform');

const router = express.Router();

// Get io instance
let io;
const setIo = (socketIo) => {
  io = socketIo;
};

// Create a new group
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, category, isPrivate, tags, memberIds = [] } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Validate memberIds
    const cleanMemberIds = Array.isArray(memberIds) ? memberIds.filter(id => id && id !== req.user._id.toString()) : [];
    
    // Check if any memberIds are invalid
    if (cleanMemberIds.length > 0) {
      const User = require('../models/User');
      const existingUsers = await User.find({ _id: { $in: cleanMemberIds } }).select('_id');
      const existingIds = existingUsers.map(u => u._id.toString());
      
      const invalidIds = cleanMemberIds.filter(id => !existingIds.includes(id.toString()));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: `Some users do not exist: ${invalidIds.join(', ')}` });
      }
    }

    // Create the group with creator as admin
    const initialMembers = [{
      user: req.user._id,
      role: 'admin',
      joinedAt: new Date()
    }];

    // Add selected members as 'member' role
    for (const memberId of cleanMemberIds) {
      initialMembers.push({
        user: memberId,
        role: 'member',
        joinedAt: new Date()
      });
    }

    const group = new Group({
      name: name.trim(),
      description: description?.trim(),
      category: category || 'general',
      tags: tags || [],
      createdBy: req.user._id,
      members: initialMembers,
      settings: {
        isPrivate: isPrivate || false
      }
    });

    await group.save();
    await group.populate('members.user', 'name username avatar email');
    await group.populate('createdBy', 'name username');

    const transformedGroup = transformGroupAvatar(group);
    res.status(201).json({
      success: true,
      group: {
        _id: transformedGroup._id,
        name: transformedGroup.name,
        description: transformedGroup.description,
        category: transformedGroup.category,
        tags: transformedGroup.tags,
        avatar: transformedGroup.avatar,
        createdBy: transformedGroup.createdBy,
        members: transformedGroup.members,
        memberCount: transformedGroup.memberCount,
        settings: transformedGroup.settings,
        stats: transformedGroup.stats,
        createdAt: transformedGroup.createdAt
      },
      message: cleanMemberIds.length > 0 ? `Group created with ${cleanMemberIds.length} member(s) added` : 'Group created successfully'
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get user's groups
router.get('/', auth, async (req, res) => {
  try {
    const { category, role, limit = 50, skip = 0 } = req.query;
    
    console.log('GET /api/groups - User ID:', req.user._id);
    console.log('Query params:', { category, role, limit, skip });

    const groups = await Group.findUserGroups(req.user._id, {
      category,
      role,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    console.log(`Found ${groups.length} groups for user ${req.user._id}`);

    const formattedGroups = groups.map(group => {
      const transformed = transformGroupAvatar(group);
      return {
        _id: transformed._id,
        name: transformed.name,
        description: transformed.description,
        category: transformed.category,
        tags: transformed.tags,
        avatar: transformed.avatar,
        members: transformed.members,
        memberCount: transformed.memberCount,
        settings: transformed.settings,
        stats: transformed.stats,
        userRole: group.getMemberRole(req.user._id),
        lastActivity: transformed.stats.lastActivity,
        createdAt: transformed.createdAt
      };
    });

    res.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group details
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'name username avatar')
      .populate('createdBy', 'name username')
      .populate('inviteLink.createdBy', 'name username');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const userRole = group.getMemberRole(req.user._id);

    const transformedGroup = transformGroupAvatar(group);
    res.json({
      group: {
        _id: transformedGroup._id,
        name: transformedGroup.name,
        description: transformedGroup.description,
        category: transformedGroup.category,
        tags: transformedGroup.tags,
        avatar: transformedGroup.avatar,
        coverImage: transformedGroup.coverImage,
        createdBy: transformedGroup.createdBy,
        members: transformedGroup.members,
        memberCount: transformedGroup.memberCount,
        inviteLink: transformedGroup.inviteLink ? {
          code: transformedGroup.inviteLink.code,
          expiresAt: transformedGroup.inviteLink.expiresAt,
          maxUses: transformedGroup.inviteLink.maxUses,
          usesCount: transformedGroup.inviteLink.usesCount,
          createdAt: transformedGroup.inviteLink.createdAt
        } : null,
        settings: transformedGroup.settings,
        stats: transformedGroup.stats,
        userRole,
        canManageMembers: group.canManageMembers(req.user._id),
        isAdmin: group.isAdmin(req.user._id),
        createdAt: transformedGroup.createdAt,
        updatedAt: transformedGroup.updatedAt
      }
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group settings
router.put('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: 'Only admins can update group settings' });
    }

    const { name, description, category, tags, avatar, coverImage, settings } = req.body;

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description?.trim();
    if (category !== undefined) group.category = category;
    if (tags !== undefined) group.tags = tags;
    if (avatar !== undefined) group.avatar = avatar;
    if (coverImage !== undefined) group.coverImage = coverImage;
    if (settings !== undefined) {
      group.settings = { ...group.settings, ...settings };
    }

    await group.save();
    await group.populate('members.user', 'name username avatar');

    const transformedGroup = transformGroupAvatar(group);
    res.json({
      group: {
        _id: transformedGroup._id,
        name: transformedGroup.name,
        description: transformedGroup.description,
        category: transformedGroup.category,
        tags: transformedGroup.tags,
        avatar: transformedGroup.avatar,
        coverImage: transformedGroup.coverImage,
        settings: transformedGroup.settings,
        updatedAt: transformedGroup.updatedAt
      }
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate invite link
router.post('/:id/invite-link', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.canManageMembers(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized to manage invites' });
    }

    const { expiresInDays, maxUses } = req.body;

    await group.generateInviteLink(req.user._id, expiresInDays, maxUses);

    res.json({
      inviteLink: {
        code: group.inviteLink.code,
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join-group/${group.inviteLink.code}`,
        expiresAt: group.inviteLink.expiresAt,
        maxUses: group.inviteLink.maxUses,
        usesCount: group.inviteLink.usesCount
      }
    });
  } catch (error) {
    console.error('Generate invite link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke invite link
router.delete('/:id/invite-link', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.canManageMembers(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized to manage invites' });
    }

    await group.revokeInviteLink();

    res.json({ message: 'Invite link revoked successfully' });
  } catch (error) {
    console.error('Revoke invite link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group via invite link
router.post('/join/:inviteCode', auth, async (req, res) => {
  try {
    const group = await Group.findByInviteCode(req.params.inviteCode);

    if (!group) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const validation = group.validateInviteLink(req.params.inviteCode);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    if (group.isMember(req.user._id)) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    await group.useInviteLink(req.user._id);
    await group.populate('members.user', 'name username avatar');

    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('member-joined', {
        groupId: group._id,
        member: {
          user: req.user,
          role: 'member',
          joinedAt: new Date()
        }
      });
    }

    res.json({
      group: {
        _id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        memberCount: group.memberCount
      }
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member to group
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.canManageMembers(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized to add members' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await group.addMember(userId, role || 'member', req.user._id);
    await group.populate('members.user', 'name username avatar');

    const newMember = group.members.find(m => m.user._id.toString() === userId);

    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('member-added', {
        groupId: group._id,
        member: newMember
      });
    }

    res.json({ member: newMember });
  } catch (error) {
    console.error('Add member error:', error);
    if (error.message === 'User is already a member') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update member role
router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: 'Only admins can change member roles' });
    }

    await group.updateMemberRole(req.params.userId, role, req.user._id);
    await group.populate('members.user', 'name username avatar');

    const updatedMember = group.members.find(m => m.user._id.toString() === req.params.userId);

    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('member-role-updated', {
        groupId: group._id,
        userId: req.params.userId,
        newRole: role
      });
    }

    res.json({ member: updatedMember });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Remove member from group
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const targetUserId = req.params.userId;
    const isSelfRemoval = targetUserId === req.user._id.toString();

    // Check permissions
    if (!isSelfRemoval && !group.canManageMembers(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized to remove members' });
    }

    // Can't remove admins unless you're an admin
    if (!isSelfRemoval && group.isAdmin(targetUserId) && !group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: 'Cannot remove admin members' });
    }

    await group.removeMember(targetUserId);

    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('member-removed', {
        groupId: group._id,
        userId: targetUserId,
        removedBy: req.user._id
      });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Leave group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isMember(req.user._id)) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }

    // Check if user is the last admin
    if (group.isAdmin(req.user._id) && group.members.filter(m => m.role === 'admin').length === 1) {
      return res.status(400).json({ error: 'Cannot leave group as the last admin. Promote another member first.' });
    }

    await group.removeMember(req.user._id);

    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('member-left', {
        groupId: group._id,
        userId: req.user._id
      });
    }

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    let query = {
      groupId: req.params.id,
      'deleted.isDeleted': { $ne: true }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await GroupMessage.find(query)
      .populate('sender', 'name username avatar')
      .populate('replyTo')
      .populate('readBy.user', 'name username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark messages as read
    await GroupMessage.markGroupAsRead(req.params.id, req.user._id);

    const formattedMessages = messages.reverse().map(message => {
      const transformed = transformMessageAvatar(message);
      return {
        _id: transformed._id,
        content: transformed.content,
        sender: transformed.sender,
        messageType: transformed.messageType,
        attachments: transformed.attachments,
        replyTo: transformed.replyTo,
        reactions: transformed.reactions,
        mentions: transformed.mentions,
        readBy: transformed.readBy,
        edited: transformed.edited,
        createdAt: transformed.createdAt,
        formattedTimestamp: transformed.formattedTimestamp
      };
    });

    res.json({
      messages: formattedMessages,
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message to group
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content, messageType, attachments, replyTo } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const message = new GroupMessage({
      groupId: req.params.id,
      sender: req.user._id,
      content,
      messageType: messageType || 'text',
      attachments: attachments || [],
      replyTo
    });

    await message.save();
    await message.populate('sender', 'name username avatar');

    const transformedMessage = transformMessageAvatar(message);
    
    // Emit to group members
    if (io) {
      io.to(group._id.toString()).emit('group-message', {
        groupId: group._id,
        message: {
          _id: transformedMessage._id,
          content: transformedMessage.content,
          sender: transformedMessage.sender,
          messageType: transformedMessage.messageType,
          attachments: transformedMessage.attachments,
          replyTo: transformedMessage.replyTo,
          reactions: transformedMessage.reactions,
          createdAt: transformedMessage.createdAt
        }
      });
    }

    res.status(201).json({
      message: {
        _id: transformedMessage._id,
        content: transformedMessage.content,
        sender: transformedMessage.sender,
        messageType: transformedMessage.messageType,
        attachments: transformedMessage.attachments,
        replyTo: transformedMessage.replyTo,
        reactions: transformedMessage.reactions,
        createdAt: transformedMessage.createdAt
      }
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: 'Only admins can delete groups' });
    }

    // Delete all messages
    await GroupMessage.deleteMany({ groupId: req.params.id });

    // Delete the group
    await Group.findByIdAndDelete(req.params.id);

    // Emit to all members
    if (io) {
      io.to(group._id.toString()).emit('group-deleted', {
        groupId: group._id
      });
    }

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.setIo = setIo;