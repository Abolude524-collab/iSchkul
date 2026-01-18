const mongoose = require('mongoose');
require('dotenv').config();

const XpLog = require('./models/XpLog');
const User = require('./models/User');

async function seedXpHistory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get first user for testing
    const user = await User.findOne();
    if (!user) {
      console.error('No users found. Please create a user first.');
      process.exit(1);
    }

    console.log(`Creating XP logs for user: ${user.email}`);

    // Create sample XP logs
    const sampleLogs = [
      {
        user_id: user._id,
        xp_earned: 50,
        activity_type: 'QUIZ_COMPLETE',
        metadata: {
          quizScore: 85,
          description: 'Mathematics Quiz - Chapter 5'
        },
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        user_id: user._id,
        xp_earned: 25,
        activity_type: 'FLASHCARD_COMPLETE',
        metadata: {
          description: 'Science Vocabulary - 20 cards'
        },
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
      },
      {
        user_id: user._id,
        xp_earned: 30,
        activity_type: 'NOTE_SUMMARY',
        metadata: {
          description: 'Generated summary for Biology notes'
        },
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        user_id: user._id,
        xp_earned: 10,
        activity_type: 'daily_login',
        metadata: {
          description: 'Daily login bonus'
        },
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        user_id: user._id,
        xp_earned: 40,
        activity_type: 'QUIZ_COMPLETE',
        metadata: {
          quizScore: 92,
          description: 'History Quiz - World War II'
        },
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      },
      {
        user_id: user._id,
        xp_earned: 20,
        activity_type: 'COMMUNITY_PARTICIPATION',
        metadata: {
          description: 'Helped 5 students in study group'
        },
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
      },
      {
        user_id: user._id,
        xp_earned: 15,
        activity_type: 'DOCUMENT_UPLOAD',
        metadata: {
          description: 'Uploaded study notes PDF'
        },
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        user_id: user._id,
        xp_earned: 35,
        activity_type: 'AI_TUTOR_USAGE',
        metadata: {
          description: 'Had productive AI tutoring session'
        },
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
      },
      {
        user_id: user._id,
        xp_earned: 100,
        activity_type: 'STREAK_BONUS',
        metadata: {
          description: '7-day learning streak bonus!'
        },
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      }
    ];

    // Insert logs
    await XpLog.insertMany(sampleLogs);

    // Calculate total XP and update user
    const totalXp = sampleLogs.reduce((sum, log) => sum + (log.xp_earned || 0), 0);
    const currentXp = Number(user.xp || 0);
    const newTotalXp = currentXp + totalXp;
    const newLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;

    await User.findByIdAndUpdate(user._id, {
      xp: newTotalXp,
      level: newLevel
    });

    console.log(`✅ Successfully created ${sampleLogs.length} XP logs`);
    console.log(`✅ Updated user XP: ${currentXp} → ${newTotalXp}`);
    console.log(`✅ Updated user level: ${user.level || 1} → ${newLevel}`);
    console.log(`\nYou can now view the XP History page at: http://localhost:5175/xp-history`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding XP history:', error);
    process.exit(1);
  }
}

seedXpHistory();
