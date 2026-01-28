/**
 * Quick verification that XP sync is fixed
 * Usage: node scripts/verify-xp-fix.js <userId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const XpLog = require('../models/XpLog');

async function verifyXpFix(userId) {
  try {
    console.log('\n🔍 XP Sync Verification\n');
    
    if (!userId) {
      console.log('❌ Usage: node verify-xp-fix.js <userId>');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected\n');

    // Get user
    const user = await User.findById(userId).select('total_xp xp level');
    if (!user) {
      console.log(`❌ User ${userId} not found`);
      process.exit(1);
    }

    console.log(`👤 User: ${userId}`);
    console.log(`   Stored XP: ${user.total_xp || user.xp || 0}`);
    console.log(`   Level: ${user.level}\n`);

    // Calculate from XpLog
    console.log('📊 Calculating XP from logs...');
    const stats = await XpLog.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$xp_earned' }, count: { $sum: 1 } } }
    ]);

    const calculated = stats[0]?.total || 0;
    const logCount = stats[0]?.count || 0;

    console.log(`   Calculated XP: ${calculated}`);
    console.log(`   Log entries: ${logCount}\n`);

    // Check for sync
    const dbXp = user.total_xp || user.xp || 0;
    const diff = Math.abs(calculated - dbXp);

    console.log('🔄 Sync Status:');
    if (diff === 0) {
      console.log(`   ✅ SYNCED (difference: 0 XP)`);
    } else if (diff < 30) {
      console.log(`   ⚠️  Minor difference: ${diff} XP`);
      console.log(`   ℹ️  This is normal for concurrent updates`);
    } else {
      console.log(`   ❌ MISMATCH: ${diff} XP difference`);
      console.log(`   💡 Run: npm run repair-xp`);
    }

    // Show recent activity
    console.log('\n📋 Recent Activity (Last 5):');
    const recent = await XpLog.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('xp_earned activity_type timestamp')
      .lean();

    recent.forEach((log, i) => {
      const date = new Date(log.timestamp).toLocaleString();
      console.log(`   ${i + 1}. ${log.activity_type} (+${log.xp_earned} XP) - ${date}`);
    });

    console.log('\n✅ Verification complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

const userId = process.argv[2];
verifyXpFix(userId);
