/**
 * PRODUCTION CRITICAL: XP Sync Repair Script
 * Fixes XP mismatches between User.total_xp and XpLog sum
 * 
 * Usage: node scripts/repair-xp-sync.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const XpLog = require('../models/XpLog');

let repaired = 0;
let mismatches = 0;

async function repairXpSync() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected\n');

    console.log('🔍 Scanning all users for XP mismatches...\n');

    const users = await User.find().select('_id total_xp xp').lean();
    console.log(`Found ${users.length} users\n`);

    for (const user of users) {
      // Calculate actual XP from logs
      const xpStats = await XpLog.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(user._id) } },
        { $group: { _id: null, total: { $sum: '$xp_earned' } } }
      ]);

      const calculatedXp = xpStats[0]?.total || 0;
      const dbXp = user.total_xp || user.xp || 0;

      // If mismatch > 30 XP, fix it
      if (Math.abs(calculatedXp - dbXp) > 30) {
        mismatches++;
        const diff = calculatedXp - dbXp;
        console.log(`⚠️  User ${user._id}`);
        console.log(`    DB XP: ${dbXp}`);
        console.log(`    Calculated: ${calculatedXp}`);
        console.log(`    Difference: ${diff > 0 ? '+' : ''}${diff} XP`);

        // Update to calculated value
        await User.findByIdAndUpdate(user._id, {
          $set: { xp: calculatedXp, total_xp: calculatedXp }
        });

        repaired++;
        console.log(`    ✅ Fixed\n`);
      }
    }

    console.log(`\n📊 Repair Summary:`);
    console.log(`    Total users: ${users.length}`);
    console.log(`    Mismatches found: ${mismatches}`);
    console.log(`    Repaired: ${repaired}`);

    if (repaired === 0) {
      console.log('\n✅ All XP values are in sync!');
    } else {
      console.log(`\n✅ Repaired ${repaired} user(s)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
    process.exit(0);
  }
}

repairXpSync();
