const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const XpLog = require('./models/XpLog');

async function repairXp() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected.');

    const users = await User.find({});
    console.log(`Scanning ${users.length} users for XP mismatch...`);

    let updatedCount = 0;
    for (const user of users) {
      const logs = await XpLog.find({ user_id: user._id });
      const sum = logs.reduce((acc, log) => acc + (log.xp_earned || 0), 0);

      // Check mismatch. If total_xp differs from sum of logs, update it.
      if (sum !== (user.total_xp || 0)) {
        console.log(`[Mismatch] User ${user._id}: Profile=${user.total_xp || 0}, Logs=${sum}. Fixing...`);
        await User.updateOne({ _id: user._id }, { $set: { total_xp: sum } });
        updatedCount++;
      }
    }

    console.log(`Scan complete. Fixed ${updatedCount} users.`);

  } catch (error) {
    console.error('Repair error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Repair complete.');
  }
}

repairXp();