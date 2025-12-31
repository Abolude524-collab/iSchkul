/**
 * Quiz Management
 * Handles quiz retrieval and submission
 */

const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Quiz endpoint triggered");

  const quizId = req.params.quizId;

  if (req.method === "GET") {
    return await getQuiz(context, req, quizId);
  } else if (req.method === "POST") {
    return await submitQuiz(context, req, quizId);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Get quiz details
 */
async function getQuiz(context, req, quizId) {
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
    const quizzesCollection = db.collection("quizzes");

    const quiz = await quizzesCollection.findOne({
      _id: new ObjectId(quizId),
      $or: [{ createdBy: new ObjectId(userId) }, { groupId: null }] // Allow access to public quizzes
    });

    if (!quiz) {
      context.res = { status: 404, body: JSON.stringify({ error: "Quiz not found" }) };
      return;
    }

    // Transform quiz data to match frontend expectations
    const transformedQuiz = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.title, // Use title as description
      difficulty: quiz.questions[0]?.difficulty || "medium",
      topics: quiz.questions[0]?.tags || [],
      questions: quiz.questions.map(q => ({
        id: q.id,
        text: q.stem,
        options: q.options.map(opt => opt.text),
        correctAnswer: q.options.findIndex(opt => opt.label === q.answer),
        explanation: q.explanation
      }))
    };

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        quiz: transformedQuiz
      })
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get quiz" })
    };
  }
}

/**
 * Submit quiz answers
 */
async function submitQuiz(context, req, quizId) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { answers, score, timeSpent = 0 } = req.body;

    if (!answers || !Array.isArray(answers)) {
      context.res = { status: 400, body: JSON.stringify({ error: "Answers array required" }) };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Get quiz to validate answers
    const quiz = await db.collection("quizzes").findOne({ _id: new ObjectId(quizId) });
    if (!quiz) {
      context.res = { status: 404, body: JSON.stringify({ error: "Quiz not found" }) };
      return;
    }

    // Calculate score if not provided
    let calculatedScore = score;
    if (calculatedScore === undefined) {
      let correctCount = 0;
      quiz.questions.forEach((question, index) => {
        const correctAnswerIndex = question.options.findIndex(opt => opt.label === question.answer);
        if (answers[index] === correctAnswerIndex) {
          correctCount++;
        }
      });
      calculatedScore = (correctCount / quiz.questions.length) * 100;
    }

    // Count previous attempts
    const previousAttempts = await db.collection("quizResults").countDocuments({
      quizId: new ObjectId(quizId),
      userId: new ObjectId(userId)
    });

    // Store quiz result
    const quizResult = {
      quizId: new ObjectId(quizId),
      userId: new ObjectId(userId),
      answers,
      percentage: calculatedScore,
      timeSpent,
      submittedAt: new Date(),
      attemptNumber: previousAttempts + 1,
      correctAnswers: quiz.questions.map(q => q.options.findIndex(opt => opt.label === q.answer))
    };

    await db.collection("quizResults").insertOne(quizResult);

    // Update user XP based on score
    const xpGained = Math.round(calculatedScore * 2); // 200 XP max per quiz
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { xp: xpGained } }
    );

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        score: calculatedScore,
        xpGained,
        attemptNumber: quizResult.attemptNumber,
        resultId: quizResult._id
      })
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to submit quiz" })
    };
  }
}