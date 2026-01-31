const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateFlashcardUrls() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const setsCollection = db.collection('flashcard_sets');
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://ischkuldemo12.netlify.app';
    
    // Find all sets with localhost URLs
    const oldSets = await setsCollection.find({
      shareUrl: { $regex: /localhost/ }
    }).toArray();
    
    console.log(`Found ${oldSets.length} flashcard sets with localhost URLs`);
    
    let updated = 0;
    for (const set of oldSets) {
      if (set.shareCode) {
        const newShareUrl = `${frontendUrl}/shared-flashcards/${set.shareCode}`;
        
        await setsCollection.updateOne(
          { _id: set._id },
          { $set: { shareUrl: newShareUrl } }
        );
        
        console.log(`Updated set: ${set.title}`);
        console.log(`  Old URL: ${set.shareUrl}`);
        console.log(`  New URL: ${newShareUrl}`);
        updated++;
      }
    }
    
    console.log(`\n✅ Updated ${updated} flashcard sets`);
    
  } catch (error) {
    console.error('Error updating flashcard URLs:', error);
  } finally {
    await client.close();
  }
}

updateFlashcardUrls();
