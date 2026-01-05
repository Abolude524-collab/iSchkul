/**
 * Create Super Admin User Script
 * Run this to create the first super admin user
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      console.log('❌ Super admin already exists:', existingSuperAdmin.email);
      return;
    }

    // Create super admin user
    const superAdmin = new User({
      username: 'superadmin',
      email: 'admin@ischkul.com',
      password: 'admin123', // Change this password after first login!
      name: 'Super Admin',
      isAdmin: true,
      role: 'superadmin'
    });

    await superAdmin.save();

    console.log('✅ Super admin created successfully!');
    console.log('Email: admin@ischkul.com');
    console.log('Password: admin123');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

createSuperAdmin();