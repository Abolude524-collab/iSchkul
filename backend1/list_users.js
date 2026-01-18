const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    const users = await User.find({}, 'username email name');
    console.log('Users in DB:');
    users.forEach(u => console.log(`  ${u.username} - ${u.email}`));
    await mongoose.connection.close();
  } catch (error) {
    console.error(error);
  }
}

listUsers();
