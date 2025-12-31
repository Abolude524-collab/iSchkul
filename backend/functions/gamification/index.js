const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Gamification endpoint triggered");

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const action = req.params.action;

    if (req.method === "POST" && action === "award") {
      return await awardXp(context, req, userId);
    } else if (req.method === "POST" && action === "enter") {
      return await userEnter(context, req, userId);
    } else if (req.method === "GET" && action === "leaderboard") {
      return await getLeaderboard(context, req);
    } else if (req.method === "GET" && action === "history") {
      return await getXpHistory(context, req, userId);
    } else if (req.method === "GET" && action === "activity") {
      return await getUserActivity(context, req, userId);
    } else if (req.method === "POST" && action === "join-leaderboard") {
      return await joinLeaderboard(context, req, userId);
    } else if (req.method === "POST" && action === "leave-leaderboard") {
      return await leaveLeaderboard(context, req, userId);
    } else if (req.method === "GET" && action === "badges") {
      return await getUserBadges(context, req, userId);
    } else if (req.method === "GET" && action === "awards") {
      return await getUserAwards(context, req, userId);
    }

    context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

const BASE_XP_MAP = {
  QUIZ_COMPLETE: 10,
  FLASHCARD_COMPLETE: 5,
  NOTE_SUMMARY: 5,
  APP_ENTRY: 0, // Special case for daily streak
};

const DAILY_BASE_CAP = 50;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isYesterday(date, now = new Date()) {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  return date >= yesterdayStart && date < todayStart;
}

async function awardXp(context, req, userId) {
  const { activity_type } = req.body;

  if (!activity_type) {
    context.res = { status: 400, body: JSON.stringify({ error: "activity_type required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");
  const xpLogsCollection = db.collection("xpLogs");

  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      context.res = { status: 404, body: JSON.stringify({ error: "User not found" }) };
      return;
    }

    let totalAwarded = 0;
    const logsToInsert = [];

    // 1. XP Award Logic
    const baseXp = BASE_XP_MAP[activity_type] || 0;
    if (baseXp > 0) {
      if (activity_type === 'QUIZ_COMPLETE' || activity_type === 'FLASHCARD_COMPLETE') {
        logsToInsert.push({
          user_id: new ObjectId(userId),
          xp_earned: baseXp,
          activity_type,
          timestamp: now
        });
        totalAwarded += baseXp;
      } else {
        const todayBase = await xpLogsCollection.aggregate([
          {
            $match: {
              user_id: new ObjectId(userId),
              timestamp: { $gte: todayStart, $lt: todayEnd },
              activity_type: { $in: ['QUIZ_COMPLETE', 'FLASHCARD_COMPLETE', 'NOTE_SUMMARY'] }
            }
          },
          { $group: { _id: null, xp: { $sum: '$xp_earned' } } }
        ]).toArray();
        const todaysXp = todayBase?.[0]?.xp || 0;
        if (todaysXp < DAILY_BASE_CAP) {
          const allowable = Math.min(baseXp, DAILY_BASE_CAP - todaysXp);
          if (allowable > 0) {
            logsToInsert.push({
              user_id: new ObjectId(userId),
              xp_earned: allowable,
              activity_type,
              timestamp: now
            });
            totalAwarded += allowable;
          }
        }
      }
    }

    // 2. Streak Logic (Atomic Upsert to prevent race conditions)
    let streakAwarded = false;
    let newStreak = user.current_streak || 0;

    if (activity_type === 'APP_ENTRY') {
      try {
        const streakResult = await xpLogsCollection.findOneAndUpdate(
          {
            user_id: new ObjectId(userId),
            activity_type: 'DAILY_STREAK',
            timestamp: { $gte: todayStart, $lt: todayEnd }
          },
          {
            $setOnInsert: {
              user_id: new ObjectId(userId),
              activity_type: 'DAILY_STREAK',
              xp_earned: 5,
              timestamp: now
            }
          },
          { upsert: true, new: true, rawResult: true }
        );

        if (streakResult.lastErrorObject && !streakResult.lastErrorObject.updatedExisting) {
          streakAwarded = true;
          totalAwarded += 5;

          if (user.last_active_date && isYesterday(new Date(user.last_active_date), now)) {
            newStreak = (user.current_streak || 0) + 1;
          } else {
            newStreak = 1;
          }

          // Bonus for 3 days
          if (newStreak === 3) {
            logsToInsert.push({
              user_id: new ObjectId(userId),
              xp_earned: 10,
              activity_type: 'STREAK_BONUS',
              timestamp: now
            });
            totalAwarded += 10;
          }
        }
      } catch (e) {
        console.error('Streak atomic error', e);
      }
    }

    // Insert logs
    if (logsToInsert.length > 0) {
      await xpLogsCollection.insertMany(logsToInsert);
    }

    // Update user
    const updateData = {
      $inc: { total_xp: totalAwarded },
      $set: { last_active_date: now }
    };

    if (streakAwarded) {
      updateData.$set.current_streak = newStreak;
    }

    // Check for badges
    let badgesToAdd = [];
    const newTotalXp = (user.total_xp || 0) + totalAwarded;

    if (newTotalXp >= 50 && !user.badges?.includes('ActiveLearner')) {
      badgesToAdd.push('ActiveLearner');
    }

    if (newStreak >= 7 && !user.badges?.includes('WeekWarrior')) {
      badgesToAdd.push('WeekWarrior');
    }

    if (badgesToAdd.length > 0) {
      updateData.$addToSet = { badges: { $each: badgesToAdd } };
    }

    const updatedUser = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      updateData,
      { new: true }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        total_awarded: totalAwarded,
        total_xp: updatedUser.total_xp,
        current_streak: updatedUser.current_streak,
        badges: updatedUser.badges || []
      })
    };
  } finally {
    await client.close();
  }
}

async function userEnter(context, req, userId) {
  return await awardXp(context, { body: { activity_type: 'APP_ENTRY' } }, userId);
}

async function getLeaderboard(context, req) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");

  try {
    const topUsers = await usersCollection
      .find({ is_leaderboard_visible: true })
      .sort({ total_xp: -1 })
      .limit(50)
      .project({
        name: 1,
        username: 1,
        institution: 1,
        total_xp: 1,
        profilePicture: 1
      })
      .toArray();

    const leaderboard = topUsers.map((user, idx) => ({
      id: user._id.toString(),
      rank: idx + 1,
      name: user.name || user.username || 'Anonymous',
      institution: user.institution || '',
      total_xp: user.total_xp || 0,
      avatar: user.profilePicture
    }));

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, leaderboard })
    };
  } finally {
    await client.close();
  }
}

async function getXpHistory(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const xpLogsCollection = db.collection("xpLogs");

  try {
    const logs = await xpLogsCollection
      .find({ user_id: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        history: logs.map(log => ({
          id: log._id.toString(),
          xp_earned: log.xp_earned,
          activity_type: log.activity_type,
          timestamp: log.timestamp
        }))
      })
    };
  } finally {
    await client.close();
  }
}

async function getUserActivity(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const xpLogsCollection = db.collection("xpLogs");

  try {
    const logs = await xpLogsCollection
      .find({ user_id: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    const activityMap = {
      QUIZ_COMPLETE: 'Completed a Quiz',
      FLASHCARD_COMPLETE: 'Completed Flashcards',
      NOTE_SUMMARY: 'Generated Note Summary',
      DAILY_STREAK: 'Daily Streak',
      STREAK_BONUS: 'Streak Bonus',
      APP_ENTRY: 'App Opened'
    };

    const activities = logs.map(log => ({
      id: log._id.toString(),
      type: log.activity_type,
      title: activityMap[log.activity_type] || log.activity_type,
      xp: log.xp_earned || 0,
      timestamp: log.timestamp
    }));

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, activities })
    };
  } finally {
    await client.close();
  }
}

async function joinLeaderboard(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");

  try {
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { is_leaderboard_visible: true } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } finally {
    await client.close();
  }
}

async function leaveLeaderboard(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");

  try {
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { is_leaderboard_visible: false } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } finally {
    await client.close();
  }
}

async function getUserBadges(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");

  try {
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { badges: 1 } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        badges: user?.badges || []
      })
    };
  } finally {
    await client.close();
  }
}

async function getUserAwards(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");
  const weeklyWinnersCollection = db.collection("weeklyWinners");

  try {
    const [user, wins] = await Promise.all([
      usersCollection.findOne(
        { _id: new ObjectId(userId) },
        { projection: { badges: 1, sotw_win_count: 1 } }
      ),
      weeklyWinnersCollection
        .find({ user_id: new ObjectId(userId) })
        .sort({ start_date: -1 })
        .limit(10)
        .toArray()
    ]);

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        badges: user?.badges || [],
        sotw_win_count: user?.sotw_win_count || 0,
        wins: wins.map(win => ({
          id: win._id.toString(),
          start_date: win.start_date,
          end_date: win.end_date,
          weekly_score: win.weekly_score,
          winner_quote: win.winner_quote
        }))
      })
    };
  } finally {
    await client.close();
  }
}