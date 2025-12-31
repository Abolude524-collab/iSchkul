/**
 * Analytics Dashboard Backend
 * Provides aggregated metrics and insights
 */

const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Analytics endpoint triggered");

  const action = req.params.action;

  if (req.method === "GET" && action === "overview") {
    return await getOverview(context, req);
  } else if (req.method === "GET" && action === "users") {
    return await getUserAnalytics(context, req);
  } else if (req.method === "GET" && action === "quizzes") {
    return await getQuizAnalytics(context, req);
  } else if (req.method === "GET" && action === "engagement") {
    return await getEngagementAnalytics(context, req);
  } else if (req.method === "GET" && action === "flashcards") {
    return await getFlashcardAnalytics(context, req);
  } else if (req.method === "GET" && action === "groups") {
    return await getGroupAnalytics(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Get overview analytics
 */
async function getOverview(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Get counts
    const totalUsers = await db.collection("users").countDocuments();
    const totalQuizzes = await db.collection("quizzes").countDocuments();
    const totalFlashcards = await db.collection("flashcards").countDocuments();
    const totalGroups = await db.collection("groups").countDocuments();
    const totalMessages = await db.collection("messages").countDocuments();

    // Active users (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await db
      .collection("users")
      .countDocuments({ lastSeen: { $gte: sevenDaysAgo } });

    // Online users now
    const onlineUsers = await db.collection("users").countDocuments({ isOnline: true });

    // Recent activities (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivities = await db
      .collection("activities")
      .countDocuments({ createdAt: { $gte: oneDayAgo } });

    // Quiz completion rate
    const completedQuizzes = await db.collection("quizResults").countDocuments();
    const quizCompletionRate =
      totalQuizzes > 0 ? ((completedQuizzes / totalQuizzes) * 100).toFixed(2) : 0;

    // Average quiz score
    const avgScoreResult = await db
      .collection("quizResults")
      .aggregate([
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$score" },
            avgPercentage: { $avg: "$percentage" },
          },
        },
      ])
      .toArray();

    const avgScore = avgScoreResult.length > 0 ? avgScoreResult[0].avgPercentage.toFixed(2) : 0;

    // Flashcard review rate
    const flashcardReviews = await db.collection("flashcard_reviews").countDocuments();
    const avgReviewsPerCard =
      totalFlashcards > 0 ? (flashcardReviews / totalFlashcards).toFixed(2) : 0;

    // New users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await db.collection("users").countDocuments({
      createdAt: { $gte: today }
    });

    // Quiz attempts
    const quizAttempts = await db.collection("quizResults").countDocuments();

    // User growth over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const userGrowth = await db.collection("users")
      .aggregate([
        {
          $match: { createdAt: { $gte: thirtyDaysAgo } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ])
      .toArray();

    // Quiz performance by subject
    const quizPerformance = await db.collection("quizResults")
      .aggregate([
        {
          $lookup: {
            from: "quizzes",
            localField: "quizId",
            foreignField: "_id",
            as: "quiz"
          }
        },
        { $unwind: "$quiz" },
        {
          $group: {
            _id: "$quiz.subject",
            avgScore: { $avg: "$percentage" },
            attempts: { $sum: 1 }
          }
        },
        {
          $project: {
            subject: { $ifNull: ["$_id", "General"] },
            avgScore: { $round: ["$avgScore", 1] },
            attempts: 1,
            _id: 0
          }
        },
        { $sort: { attempts: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    // Feature usage
    const featureUsage = {
      quizzes: await db.collection("quizResults").countDocuments(),
      flashcards: await db.collection("flashcard_reviews").countDocuments(),
      chat: await db.collection("messages").countDocuments(),
      files: await db.collection("files").countDocuments(),
    };

    // Recent activity
    const recentActivity = await db.collection("activities")
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            type: "$type",
            user: { $ifNull: ["$user.displayName", "Unknown User"] },
            action: "$action",
            timestamp: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M",
                date: "$createdAt"
              }
            }
          }
        }
      ])
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        overview: {
          totalUsers,
          totalQuizzes,
          totalFlashcards,
          totalMessages,
          activeUsers,
          newUsersToday,
          quizAttempts,
          avgScore: parseFloat(avgScore),
        },
        userGrowth: userGrowth.map(item => ({
          date: item._id,
          count: item.count
        })),
        quizPerformance,
        featureUsage,
        recentActivity,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get overview analytics" }),
    };
  }
}

/**
 * Get user analytics
 */
async function getUserAnalytics(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Daily active users (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyActiveUsers = await db
      .collection("activities")
      .aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
        {
          $project: {
            date: "$_id",
            count: { $size: "$uniqueUsers" },
          },
        },
        { $sort: { date: 1 } },
      ])
      .toArray();

    // User growth (monthly signups)
    const userGrowth = await db
      .collection("users")
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { month: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // User categories distribution
    const categoryDistribution = await db
      .collection("users")
      .aggregate([
        { $group: { _id: "$studentcategory", count: { $sum: 1 } } },
        { $project: { category: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // Top institutions
    const topInstitutions = await db
      .collection("users")
      .aggregate([
        { $match: { institution: { $ne: null, $ne: "" } } },
        { $group: { _id: "$institution", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { institution: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // User retention (7-day, 30-day)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usersCreatedSevenDaysAgo = await db
      .collection("users")
      .countDocuments({ createdAt: { $lte: sevenDaysAgo } });

    const usersActiveInLast7Days = await db
      .collection("users")
      .countDocuments({ createdAt: { $lte: sevenDaysAgo }, lastSeen: { $gte: sevenDaysAgo } });

    const sevenDayRetention =
      usersCreatedSevenDaysAgo > 0
        ? ((usersActiveInLast7Days / usersCreatedSevenDaysAgo) * 100).toFixed(2)
        : 0;

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        dailyActiveUsers,
        userGrowth,
        categoryDistribution,
        topInstitutions,
        retention: {
          sevenDay: parseFloat(sevenDayRetention),
        },
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get user analytics" }),
    };
  }
}

/**
 * Get quiz analytics
 */
async function getQuizAnalytics(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Quizzes created over time
    const quizzesOverTime = await db
      .collection("quizzes")
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
        { $project: { date: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // Average scores by difficulty
    const scoresByDifficulty = await db
      .collection("quizResults")
      .aggregate([
        {
          $lookup: {
            from: "quizzes",
            localField: "quizId",
            foreignField: "_id",
            as: "quiz",
          },
        },
        { $unwind: "$quiz" },
        {
          $group: {
            _id: "$quiz.difficulty",
            avgScore: { $avg: "$percentage" },
            count: { $sum: 1 },
          },
        },
        { $project: { difficulty: "$_id", avgScore: 1, count: 1, _id: 0 } },
      ])
      .toArray();

    // Popular topics
    const popularTopics = await db
      .collection("quizzes")
      .aggregate([
        { $unwind: "$topics" },
        { $group: { _id: "$topics", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { topic: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // Completion rate per quiz
    const quizCompletionStats = await db
      .collection("quizzes")
      .aggregate([
        {
          $lookup: {
            from: "quizResults",
            localField: "_id",
            foreignField: "quizId",
            as: "results",
          },
        },
        {
          $project: {
            title: 1,
            totalAttempts: { $size: "$results" },
            avgScore: { $avg: "$results.percentage" },
          },
        },
        { $sort: { totalAttempts: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        quizzesOverTime,
        scoresByDifficulty,
        popularTopics,
        topQuizzes: quizCompletionStats,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get quiz analytics" }),
    };
  }
}

/**
 * Get engagement analytics
 */
async function getEngagementAnalytics(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Activity types distribution
    const activityTypeDistribution = await db
      .collection("activities")
      .aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { type: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // Messages over time
    const messagesOverTime = await db
      .collection("messages")
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
        { $project: { date: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // Most active users
    const mostActiveUsers = await db
      .collection("activities")
      .aggregate([
        {
          $group: {
            _id: "$userId",
            activityCount: { $sum: 1 },
          },
        },
        { $sort: { activityCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: "$_id",
            activityCount: 1,
            name: "$user.name",
            username: "$user.username",
            avatar: "$user.avatar",
            total_xp: "$user.total_xp",
            _id: 0,
          },
        },
      ])
      .toArray();

    // Average session duration (placeholder - would need session tracking)
    const avgSessionDuration = "15 min"; // Placeholder

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        activityTypeDistribution,
        messagesOverTime,
        mostActiveUsers,
        avgSessionDuration,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get engagement analytics" }),
    };
  }
}

/**
 * Get flashcard analytics
 */
async function getFlashcardAnalytics(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Total reviews over time
    const reviewsOverTime = await db
      .collection("flashcard_reviews")
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$reviewedAt" },
            },
            count: { $sum: 1 },
            avgQuality: { $avg: "$quality" },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
        { $project: { date: "$_id", count: 1, avgQuality: 1, _id: 0 } },
      ])
      .toArray();

    // Success rate distribution
    const successRateDistribution = await db
      .collection("flashcards")
      .aggregate([
        { $match: { successRate: { $exists: true, $ne: null } } },
        {
          $bucket: {
            groupBy: "$successRate",
            boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ])
      .toArray();

    // Average ease factor
    const avgEaseFactorResult = await db
      .collection("flashcards")
      .aggregate([
        {
          $group: {
            _id: null,
            avgEaseFactor: { $avg: "$easeFactor" },
            avgInterval: { $avg: "$interval" },
          },
        },
      ])
      .toArray();

    const avgEaseFactor =
      avgEaseFactorResult.length > 0 ? avgEaseFactorResult[0].avgEaseFactor.toFixed(2) : 2.5;
    const avgInterval =
      avgEaseFactorResult.length > 0 ? avgEaseFactorResult[0].avgInterval.toFixed(2) : 0;

    // Most reviewed flashcards
    const mostReviewedCards = await db
      .collection("flashcards")
      .find()
      .sort({ reviewCount: -1 })
      .limit(10)
      .project({ front: 1, back: 1, reviewCount: 1, successRate: 1 })
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        reviewsOverTime,
        successRateDistribution,
        avgEaseFactor: parseFloat(avgEaseFactor),
        avgInterval: parseFloat(avgInterval),
        mostReviewedCards,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get flashcard analytics" }),
    };
  }
}

/**
 * Get group analytics
 */
async function getGroupAnalytics(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Total groups
    const totalGroups = await db.collection("groups").countDocuments();

    // Average group size
    const avgGroupSizeResult = await db
      .collection("groups")
      .aggregate([
        {
          $project: {
            memberCount: { $size: { $ifNull: ["$memberIds", []] } },
          },
        },
        {
          $group: {
            _id: null,
            avgSize: { $avg: "$memberCount" },
          },
        },
      ])
      .toArray();

    const avgGroupSize =
      avgGroupSizeResult.length > 0 ? avgGroupSizeResult[0].avgSize.toFixed(2) : 0;

    // Most active groups
    const mostActiveGroups = await db
      .collection("messages")
      .aggregate([
        { $match: { groupId: { $ne: null } } },
        {
          $group: {
            _id: "$groupId",
            messageCount: { $sum: 1 },
          },
        },
        { $sort: { messageCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "groups",
            localField: "_id",
            foreignField: "_id",
            as: "group",
          },
        },
        { $unwind: "$group" },
        {
          $project: {
            groupId: "$_id",
            messageCount: 1,
            name: "$group.name",
            description: "$group.description",
            memberCount: { $size: { $ifNull: ["$group.memberIds", []] } },
            _id: 0,
          },
        },
      ])
      .toArray();

    // Groups created over time
    const groupsOverTime = await db
      .collection("groups")
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { month: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        totalGroups,
        avgGroupSize: parseFloat(avgGroupSize),
        mostActiveGroups,
        groupsOverTime,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get group analytics" }),
    };
  }
}
