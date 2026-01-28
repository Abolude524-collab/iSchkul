/**
 * Database Index Creation Script
 * Run this after deploying to ensure all indexes are created
 * Usage: node scripts/create-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User');
const Group = require('../models/Group');
const Leaderboard = require('../models/Leaderboard');

async function createIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Creating indexes...\n');

    // User model indexes
    console.log('Creating User indexes...');
    await User.collection.createIndex({ email: 1, username: 1 });
    await User.collection.createIndex({ xp: -1, role: 1 });
    await User.collection.createIndex({ isAdmin: 1, role: 1 });
    await User.collection.createIndex({ total_xp: -1 });
    console.log('✅ User indexes created');

    // Group model indexes
    console.log('Creating Group indexes...');
    await Group.collection.createIndex({ 'members.user': 1 });
    await Group.collection.createIndex({ category: 1, 'stats.lastActivity': -1 });
    await Group.collection.createIndex({ 'inviteLink.code': 1 });
    await Group.collection.createIndex({ createdBy: 1, createdAt: -1 });
    console.log('✅ Group indexes created');

    // Leaderboard model indexes (already defined in schema, but ensure they exist)
    console.log('Creating Leaderboard indexes...');
    await Leaderboard.collection.createIndex({ title: 1 });
    await Leaderboard.collection.createIndex({ startDate: 1 });
    await Leaderboard.collection.createIndex({ endDate: 1 });
    await Leaderboard.collection.createIndex({ status: 1 });
    console.log('✅ Leaderboard indexes created');

    // List all indexes
    console.log('\n📋 Current indexes:\n');
    
    const userIndexes = await User.collection.getIndexes();
    console.log('User indexes:', Object.keys(userIndexes).join(', '));
    
    const groupIndexes = await Group.collection.getIndexes();
    console.log('Group indexes:', Object.keys(groupIndexes).join(', '));
    
    const leaderboardIndexes = await Leaderboard.collection.getIndexes();
    console.log('Leaderboard indexes:', Object.keys(leaderboardIndexes).join(', '));

    console.log('\n✅ All indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

createIndexes();
