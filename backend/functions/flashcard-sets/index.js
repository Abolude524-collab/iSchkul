/**
 * Flashcard Sets Management
 * Create, share, and manage flashcard sets
 */

const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);

module.exports = async function (context, req) {
  context.log("Flashcard sets endpoint triggered");

  const action = req.params.action;

  if (req.method === "POST" && action === "create") {
    return await createFlashcardSet(context, req);
  } else if (req.method === "GET" && action === "list") {
    return await getUserFlashcardSets(context, req);
  } else if (req.method === "GET" && action === "public") {
    return await getPublicFlashcardSet(context, req);
  } else if (req.method === "PUT" && action === "update") {
    return await updateFlashcardSet(context, req);
  } else if (req.method === "DELETE") {
    return await deleteFlashcardSet(context, req);
  } else if (req.method === "POST" && action === "add-cards") {
    return await addCardsToSet(context, req);
  } else if (req.method === "GET" && action === "share-link") {
    return await getShareLink(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Create a new flashcard set
 */
async function createFlashcardSet(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { title, description, subject, isPublic = false, tags = [] } = req.body;

    if (!title) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Title is required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
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
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared-flashcards/${shareCode}`,
      createdBy: new ObjectId(userId),
      cardCount: 0,
      viewCount: 0,
      likeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await setsCollection.insertOne(flashcardSet);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        setId: result.insertedId,
        shareCode,
        shareUrl: flashcardSet.shareUrl,
        flashcardSet,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to create flashcard set" }),
    };
  }
}

/**
 * Get user's flashcard sets
 */
async function getUserFlashcardSets(context, req) {
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
    const setsCollection = db.collection("flashcard_sets");

    const sets = await setsCollection
      .find({ createdBy: new ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .toArray();

    // Get card count for each set
    for (const set of sets) {
      const cardCount = await db.collection("flashcards").countDocuments({
        setId: set._id,
        archived: { $ne: true }
      });
      set.cardCount = cardCount;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        sets,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get flashcard sets" }),
    };
  }
}

/**
 * Get public flashcard set (no auth required)
 */
async function getPublicFlashcardSet(context, req) {
  try {
    const { shareCode } = req.query;

    if (!shareCode) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Share code is required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const setsCollection = db.collection("flashcard_sets");

    const flashcardSet = await setsCollection.findOne({ shareCode });

    if (!flashcardSet) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "Flashcard set not found" }),
      };
      await client.close();
      return;
    }

    // Increment view count
    await setsCollection.updateOne(
      { _id: flashcardSet._id },
      { $inc: { viewCount: 1 } }
    );

    // Get flashcards in this set
    const flashcards = await db.collection("flashcards")
      .find({
        setId: flashcardSet._id,
        archived: { $ne: true }
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Remove sensitive data
    const publicSet = {
      _id: flashcardSet._id,
      title: flashcardSet.title,
      description: flashcardSet.description,
      subject: flashcardSet.subject,
      tags: flashcardSet.tags,
      cardCount: flashcards.length,
      viewCount: flashcardSet.viewCount + 1,
      likeCount: flashcardSet.likeCount,
      createdAt: flashcardSet.createdAt,
      flashcards: flashcards.map(card => ({
        _id: card._id,
        front: card.front,
        back: card.back,
        difficulty: card.difficulty,
        tags: card.tags,
      })),
    };

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        flashcardSet: publicSet,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get flashcard set" }),
    };
  }
}

/**
 * Update flashcard set
 */
async function updateFlashcardSet(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { setId, title, description, subject, isPublic, tags } = req.body;

    if (!setId) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Set ID is required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const setsCollection = db.collection("flashcard_sets");

    const result = await setsCollection.updateOne(
      { _id: new ObjectId(setId), createdBy: new ObjectId(userId) },
      {
        $set: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(subject !== undefined && { subject }),
          ...(isPublic !== undefined && { isPublic }),
          ...(tags && { tags }),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "Flashcard set not found or access denied" }),
      };
      await client.close();
      return;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        message: "Flashcard set updated successfully",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to update flashcard set" }),
    };
  }
}

/**
 * Delete flashcard set
 */
async function deleteFlashcardSet(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const setId = req.query.setId;

    if (!setId) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Set ID is required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Delete set
    const setsCollection = db.collection("flashcard_sets");
    const setResult = await setsCollection.deleteOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(userId)
    });

    if (setResult.deletedCount === 0) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "Flashcard set not found or access denied" }),
      };
      await client.close();
      return;
    }

    // Delete all flashcards in the set
    const flashcardsCollection = db.collection("flashcards");
    await flashcardsCollection.deleteMany({ setId: new ObjectId(setId) });

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        message: "Flashcard set and all cards deleted successfully",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to delete flashcard set" }),
    };
  }
}

/**
 * Add cards to a set
 */
async function addCardsToSet(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { setId, cards } = req.body;

    if (!setId || !cards || !Array.isArray(cards)) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Set ID and cards array are required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Verify set ownership
    const setsCollection = db.collection("flashcard_sets");
    const flashcardSet = await setsCollection.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(userId)
    });

    if (!flashcardSet) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "Flashcard set not found or access denied" }),
      };
      await client.close();
      return;
    }

    // Create flashcards
    const flashcardsCollection = db.collection("flashcards");
    const flashcardDocuments = cards.map(card => ({
      front: card.front,
      back: card.back,
      tags: card.tags || [],
      difficulty: card.difficulty || "medium",
      setId: new ObjectId(setId),
      createdBy: new ObjectId(userId),
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

    const result = await flashcardsCollection.insertMany(flashcardDocuments);

    // Update set card count
    await setsCollection.updateOne(
      { _id: new ObjectId(setId) },
      {
        $inc: { cardCount: result.insertedCount },
        $set: { updatedAt: new Date() }
      }
    );

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} cards added to set successfully`,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to add cards to set" }),
    };
  }
}

/**
 * Get share link for a set
 */
async function getShareLink(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const setId = req.query.setId;

    if (!setId) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Set ID is required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const setsCollection = db.collection("flashcard_sets");

    const flashcardSet = await setsCollection.findOne({
      _id: new ObjectId(setId),
      createdBy: new ObjectId(userId)
    });

    if (!flashcardSet) {
      context.res = {
        status: 404,
        body: JSON.stringify({ error: "Flashcard set not found or access denied" }),
      };
      await client.close();
      return;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        shareCode: flashcardSet.shareCode,
        shareUrl: flashcardSet.shareUrl,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get share link" }),
    };
  }
}