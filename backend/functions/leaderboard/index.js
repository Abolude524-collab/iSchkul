const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Leaderboard endpoint triggered");

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const action = req.params.action;

    if (req.method === "POST" && action === "create") {
      return await createLeaderboard(context, req, userId);
    } else if (req.method === "GET" && action === "list") {
      return await listLeaderboards(context, req);
    } else if (req.method === "GET" && action === "active") {
      return await getActiveLeaderboard(context, req);
    } else if (req.method === "POST" && action === "join") {
      return await joinLeaderboard(context, req, userId);
    } else if (req.method === "POST" && action === "leave") {
      return await leaveLeaderboard(context, req, userId);
    } else if (req.method === "POST" && action === "end") {
      return await endLeaderboard(context, req, userId);
    } else if (req.method === "GET" && action === "participants") {
      return await getLeaderboardParticipants(context, req);
    }

    context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

async function createLeaderboard(context, req, userId) {
  const { title, description, durationDays, prizes } = req.body;

  if (!title || !durationDays) {
    context.res = { status: 400, body: JSON.stringify({ error: "title and durationDays required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");
  const leaderboardsCollection = db.collection("globalLeaderboards");

  try {
    // Check if user is admin
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || (!user.is_admin && !user.isSuperAdmin)) {
      context.res = { status: 403, body: JSON.stringify({ error: "Admin access required" }) };
      return;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);

    const leaderboard = {
      title,
      description: description || '',
      durationDays,
      startDate,
      endDate,
      prizes: prizes || [],
      createdBy: new ObjectId(userId),
      isActive: true,
      participants: [],
      createdAt: new Date()
    };

    const result = await leaderboardsCollection.insertOne(leaderboard);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        leaderboardId: result.insertedId.toString(),
        leaderboard: {
          _id: result.insertedId.toString(),
          ...leaderboard,
          createdBy: userId
        }
      })
    };
  } finally {
    await client.close();
  }
}

async function listLeaderboards(context, req) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const leaderboardsCollection = db.collection("globalLeaderboards");
  const usersCollection = db.collection("users");

  try {
    const leaderboards = await leaderboardsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const leaderboardsWithCreators = await Promise.all(
      leaderboards.map(async (lb) => {
        const creator = await usersCollection.findOne(
          { _id: lb.createdBy },
          { projection: { name: 1, username: 1 } }
        );

        return {
          _id: lb._id.toString(),
          title: lb.title,
          description: lb.description,
          durationDays: lb.durationDays,
          startDate: lb.startDate,
          endDate: lb.endDate,
          prizes: lb.prizes,
          isActive: lb.isActive,
          participantCount: lb.participants?.length || 0,
          createdBy: {
            _id: lb.createdBy.toString(),
            name: creator?.name || creator?.username || 'Unknown'
          },
          createdAt: lb.createdAt
        };
      })
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, leaderboards: leaderboardsWithCreators })
    };
  } finally {
    await client.close();
  }
}

async function getActiveLeaderboard(context, req) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const leaderboardsCollection = db.collection("globalLeaderboards");
  const usersCollection = db.collection("users");
  const xpLogsCollection = db.collection("xpLogs");

  try {
    const activeLeaderboard = await leaderboardsCollection.findOne({ isActive: true });
    if (!activeLeaderboard) {
      context.res = {
        status: 200,
        body: JSON.stringify({ success: true, leaderboard: null })
      };
      return;
    }

    // Get leaderboard rankings
    const participantIds = activeLeaderboard.participants.map(p => new ObjectId(p));
    const participants = await usersCollection
      .find({ _id: { $in: participantIds } })
      .project({ name: 1, username: 1, total_xp: 1, profilePicture: 1 })
      .toArray();

    // Calculate XP earned during leaderboard period
    const leaderboardXp = await Promise.all(
      participants.map(async (participant) => {
        const xpEarned = await xpLogsCollection.aggregate([
          {
            $match: {
              user_id: participant._id,
              timestamp: {
                $gte: activeLeaderboard.startDate,
                $lte: activeLeaderboard.endDate
              }
            }
          },
          { $group: { _id: null, total: { $sum: '$xp_earned' } } }
        ]).toArray();

        return {
          userId: participant._id.toString(),
          name: participant.name || participant.username || 'Anonymous',
          total_xp: xpEarned[0]?.total || 0,
          avatar: participant.profilePicture
        };
      })
    );

    // Sort by XP earned during leaderboard
    leaderboardXp.sort((a, b) => b.total_xp - a.total_xp);

    const leaderboardWithRankings = {
      _id: activeLeaderboard._id.toString(),
      title: activeLeaderboard.title,
      description: activeLeaderboard.description,
      startDate: activeLeaderboard.startDate,
      endDate: activeLeaderboard.endDate,
      prizes: activeLeaderboard.prizes,
      rankings: leaderboardXp.map((p, idx) => ({ ...p, rank: idx + 1 }))
    };

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true, leaderboard: leaderboardWithRankings })
    };
  } finally {
    await client.close();
  }
}

async function joinLeaderboard(context, req, userId) {
  const { leaderboardId } = req.body;

  if (!leaderboardId) {
    context.res = { status: 400, body: JSON.stringify({ error: "leaderboardId required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const leaderboardsCollection = db.collection("globalLeaderboards");

  try {
    const result = await leaderboardsCollection.updateOne(
      { _id: new ObjectId(leaderboardId), isActive: true },
      { $addToSet: { participants: userId } }
    );

    if (result.matchedCount === 0) {
      context.res = { status: 404, body: JSON.stringify({ error: "Active leaderboard not found" }) };
      return;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } finally {
    await client.close();
  }
}

async function leaveLeaderboard(context, req, userId) {
  const { leaderboardId } = req.body;

  if (!leaderboardId) {
    context.res = { status: 400, body: JSON.stringify({ error: "leaderboardId required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const leaderboardsCollection = db.collection("globalLeaderboards");

  try {
    await leaderboardsCollection.updateOne(
      { _id: new ObjectId(leaderboardId) },
      { $pull: { participants: userId } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } finally {
    await client.close();
  }
}

async function endLeaderboard(context, req, userId) {
  const { leaderboardId } = req.body;

  if (!leaderboardId) {
    context.res = { status: 400, body: JSON.stringify({ error: "leaderboardId required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const usersCollection = db.collection("users");
  const leaderboardsCollection = db.collection("globalLeaderboards");

  try {
    // Check if user is admin
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || (!user.is_admin && !user.isSuperAdmin)) {
      context.res = { status: 403, body: JSON.stringify({ error: "Admin access required" }) };
      return;
    }

    await leaderboardsCollection.updateOne(
      { _id: new ObjectId(leaderboardId) },
      { $set: { isActive: false } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true })
    };
  } finally {
    await client.close();
  }
}

async function getLeaderboardParticipants(context, req) {
  const leaderboardId = req.query.leaderboardId;

  if (!leaderboardId) {
    context.res = { status: 400, body: JSON.stringify({ error: "leaderboardId query parameter required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const leaderboardsCollection = db.collection("globalLeaderboards");
  const usersCollection = db.collection("users");

  try {
    const leaderboard = await leaderboardsCollection.findOne({ _id: new ObjectId(leaderboardId) });
    if (!leaderboard) {
      context.res = { status: 404, body: JSON.stringify({ error: "Leaderboard not found" }) };
      return;
    }

    const participantIds = leaderboard.participants.map(p => new ObjectId(p));
    const participants = await usersCollection
      .find({ _id: { $in: participantIds } })
      .project({ name: 1, username: 1, profilePicture: 1 })
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        participants: participants.map(p => ({
          _id: p._id.toString(),
          name: p.name || p.username || 'Anonymous',
          avatar: p.profilePicture
        }))
      })
    };
  } finally {
    await client.close();
  }
}