const { MongoClient, ObjectId } = require("mongodb");

module.exports = async function (context, req) {
  context.log("Student of the Week endpoint triggered");

  const action = req.params.action;

  if (req.method === "GET" && action === "current") {
    return await getCurrentSotw(context, req);
  } else if (req.method === "GET" && action === "archive") {
    return await getSotwArchive(context, req);
  } else if (req.method === "POST" && action === "quote") {
    return await submitWinnerQuote(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

function getLastFullWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffToMonday = (today.getDay() + 6) % 7; // 0 for Monday
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  const lastWeekEnd = new Date(thisWeekMonday);
  lastWeekEnd.setMilliseconds(-1);
  const lastWeekStart = new Date(thisWeekMonday);
  lastWeekStart.setDate(thisWeekMonday.getDate() - 7);
  return { start: lastWeekStart, end: lastWeekEnd };
}

function uniqueActiveDaysWithinRange(logs, start, end) {
  const days = new Set();
  (logs || []).forEach((log) => {
    const ts = new Date(log.timestamp || log);
    if (ts >= start && ts <= end) {
      const dayStart = new Date(ts);
      dayStart.setHours(0, 0, 0, 0);
      days.add(dayStart.toISOString());
    }
  });
  return days.size;
}

async function getCurrentSotw(context, req) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const xpLogsCollection = db.collection("xpLogs");
  const usersCollection = db.collection("users");
  const weeklyWinnersCollection = db.collection("weeklyWinners");

  try {
    const now = new Date();
    const { start, end } = getLastFullWeekRange(now);

    // Check if we already have a winner for this week
    const existingWinner = await weeklyWinnersCollection.findOne({
      start_date: start,
      end_date: end
    });

    if (existingWinner) {
      const winner = await usersCollection.findOne({ _id: existingWinner.user_id });
      if (winner) {
        context.res = {
          status: 200,
          body: JSON.stringify({
            success: true,
            winner: {
              user_id: winner._id.toString(),
              name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username || 'Student',
              user: {
                name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username,
                institution: winner.institution,
                profilePicture: winner.profilePicture,
                username: winner.username
              },
              institution: winner.institution || '',
              weekly_score: existingWinner.weekly_score,
              start_date: start,
              end_date: end,
              winner_quote: existingWinner.winner_quote || '',
            }
          })
        };
        return;
      }
    }

    // Calculate new winner
    const pipeline = [
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } },
      { $sort: { weekly_score: -1 } },
      { $limit: 1 },
    ];

    const agg = await xpLogsCollection.aggregate(pipeline).toArray();
    if (!agg || agg.length === 0) {
      context.res = {
        status: 200,
        body: JSON.stringify({ success: true, winner: null })
      };
      return;
    }

    const top = agg[0];
    const winner = await usersCollection.findOne({ _id: top._id });
    if (!winner) {
      context.res = {
        status: 200,
        body: JSON.stringify({ success: true, winner: null })
      };
      return;
    }

    // Get activity logs for streak calculation
    const weekLogs = await xpLogsCollection.find({
      user_id: winner._id,
      timestamp: { $gte: start, $lte: end }
    }, { timestamp: 1 }).toArray();

    const activeDays = uniqueActiveDaysWithinRange(weekLogs, start, end);
    const streakWeekWinner = activeDays >= 7;

    // Update user's SOTW win count and add badge if applicable
    const updatedUser = await usersCollection.findOneAndUpdate(
      { _id: winner._id },
      {
        $inc: { sotw_win_count: 1 },
        $addToSet: streakWeekWinner ? { badges: 'StreakWeekWinner' } : {}
      },
      { new: true }
    );

    // Create weekly winner record
    const winnerRecord = await weeklyWinnersCollection.findOneAndUpdate(
      { start_date: start, end_date: end },
      {
        user_id: winner._id,
        start_date: start,
        end_date: end,
        weekly_score: top.weekly_score,
        winner_quote: '',
        created_at: new Date()
      },
      { upsert: true, new: true }
    );

    const winnerData = {
      user_id: winner._id.toString(),
      name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username || 'Student',
      user: {
        name: winner.name || `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || winner.username,
        institution: winner.institution,
        profilePicture: winner.profilePicture,
        username: winner.username
      },
      institution: winner.institution || '',
      weekly_score: top.weekly_score,
      start_date: start,
      end_date: end,
      winner_quote: winnerRecord.winner_quote || '',
    };

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, winner: winnerData })
    };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  } finally {
    await client.close();
  }
}

async function getSotwArchive(context, req) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const weeklyWinnersCollection = db.collection("weeklyWinners");
  const usersCollection = db.collection("users");

  try {
    const winners = await weeklyWinnersCollection
      .find({})
      .sort({ start_date: -1 })
      .limit(10)
      .toArray();

    const archive = await Promise.all(
      winners.map(async (winner) => {
        const user = await usersCollection.findOne(
          { _id: winner.user_id },
          { projection: { name: 1, username: 1, institution: 1 } }
        );

        return {
          id: winner._id.toString(),
          name: user?.name || user?.username || 'Unknown',
          institution: user?.institution || '',
          start_date: winner.start_date,
          end_date: winner.end_date,
          weekly_score: winner.weekly_score,
          winner_quote: winner.winner_quote || '',
        };
      })
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, archive })
    };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  } finally {
    await client.close();
  }
}

async function submitWinnerQuote(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { quote } = req.body;
    if (!quote || !quote.trim()) {
      context.res = { status: 400, body: JSON.stringify({ error: "Quote is required" }) };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const weeklyWinnersCollection = db.collection("weeklyWinners");

    const now = new Date();
    const { start, end } = getLastFullWeekRange(now);

    const currentWinner = await weeklyWinnersCollection.findOne({
      start_date: start,
      end_date: end
    });

    if (!currentWinner) {
      context.res = { status: 404, body: JSON.stringify({ error: "No current winner" }) };
      return;
    }

    if (currentWinner.user_id.toString() !== userId) {
      context.res = { status: 403, body: JSON.stringify({ error: "Only the current winner can submit a quote" }) };
      return;
    }

    await weeklyWinnersCollection.updateOne(
      { _id: currentWinner._id },
      { $set: { winner_quote: quote.trim() } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
}