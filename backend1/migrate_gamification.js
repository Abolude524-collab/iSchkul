const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function migrateUserFields() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected.');

    // Update all users to have the new gamification fields
    const result = await User.updateMany(
      {
        $or: [
          { total_xp: { $exists: false } },
          { current_streak: { $exists: false } },
          { last_active_date: { $exists: false } },
          { badges: { $exists: false } },
          { sotw_win_count: { $exists: false } }
        ]
      },
      {
        $set: {
          total_xp: 0,
          current_streak: 0,
          last_active_date: null,
          badges: [],
          sotw_win_count: 0
        }
      }
    );

    console.log(`Migration completed. Updated ${result.modifiedCount} users.`);

    // Copy existing xp to total_xp for users who have xp but not total_xp
    const xpCopyResult = await User.updateMany(
      { xp: { $exists: true, $gt: 0 }, total_xp: 0 },
      [{ $set: { total_xp: '$xp' } }]
    );

    console.log(`Copied XP values for ${xpCopyResult.modifiedCount} users.`);

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Migration complete.');
  }
}

migrateUserFields();