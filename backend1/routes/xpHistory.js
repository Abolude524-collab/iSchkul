const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const XpLog = require('../models/XpLog');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

// Get XP history for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const { limit = 50, skip = 0, activityType } = req.query;

    // Build query
    const query = { user_id: new mongoose.Types.ObjectId(userId) };
    if (activityType) query.activity_type = activityType;

    // Get logs with pagination
    const logs = await XpLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Get total count
    const totalCount = await XpLog.countDocuments(query);

    // Get user's current stats
    const user = await User.findById(userId).select('xp level');

    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          id: log._id,
          xpEarned: log.xp_earned,
          activityType: log.activity_type,
          metadata: log.metadata,
          timestamp: log.timestamp
        })),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: totalCount > (parseInt(skip) + parseInt(limit))
        },
        userStats: {
          totalXp: user?.xp || 0,
          level: user?.level || 1
        }
      }
    });
  } catch (error) {
    console.error('[XP History] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load XP history' 
    });
  }
});

// Get XP statistics/summary
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const { timeRange = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Aggregate stats
    const stats = await XpLog.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$activity_type',
          totalXp: { $sum: '$xp_earned' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get daily XP for chart
    const dailyXp = await XpLog.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          totalXp: { $sum: '$xp_earned' },
          activities: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate totals
    const totalXpInRange = stats.reduce((sum, stat) => sum + stat.totalXp, 0);
    const totalActivities = stats.reduce((sum, stat) => sum + stat.count, 0);

    res.json({
      success: true,
      data: {
        timeRange,
        totalXp: totalXpInRange,
        totalActivities,
        byActivityType: stats.map(s => ({
          activityType: s._id,
          totalXp: s.totalXp,
          count: s.count
        })),
        dailyBreakdown: dailyXp.map(d => ({
          date: d._id,
          xp: d.totalXp,
          activities: d.activities
        }))
      }
    });
  } catch (error) {
    console.error('[XP Stats] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load XP statistics' 
    });
  }
});

// Helper function to award XP (can be called from other routes)
async function awardXp(userId, activityType, xpAmount, metadata = {}) {
  try {
    // Create log entry
    const log = await XpLog.create({
      userId,
      xpEarned: xpAmount,
      activityType,
      metadata
    });

    // Update user's total XP
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { xp: xpAmount } },
      { new: true }
    );

    // Calculate new level (simple formula: level = floor(sqrt(xp/100)))
    const newLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    if (newLevel > user.level) {
      await User.findByIdAndUpdate(userId, { level: newLevel });
    }

    return {
      success: true,
      xpAwarded: xpAmount,
      totalXp: user.xp,
      level: newLevel,
      logId: log._id
    };
  } catch (error) {
    console.error('[Award XP] Error:', error);
    throw error;
  }
}

module.exports = router;
module.exports.awardXp = awardXp;
