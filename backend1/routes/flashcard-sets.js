const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

// Custom nanoid replacement using crypto (no external dependencies)
const generateId = (length = 10) => {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
};
const nanoid = () => generateId(10);

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id; // Fix: JWT payload has 'id', not 'userId'
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create a new flashcard set
router.post('/create', auth, async (req, res) => {
  try {
    const { title, description, subject, isPublic = false, tags = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");

    // Generate unique share code
    const shareCode = nanoid();

    const flashcardSet = {
      title,
      description: description || "",
      subject: subject || "",
      tags,
      isPublic,
      shareCode,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared-flashcards/${shareCode}`,
      createdBy: new ObjectId(req.userId),
      cardCount: 0,
      viewCount: 0,
      likeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await setsCollection.insertOne(flashcardSet);

    res.status(201).json({
      success: true,
      setId: result.insertedId,
      shareCode,
      shareUrl: flashcardSet.shareUrl,
      flashcardSet,
    });

    await client.close();
  } catch (error) {
    console.error('Error creating flashcard set:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's flashcard sets
router.get('/list', auth, async (req, res) => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");

    const sets = await setsCollection
      .find({ createdBy: new ObjectId(req.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      sets,
    });

    await client.close();
  } catch (error) {
    console.error('Error getting flashcard sets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public flashcard set by share code
router.get('/public', async (req, res) => {
  try {
    const { shareCode } = req.query;

    if (!shareCode) {
      return res.status(400).json({ error: 'Share code is required' });
    }

    console.log('[Shared Flashcards] Fetching set with shareCode:', shareCode);

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");
    const cardsCollection = db.collection("flashcards");

    // FIXED: Don't require isPublic for shared flashcards - shareCode is the access control
    const set = await setsCollection.findOne({ shareCode });

    if (!set) {
      console.log('[Shared Flashcards] Set not found for shareCode:', shareCode);
      await client.close();
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    console.log('[Shared Flashcards] Set found:', set.title, 'ID:', set._id);

    // Get flashcards for this set
    const flashcards = await cardsCollection
      .find({ setId: set._id })
      .sort({ createdAt: 1 })
      .toArray();

    console.log('[Shared Flashcards] Found', flashcards.length, 'cards for set');

    // Increment view count
    await setsCollection.updateOne(
      { _id: set._id },
      { $inc: { viewCount: 1 } }
    );

    res.json({
      success: true,
      flashcardSet: {
        ...set,
        flashcards,
        cardCount: flashcards.length, // Ensure accurate count
      },
    });

    await client.close();
  } catch (error) {
    console.error('Error getting public flashcard set:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update flashcard set
router.put('/update', auth, async (req, res) => {
  try {
    const { setId, title, description, subject, isPublic, tags } = req.body;

    if (!setId) {
      return res.status(400).json({ error: 'Set ID is required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (tags !== undefined) updateData.tags = tags;
    updateData.updatedAt = new Date();

    const result = await setsCollection.updateOne(
      { _id: new ObjectId(setId), createdBy: new ObjectId(req.userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    res.json({
      success: true,
      message: 'Flashcard set updated successfully',
    });

    await client.close();
  } catch (error) {
    console.error('Error updating flashcard set:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete flashcard set
router.delete('/', auth, async (req, res) => {
  try {
    const { setId } = req.query;

    if (!setId) {
      return res.status(400).json({ error: 'Set ID is required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");
    const cardsCollection = db.collection("flashcards");

    // Delete the set and all its cards
    await setsCollection.deleteOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(req.userId)
    });

    await cardsCollection.deleteMany({
      setId: new ObjectId(setId)
    });

    res.json({
      success: true,
      message: 'Flashcard set deleted successfully',
    });

    await client.close();
  } catch (error) {
    console.error('Error deleting flashcard set:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add cards to set
router.post('/add-cards', auth, async (req, res) => {
  try {
    const { setId, cards } = req.body;

    if (!setId || !cards || !Array.isArray(cards)) {
      return res.status(400).json({ error: 'Set ID and cards array are required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");
    const cardsCollection = db.collection("flashcards");

    // Verify the set belongs to the user
    const set = await setsCollection.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(req.userId)
    });

    if (!set) {
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    // Insert cards
    const cardDocuments = cards.map(card => ({
      userId: new ObjectId(req.userId), // Add userId to each card
      setId: new ObjectId(setId),
      front: card.front,
      back: card.back,
      difficulty: card.difficulty || 'medium',
      tags: card.tags || [],
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await cardsCollection.insertMany(cardDocuments);

    // Update card count
    await setsCollection.updateOne(
      { _id: new ObjectId(setId) },
      {
        $inc: { cardCount: cards.length },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({
      success: true,
      message: `${cards.length} cards added successfully`,
      insertedIds: Object.values(result.insertedIds),
    });

    await client.close();
  } catch (error) {
    console.error('Error adding cards to set:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get share link
router.get('/share-link', auth, async (req, res) => {
  try {
    const { setId } = req.query;

    if (!setId) {
      return res.status(400).json({ error: 'Set ID is required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const setsCollection = db.collection("flashcard_sets");

    const set = await setsCollection.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(req.userId)
    });

    if (!set) {
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    res.json({
      success: true,
      shareUrl: set.shareUrl,
      shareCode: set.shareCode,
    });

    await client.close();
  } catch (error) {
    console.error('Error getting share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;