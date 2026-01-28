const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const XpLog = require('../models/XpLog');

async function syncTotalXp() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Calculate total XP from XpLog
        const xpLogs = await XpLog.aggregate([
          { $match: { user_id: user._id } },
          { $group: { _id: null, total: { $sum: '$xp_earned' } } }
        ]);

        const totalFromLogs = xpLogs[0]?.total || 0;
        const currentTotalXp = user.total_xp || 0;

        // Update if there's a mismatch or if total_xp is 0
        if (totalFromLogs !== currentTotalXp) {
          await User.findByIdAndUpdate(user._id, {
            total_xp: totalFromLogs,
            level: Math.floor(Math.sqrt(totalFromLogs / 100))
          });

          console.log(`✅ Updated ${user.email}: ${currentTotalXp} → ${totalFromLogs} XP (Level ${Math.floor(Math.sqrt(totalFromLogs / 100))})`);
          updatedCount++;
        } else {
          console.log(`✓ ${user.email}: ${totalFromLogs} XP (already correct)`);
        }
      } catch (err) {
        console.error(`❌ Error updating ${user.email}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Updated: ${updatedCount} users`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Unchanged: ${users.length - updatedCount - errorCount}`);

    // Verify leaderboard
    console.log('\n=== Top 10 Leaderboard ===');
    const topUsers = await User.find()
      .select('name username email total_xp level')
      .sort({ total_xp: -1 })
      .limit(10);

    topUsers.forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.name} (${u.email}): ${u.total_xp} XP (Level ${u.level})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  }
}

syncTotalXp();
