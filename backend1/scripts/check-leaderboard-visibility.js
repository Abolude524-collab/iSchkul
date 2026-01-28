const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function checkLeaderboardVisibility() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('Connected to MongoDB');

    // Get total users
    const totalUsers = await User.countDocuments({});
    console.log(`\nTotal Users: ${totalUsers}`);

    // Get users with is_leaderboard_visible true
    const visibleUsers = await User.countDocuments({ is_leaderboard_visible: true });
    console.log(`Users with is_leaderboard_visible=true: ${visibleUsers}`);

    // Get users with is_leaderboard_visible false or missing
    const hiddenUsers = await User.countDocuments({ 
      $or: [
        { is_leaderboard_visible: false },
        { is_leaderboard_visible: { $exists: false } },
        { is_leaderboard_visible: null }
      ]
    });
    console.log(`Users with is_leaderboard_visible=false/null: ${hiddenUsers}`);

    // Get users with total_xp > 0
    const usersWithXp = await User.countDocuments({ total_xp: { $gt: 0 } });
    console.log(`\nUsers with total_xp > 0: ${usersWithXp}`);

    // Get users with total_xp = 0 or missing
    const usersWithoutXp = await User.countDocuments({ 
      $or: [
        { total_xp: 0 },
        { total_xp: { $exists: false } },
        { total_xp: null }
      ]
    });
    console.log(`Users with total_xp = 0/null: ${usersWithoutXp}`);

    // Sample of all users with their visibility and XP
    console.log('\n=== All Users (with visibility and XP) ===');
    const allUsers = await User.find({})
      .select('name email username is_leaderboard_visible total_xp level')
      .sort({ total_xp: -1 });

    allUsers.forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.name} (${u.email})`);
      console.log(`   - is_leaderboard_visible: ${u.is_leaderboard_visible}`);
      console.log(`   - total_xp: ${u.total_xp || 0}`);
      console.log(`   - level: ${u.level || 1}`);
    });

    // Fix: Set is_leaderboard_visible to true for ALL users (including those with false)
    console.log('\n=== Fixing is_leaderboard_visible for ALL users ===');
    const updateResult = await User.updateMany(
      {},  // Match all users
      { $set: { is_leaderboard_visible: true } }
    );
    console.log(`Updated ${updateResult.modifiedCount} users to set is_leaderboard_visible=true`);
    
    // Verify the fix
    const nowVisible = await User.countDocuments({ is_leaderboard_visible: true });
    console.log(`✅ Now ${nowVisible} users are visible on the leaderboard`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkLeaderboardVisibility();
