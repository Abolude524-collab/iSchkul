/**
 * Flashcard Review System
 * Implements spaced repetition with review tracking
 */

const { MongoClient, ObjectId } = require("mongodb");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const jwt = require("jsonwebtoken");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const multer = require("multer");
const stream = require("stream");

module.exports = async function (context, req) {
  context.log("Flashcard review endpoint triggered");

  const action = req.params.action;

  if (req.method === "GET" && action === "due") {
    return await getDueFlashcards(context, req);
  } else if (req.method === "POST" && action === "review") {
    return await recordReview(context, req);
  } else if (req.method === "GET" && action === "stats") {
    return await getReviewStats(context, req);
  } else if (req.method === "POST" && action === "create") {
    return await createFlashcard(context, req);
  } else if (req.method === "POST" && action === "generate") {
    return await generateFlashcards(context, req);
  } else if (req.method === "GET") {
    return await getUserFlashcards(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Get due flashcards for review (spaced repetition)
 */
async function getDueFlashcards(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const limit = parseInt(req.query.limit) || 20;
    const groupId = req.query.groupId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const flashcardsCollection = db.collection("flashcards");

    const now = new Date();

    // Find flashcards due for review
    const query = {
      $or: [{ createdBy: new ObjectId(userId) }, { setId: groupId ? new ObjectId(groupId) : null }],
      $or: [{ nextReview: { $lte: now } }, { nextReview: { $exists: false } }],
      archived: { $ne: true },
    };

    const dueCards = await flashcardsCollection
      .find(query)
      .sort({ nextReview: 1 })
      .limit(limit)
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: dueCards.length,
        flashcards: dueCards,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get due flashcards" }),
    };
  }
}

/**
 * Record flashcard review with spaced repetition algorithm
 */
async function recordReview(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { flashcardId, quality } = req.body; // quality: 0-5 (0=fail, 5=perfect)

    if (!flashcardId || quality === undefined) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "flashcardId and quality required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const flashcardsCollection = db.collection("flashcards");
    const reviewsCollection = db.collection("flashcard_reviews");

    const flashcard = await flashcardsCollection.findOne({ _id: new ObjectId(flashcardId) });

    if (!flashcard) {
      context.res = { status: 404, body: JSON.stringify({ error: "Flashcard not found" }) };
      await client.close();
      return;
    }

    // Spaced repetition algorithm (SM-2)
    const currentInterval = flashcard.interval || 0;
    const currentEaseFactor = flashcard.easeFactor || 2.5;
    const currentRepetitions = flashcard.repetitions || 0;

    let newInterval, newEaseFactor, newRepetitions;

    if (quality >= 3) {
      // Correct answer
      if (currentRepetitions === 0) {
        newInterval = 1;
      } else if (currentRepetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentInterval * currentEaseFactor);
      }
      newRepetitions = currentRepetitions + 1;
    } else {
      // Incorrect answer - reset
      newInterval = 1;
      newRepetitions = 0;
    }

    // Update ease factor
    newEaseFactor = Math.max(
      1.3,
      currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    // Update flashcard
    const reviewCount = (flashcard.reviewCount || 0) + 1;
    const correctCount = quality >= 3 ? (flashcard.correctCount || 0) + 1 : flashcard.correctCount || 0;
    const successRate = correctCount / reviewCount;

    await flashcardsCollection.updateOne(
      { _id: new ObjectId(flashcardId) },
      {
        $set: {
          interval: newInterval,
          easeFactor: newEaseFactor,
          repetitions: newRepetitions,
          nextReview,
          lastReviewed: new Date(),
          reviewCount,
          correctCount,
          successRate,
          updatedAt: new Date(),
        },
      }
    );

    // Log review
    await reviewsCollection.insertOne({
      flashcardId: new ObjectId(flashcardId),
      userId: new ObjectId(userId),
      quality,
      interval: newInterval,
      reviewedAt: new Date(),
    });

    // Award XP
    const usersCollection = db.collection("users");
    const xpGain = quality >= 3 ? 5 : 2;
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { total_xp: xpGain }, $set: { last_active_date: new Date() } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        nextReview,
        interval: newInterval,
        xpGained: xpGain,
        message: quality >= 3 ? "Great job!" : "Keep practicing!",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to record review" }),
    };
  }
}

/**
 * Get review statistics
 */
async function getReviewStats(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Aggregate stats
    const stats = await db.collection("flashcards").aggregate([
      { $match: { createdBy: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalCards: { $sum: 1 },
          avgSuccessRate: { $avg: "$successRate" },
          totalReviews: { $sum: "$reviewCount" },
          dueToday: {
            $sum: {
              $cond: [{ $lte: ["$nextReview", new Date()] }, 1, 0],
            },
          },
        },
      },
    ]).toArray();

    const reviewHistory = await db.collection("flashcard_reviews")
      .find({ userId: new ObjectId(userId) })
      .sort({ reviewedAt: -1 })
      .limit(100)
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        stats: stats[0] || {
          totalCards: 0,
          avgSuccessRate: 0,
          totalReviews: 0,
          dueToday: 0,
        },
        recentReviews: reviewHistory,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get stats" }),
    };
  }
}

/**
 * Create new flashcard
 */
async function createFlashcard(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { front, back, tags, difficulty, setId } = req.body;

    if (!front || !back) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "front and back required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const flashcardsCollection = db.collection("flashcards");

    const flashcard = {
      front,
      back,
      tags: tags || [],
      difficulty: difficulty || "medium",
      createdBy: new ObjectId(userId),
      setId: setId ? new ObjectId(setId) : null,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      nextReview: new Date(),
      lastReviewed: null,
      reviewCount: 0,
      correctCount: 0,
      successRate: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await flashcardsCollection.insertOne(flashcard);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        flashcardId: result.insertedId,
        flashcard,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to create flashcard" }),
    };
  }
}

/**
 * Generate flashcards from text or file using AI
 */
async function generateFlashcards(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { text, numCards = 10, setId, file } = req.body;

    let textToProcess = text;

    // If file uploaded, extract text
    if (file) {
      const fileBuffer = Buffer.from(file.data, 'base64');
      
      if (file.mimetype === "application/pdf") {
        // Extract text from PDF
        const data = await pdfParse(fileBuffer);
        textToProcess = data.text;
      } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Extract text from DOCX
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        textToProcess = result.value;
      } else {
        context.res = {
          status: 400,
          body: JSON.stringify({ error: "Unsupported file type. Only PDF and DOCX allowed." }),
        };
        return;
      }
    }

    if (!textToProcess || textToProcess.trim().length === 0) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "No text content found to process" }),
      };
      return;
    }

    // Initialize Azure OpenAI
    const client = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
    );

    // System prompt for flashcard generation
    const systemPrompt = `You are an expert educational content creator. Generate exactly ${numCards} high-quality flashcards from the provided text.

STRICT REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanation)
- Each flashcard must have a clear, concise front (question/concept) and back (answer/explanation)
- Front should be 1-2 sentences max
- Back should be comprehensive but concise
- Assign difficulty: easy|medium|hard based on complexity
- Add relevant subject tags as array

RESPONSIBLE AI:
- Forbid discriminatory, harmful, or non-educational content
- Ensure cultural sensitivity and inclusivity
- Never generate misleading or incorrect information

JSON SCHEMA (REQUIRED):
{
  "flashcards": [
    {
      "front": "question or concept",
      "back": "answer or explanation",
      "difficulty": "easy|medium|hard",
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

    const response = await client.getChatCompletions(process.env.AZURE_OPENAI_DEPLOYMENT, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate ${numCards} flashcards from this text:\n\n${text}` }
    ]);

    const aiResponse = response.choices[0].message.content;
    const parsed = JSON.parse(aiResponse);

    // Save generated flashcards to database
    const clientDb = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await clientDb.connect();
    const db = clientDb.db(process.env.COSMOS_DB_NAME);
    const flashcardsCollection = db.collection("flashcards");

    const flashcards = parsed.flashcards.map(card => ({
      front: card.front,
      back: card.back,
      tags: card.tags || [],
      difficulty: card.difficulty || "medium",
      createdBy: new ObjectId(userId),
      setId: setId ? new ObjectId(setId) : null,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      nextReview: new Date(),
      lastReviewed: null,
      reviewCount: 0,
      correctCount: 0,
      successRate: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await flashcardsCollection.insertMany(flashcards);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        generated: flashcards.length,
        flashcards: flashcards.map((card, index) => ({
          ...card,
          _id: result.insertedIds[index]
        })),
      }),
    };

    await clientDb.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to generate flashcards" }),
    };
  }
}

/**
 * Get user's flashcards
 */
async function getUserFlashcards(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const groupId = req.query.groupId;
    const limit = parseInt(req.query.limit) || 50;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const flashcardsCollection = db.collection("flashcards");

    const query = {
      $or: [{ createdBy: new ObjectId(userId) }, { setId: groupId ? new ObjectId(groupId) : null }],
      archived: { $ne: true },
    };

    const flashcards = await flashcardsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: flashcards.length,
        flashcards,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get flashcards" }),
    };
  }
}
