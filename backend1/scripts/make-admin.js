/**
 * Make User Admin Script
 * Run this to promote a user to admin role
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function makeUserAdmin(email) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');

    const result = await User.updateOne(
      { email: email },
      {
        $set: {
          isAdmin: true,
          role: "admin"
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ User ${email} has been promoted to admin!`);
    } else {
      console.log(`❌ User ${email} not found or already admin.`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// Usage: node make-admin.js user@example.com
const email = process.argv[2];
if (!email) {
  console.log("Usage: node make-admin.js <email>");
  process.exit(1);
}

makeUserAdmin(email);