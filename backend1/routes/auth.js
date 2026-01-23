const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { transformUserAvatar } = require('../middleware/avatarTransform');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name, studentcategory, institution, securityQuestion, securityAnswer } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({ 
      username, 
      email, 
      password, 
      name, 
      studentCategory: studentcategory, 
      institution, 
      securityQuestion, 
      securityAnswer 
    });
    await user.save();

    // Generate token
    console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const transformedUser = transformUserAvatar(user);
    res.status(201).json({
      token,
      user: {
        id: transformedUser._id,
        username: transformedUser.username,
        email: transformedUser.email,
        name: transformedUser.name,
        studentCategory: transformedUser.studentCategory,
        institution: transformedUser.institution,
        avatar: transformedUser.avatar,
        xp: transformedUser.xp,
        level: transformedUser.level
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (typeof email !== 'string') {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Find user by email or username
    const user = await User.findOne({ 
      $or: [{ email: email }, { username: email }] 
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const transformedUser = transformUserAvatar(user);
    res.json({
      token,
      user: {
        id: transformedUser._id,
        username: transformedUser.username,
        email: transformedUser.email,
        name: transformedUser.name,
        studentCategory: transformedUser.studentCategory,
        institution: transformedUser.institution,
        isAdmin: transformedUser.isAdmin,
        role: transformedUser.role,
        avatar: transformedUser.avatar,
        xp: transformedUser.xp,
        level: transformedUser.level
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('-password');
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, avatar, username, phonenumber, studentcategory, institution } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (username) updateData.username = username;
    if (phonenumber) updateData.phoneNumber = phonenumber;
    if (studentcategory) updateData.studentCategory = studentcategory;
    if (institution) updateData.institution = institution;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');
    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Upload avatar
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const storageService = require('../services/storageService');

router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user._id || req.user.id;
    const fileUrl = await storageService.uploadFile(req.file);

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: fileUrl },
      { new: true }
    ).select('-password');

    const transformedUser = transformUserAvatar(user);
    res.json({ user: transformedUser, avatarUrl: fileUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password - get security question
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.securityQuestion) {
      return res.status(400).json({ error: 'Security question not set for this account' });
    }

    res.json({
      securityQuestion: user.securityQuestion,
      userId: user._id
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password - verify security answer and update password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, securityAnswer, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check security answer (case insensitive)
    if (user.securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()) {
      return res.status(400).json({ error: 'Incorrect security answer' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;