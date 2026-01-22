const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const multer = require("multer");
const { generateFlashcardsFromText } = require('../utils/flashcardGen');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id; // JWT payload uses 'id' (match flashcard-sets.js)
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get due flashcards for review (spaced repetition)
router.get('/due', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const groupId = req.query.groupId; // setId

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");

    let query = { userId: new ObjectId(req.userId) };
    if (groupId) {
      if (ObjectId.isValid(groupId)) {
        query.setId = new ObjectId(groupId);
      } else {
        console.warn(`[flashcards/due] Invalid groupId: ${groupId}`);
      }
    }

    const now = new Date();
    const dueCards = await cardsCollection
      .find({
        ...query,
        $or: [
          { nextReview: { $lte: now } },
          { nextReview: { $exists: false } }
        ]
      })
      .sort({ nextReview: 1, createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      flashcards: dueCards,
    });

    await client.close();
  } catch (error) {
    console.error('Error getting due flashcards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record a flashcard review
router.post('/review', auth, async (req, res) => {
  try {
    const { flashcardId, quality } = req.body;

    if (!flashcardId || !ObjectId.isValid(flashcardId) || quality === undefined) {
      return res.status(400).json({ error: 'Valid Flashcard ID and quality are required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");
    const reviewsCollection = db.collection("flashcard_reviews");

    const card = await cardsCollection.findOne({
      _id: new ObjectId(flashcardId),
      userId: new ObjectId(req.userId)
    });

    if (!card) {
      return res.status(404).json({ error: 'Flashcard not found' });
    }

    // Spaced repetition algorithm
    const now = new Date();
    let { interval = 1, easeFactor = 2.5, repetitions = 0 } = card;

    if (quality >= 3) {
      // Correct response
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    } else {
      // Incorrect response
      repetitions = 0;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    // Update card
    await cardsCollection.updateOne(
      { _id: new ObjectId(flashcardId) },
      {
        $set: {
          interval,
          easeFactor,
          repetitions,
          nextReview,
          lastReviewed: now,
          updatedAt: now,
        },
        $inc: { reviewCount: 1 }
      }
    );

    // Record review
    await reviewsCollection.insertOne({
      flashcardId: new ObjectId(flashcardId),
      userId: new ObjectId(req.userId),
      quality,
      interval,
      easeFactor,
      repetitions,
      reviewedAt: now,
    });

    res.json({
      success: true,
      nextReview,
    });

    await client.close();
  } catch (error) {
    console.error('Error recording review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get review stats
router.get('/stats', auth, async (req, res) => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");
    const reviewsCollection = db.collection("flashcard_reviews");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total cards
    const totalCards = await cardsCollection.countDocuments({
      userId: new ObjectId(req.userId)
    });

    // Due cards
    const dueCards = await cardsCollection.countDocuments({
      userId: new ObjectId(req.userId),
      $or: [
        { nextReview: { $lte: now } },
        { nextReview: { $exists: false } }
      ]
    });

    // Today's reviews
    const todayReviews = await reviewsCollection.countDocuments({
      userId: new ObjectId(req.userId),
      reviewedAt: { $gte: todayStart }
    });

    // Weekly reviews
    const weeklyReviews = await reviewsCollection.countDocuments({
      userId: new ObjectId(req.userId),
      reviewedAt: { $gte: weekStart }
    });

    res.json({
      success: true,
      stats: {
        totalCards,
        dueCards,
        todayReviews,
        weeklyReviews,
      },
    });

    await client.close();
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a flashcard
router.post('/create', auth, async (req, res) => {
  try {
    const { front, back, tags = [], difficulty = 'medium', setId } = req.body;

    if (!front || !back) {
      return res.status(400).json({ error: 'Front and back content are required' });
    }

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");
    const setsCollection = db.collection("flashcard_sets");

    const cardData = {
      userId: new ObjectId(req.userId),
      front,
      back,
      tags,
      difficulty,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (setId) {
      cardData.setId = new ObjectId(setId);
    }

    const result = await cardsCollection.insertOne(cardData);

    // Update set card count if setId provided
    if (setId) {
      await setsCollection.updateOne(
        { _id: new ObjectId(setId) },
        { $inc: { cardCount: 1 }, $set: { updatedAt: new Date() } }
      );
    }

    res.status(201).json({
      success: true,
      cardId: result.insertedId,
      flashcard: { ...cardData, _id: result.insertedId },
    });

    await client.close();
  } catch (error) {
    console.error('Error creating flashcard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate flashcards (AI-powered with manual fallback)
router.post('/generate', auth, upload.single('file'), async (req, res) => {
  try {
    const { text, numCards = 10, setId, subject } = req.body;
    let content = text || '';

    // Handle file upload using extractText utility
    if (req.file) {
      console.log(`[flashcards] File upload detected:`, {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      const { extractText } = require('../utils/flashcardGen');
      content = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    }

    if (!content) {
      return res.status(400).json({ error: 'Text content or file is required' });
    }

    // Try AI generation first
    let aiFlashcards = [];
    try {
      aiFlashcards = await generateFlashcardsFromText(content, numCards);
    } catch (e) {
      console.warn('[flashcards] AI generation failed, falling back to manual', e && e.message ? e.message : e);
      aiFlashcards = [];
    }

    let flashcards = [];
    if (aiFlashcards && aiFlashcards.length > 0) {
      // Use AI generated
      flashcards = aiFlashcards.map(fc => ({
        front: fc.question || fc.front || fc.prompt || fc.q || '',
        back: fc.answer || fc.back || fc.a || '',
      }));
    } else {
      // Manual fallback
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);

      for (let i = 0; i < Math.min(numCards, sentences.length); i++) {
        const sentence = sentences[i].trim();
        if (sentence.length > 20) {
          // Create front as first part of sentence, back as the rest
          const words = sentence.split(' ');
          const frontWords = words.slice(0, Math.ceil(words.length / 2));
          const backWords = words.slice(Math.ceil(words.length / 2));

          flashcards.push({
            front: frontWords.join(' ') + '?',
            back: backWords.join(' '),
          });
        }
      }

      // If we don't have enough flashcards, create some basic ones
      while (flashcards.length < numCards) {
        flashcards.push({
          front: `Concept ${flashcards.length + 1}`,
          back: `Explanation for concept ${flashcards.length + 1} from the provided text.`,
        });
      }
    }

    // Save flashcards to database
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");
    const setsCollection = db.collection("flashcard_sets");

    const cardDocuments = flashcards.map(card => ({
      userId: new ObjectId(req.userId),
      front: card.front,
      back: card.back,
      tags: [],
      difficulty: 'medium',
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(setId && { setId: new ObjectId(setId) }),
    }));

    const result = await cardsCollection.insertMany(cardDocuments);

    // Update set card count if setId provided
    if (setId) {
      await setsCollection.updateOne(
        { _id: new ObjectId(setId) },
        {
          $inc: { cardCount: flashcards.length },
          $set: {
            updatedAt: new Date(),
            ...(subject ? { subject } : {}),
          }
        }
      );
    }

    res.json({
      success: true,
      flashcards: cardDocuments.map((card, index) => ({
        ...card,
        _id: Object.values(result.insertedIds)[index],
      })),
    });

    await client.close();
  } catch (error) {
    console.error('Error generating flashcards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's flashcards
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const groupId = req.query.groupId; // setId

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const cardsCollection = db.collection("flashcards");

    let query = { userId: new ObjectId(req.userId) };
    if (groupId) {
      if (ObjectId.isValid(groupId)) {
        query.setId = new ObjectId(groupId);
      } else {
        console.warn(`[flashcards/list] Invalid groupId: ${groupId}`);
      }
    }

    const flashcards = await cardsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      flashcards,
    });

    await client.close();
  } catch (error) {
    console.error('Error getting flashcards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export flashcard set as PDF with copyright
router.get('/:setId/export/pdf', auth, async (req, res) => {
  try {
    const { setId } = req.params;
    const userId = req.userId;

    // Get flashcard set and cards
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const flashcardSetsCol = db.collection('flashcard_sets');
    const flashcardsCol = db.collection('flashcards');
    const set = await flashcardSetsCol.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(userId)
    });

    if (!set) {
      await client.close();
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    const cards = await flashcardsCol.find({ setId: new ObjectId(setId) }).toArray();

    if (!cards || cards.length === 0) {
      await client.close();
      return res.status(404).json({ error: 'No flashcards found in set' });
    }

    await client.close();

    // Create PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      margin: 0, // We'll handle margins manually for the background
      size: 'A4'
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${set.title || 'flashcards'}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    const titlePage = () => {
      // Background gradient-ish header
      doc.rect(0, 0, doc.page.width, 250).fill('#2563eb');

      // Decorative elements
      doc.circle(doc.page.width, 0, 150).fill('#1d4ed8');
      doc.circle(0, 250, 100).fill('#3b82f6');

      // Title
      doc.font('Helvetica-Bold').fontSize(42).fillColor('#ffffff')
        .text('Flashcard Set', 50, 80);

      doc.fontSize(24).text(set.title || 'Untitled Set', 50, 140, { width: doc.page.width - 100 });

      // Metadata box
      doc.rect(50, 280, doc.page.width - 100, 120).fill('#f8fafc');
      doc.rect(50, 280, doc.page.width - 100, 120).lineWidth(1).stroke('#e2e8f0');

      doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('Subject:', 70, 305);
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b').text(set.subject || 'General', 140, 305);

      doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('Created:', 70, 340);
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b').text(new Date().toLocaleDateString(), 140, 340);

      doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('Cards:', 70, 375);
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b').text(`${cards.length} Mastery Cards`, 140, 375);

      // Footer branding
      doc.fontSize(12).fillColor('#94a3b8').text('Powered by iSchkul Mastery System', 0, doc.page.height - 100, { align: 'center', width: doc.page.width });
    };

    titlePage();

    // Add each flashcard
    cards.forEach((card, index) => {
      doc.addPage({ margin: 40 });

      // Page Header - Compact
      doc.rect(0, 0, doc.page.width, 50).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155')
        .text(set.title || 'Flashcards', 30, 20);
      doc.font('Helvetica').fontSize(9).fillColor('#64748b')
        .text(`Card ${index + 1} of ${cards.length}`, 0, 21, { align: 'right', width: doc.page.width - 30 });

      // Main Content Box
      const contentY = 80;
      const boxWidth = doc.page.width - 80; // Margin 40 on each side

      // Question Section
      doc.rect(40, contentY, boxWidth, 30).fill('#eff6ff');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#2563eb')
        .text('QUESTION', 55, contentY + 10);

      doc.rect(40, contentY + 30, boxWidth, 140).lineWidth(1).stroke('#dbeafe');
      doc.font('Helvetica').fontSize(16).fillColor('#0f172a')
        .text(card.front || card.question || 'N/A', 60, contentY + 55, {
          width: boxWidth - 40,
          align: 'center',
          height: 100,
          ellipsis: true
        });

      // Answer Section
      const answerY = contentY + 200;
      doc.rect(40, answerY, boxWidth, 30).fill('#f5f3ff');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#7c3aed')
        .text('ANSWER', 55, answerY + 10);

      doc.rect(40, answerY + 30, boxWidth, 220).lineWidth(1).stroke('#ede9fe');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b')
        .text(card.back || card.answer || 'N/A', 60, answerY + 65, {
          width: boxWidth - 40,
          align: 'center',
          height: 180,
          ellipsis: true
        });

      // Tags if any - closer to the answer box
      if (card.tags && card.tags.length > 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
          .text(`Tags: ${card.tags.join(', ')}`, 40, answerY + 260);
      }

      // Footer - Placed higher to avoid overflow
      const footerY = doc.page.height - 40;
      doc.fontSize(9).fillColor('#cbd5e1').text(
        `© 2026 iSchkul - ${set.title || 'Flashcards'} Study Guide`,
        40,
        footerY,
        { align: 'center', width: doc.page.width - 80 }
      );
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Download individual flashcard as image/PDF
router.get('/:setId/cards/:cardId/download', auth, async (req, res) => {
  try {
    const { setId, cardId } = req.params;
    const userId = req.userId;

    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul');
    await client.connect();
    const db = client.db();
    const flashcardSetsCol = db.collection('flashcard_sets');
    const flashcardsCol = db.collection('flashcards');

    // Verify ownership
    const set = await flashcardSetsCol.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(userId)
    });

    if (!set) {
      await client.close();
      return res.status(404).json({ error: 'Flashcard set not found' });
    }

    const card = await flashcardsCol.findOne({
      _id: new ObjectId(cardId),
      setId: new ObjectId(setId)
    });

    if (!card) {
      await client.close();
      return res.status(404).json({ error: 'Flashcard not found' });
    }

    await client.close();

    // Create single-card PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A6',
      layout: 'landscape',
      margin: 0
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="flashcard-${cardId}.pdf"`);

    doc.pipe(res);

    // Decorative background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
    doc.rect(0, 0, doc.page.width, 40).fill('#2563eb');

    // Header text
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
      .text('ISCHKUL FLASHCARD', 20, 15);

    if (set.title) {
      doc.font('Helvetica').fontSize(8).fillColor('#bfdbfe')
        .text(set.title.toUpperCase(), 0, 16, { align: 'right', width: doc.page.width - 20 });
    }

    // Question Section
    doc.fillColor('#2563eb').fontSize(10).font('Helvetica-Bold').text('QUESTION', 20, 60);
    doc.rect(20, 75, doc.page.width - 40, 80).lineWidth(0.5).stroke('#dbeafe');

    doc.fillColor('#0f172a').fontSize(14).font('Helvetica').text(
      card.front || card.question || 'N/A',
      30,
      95,
      { width: doc.page.width - 60, align: 'center' }
    );

    // Answer Section
    doc.fillColor('#7c3aed').fontSize(10).font('Helvetica-Bold').text('ANSWER', 20, 175);
    doc.rect(20, 190, doc.page.width - 40, 80).lineWidth(0.5).stroke('#ede9fe');

    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text(
      card.back || card.answer || 'N/A',
      30,
      210,
      { width: doc.page.width - 60, align: 'center' }
    );

    // Footer
    doc.fontSize(7).fillColor('#94a3b8').text(
      '© 2026 iSchkul Mastery System',
      0,
      doc.page.height - 20,
      { align: 'center', width: doc.page.width }
    );

    doc.end();
  } catch (error) {
    console.error('Error downloading card:', error);
    res.status(500).json({ error: 'Failed to download card' });
  }
});

module.exports = router;