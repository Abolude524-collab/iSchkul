const mongoose = require('mongoose');
const User = require('./models/User');
const WeeklyWinner = require('./models/WeeklyWinner');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    
    const winners = await WeeklyWinner.find({})
      .populate('userId', 'name username')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('\nWeeklyWinner records in database:');
    console.log('Total:', winners.length);
    
    if (winners.length > 0) {
      winners.forEach((w, i) => {
        console.log(`\n[${i+1}] ${w.userId?.name || 'Unknown'}`);
        console.log(`    Start: ${new Date(w.startDate).toISOString().split('T')[0]}`);
        console.log(`    End: ${new Date(w.endDate).toISOString().split('T')[0]}`);
        console.log(`    Score: ${w.weeklyScore} XP`);
      });
    } else {
      console.log('\n⚠️  No records found!');
      console.log('Checking raw collection...');
      
      const db = mongoose.connection.db;
      const collection = db.collection('weeklyWinners');
      const rawDocs = await collection.find({}).toArray();
      console.log(`Raw documents: ${rawDocs.length}`);
      if (rawDocs.length > 0) {
        console.log(JSON.stringify(rawDocs[0], null, 2));
      }
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

check();
