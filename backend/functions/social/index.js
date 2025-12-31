/**
 * Social Features: Follow System, Notifications, Activity Feed
 */

const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Social features endpoint triggered");

  const action = req.params.action;

  if (req.method === "POST" && action === "follow") {
    return await followUser(context, req);
  } else if (req.method === "POST" && action === "unfollow") {
    return await unfollowUser(context, req);
  } else if (req.method === "GET" && action === "followers") {
    return await getFollowers(context, req);
  } else if (req.method === "GET" && action === "following") {
    return await getFollowing(context, req);
  } else if (req.method === "GET" && action === "feed") {
    return await getActivityFeed(context, req);
  } else if (req.method === "GET" && action === "notifications") {
    return await getNotifications(context, req);
  } else if (req.method === "PUT" && action === "notifications/read") {
    return await markNotificationsRead(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Follow a user
 */
async function followUser(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { targetUserId } = req.body;

    if (!targetUserId || userId === targetUserId) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Invalid target user" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    // Add to current user's following
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $addToSet: { following: new ObjectId(targetUserId) } }
    );

    // Add to target user's followers
    await usersCollection.updateOne(
      { _id: new ObjectId(targetUserId) },
      { $addToSet: { followers: new ObjectId(userId) } }
    );

    // Create notification
    const sender = await usersCollection.findOne({ _id: new ObjectId(userId) });
    const notificationsCollection = db.collection("notifications");
    await notificationsCollection.insertOne({
      userId: new ObjectId(targetUserId),
      type: "new_follower",
      title: "New Follower",
      body: `${sender.name} started following you`,
      data: { followerId: userId },
      read: false,
      createdAt: new Date(),
    });

    // Log activity
    const activitiesCollection = db.collection("activities");
    await activitiesCollection.insertOne({
      userId: new ObjectId(userId),
      type: "user.followed",
      meta: { targetUserId },
      visibility: "public",
      createdAt: new Date(),
    });

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        message: "Successfully followed user",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to follow user" }),
    };
  }
}

/**
 * Unfollow a user
 */
async function unfollowUser(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { targetUserId } = req.body;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const usersCollection = db.collection("users");

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { following: new ObjectId(targetUserId) } }
    );

    await usersCollection.updateOne(
      { _id: new ObjectId(targetUserId) },
      { $pull: { followers: new ObjectId(userId) } }
    );

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        message: "Successfully unfollowed user",
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to unfollow user" }),
    };
  }
}

/**
 * Get user's followers
 */
async function getFollowers(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const targetUserId = req.query.userId || decoded.userId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    const user = await db.collection("users").findOne({ _id: new ObjectId(targetUserId) });

    if (!user || !user.followers) {
      context.res = {
        status: 200,
        body: JSON.stringify({ success: true, count: 0, followers: [] }),
      };
      await client.close();
      return;
    }

    const followers = await db
      .collection("users")
      .find(
        { _id: { $in: user.followers } },
        {
          projection: {
            _id: 1,
            name: 1,
            username: 1,
            avatar: 1,
            profilePicture: 1,
            institution: 1,
            total_xp: 1,
          },
        }
      )
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: followers.length,
        followers,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get followers" }),
    };
  }
}

/**
 * Get users being followed
 */
async function getFollowing(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const targetUserId = req.query.userId || decoded.userId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    const user = await db.collection("users").findOne({ _id: new ObjectId(targetUserId) });

    if (!user || !user.following) {
      context.res = {
        status: 200,
        body: JSON.stringify({ success: true, count: 0, following: [] }),
      };
      await client.close();
      return;
    }

    const following = await db
      .collection("users")
      .find(
        { _id: { $in: user.following } },
        {
          projection: {
            _id: 1,
            name: 1,
            username: 1,
            avatar: 1,
            profilePicture: 1,
            institution: 1,
            total_xp: 1,
          },
        }
      )
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: following.length,
        following,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get following" }),
    };
  }
}

/**
 * Get activity feed (following + groups)
 */
async function getActivityFeed(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const limit = parseInt(req.query.limit) || 50;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    // Get user's following and groups
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    const userGroups = await db
      .collection("groups")
      .find({ memberIds: new ObjectId(userId) })
      .toArray();

    const followingIds = user.following || [];
    const groupIds = userGroups.map((g) => g._id);

    // Get activities from following and groups
    const activities = await db
      .collection("activities")
      .aggregate([
        {
          $match: {
            $or: [
              { userId: { $in: followingIds } },
              { "meta.groupId": { $in: groupIds } },
              { userId: new ObjectId(userId) }, // Own activities
            ],
            visibility: { $in: ["public", "group"] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            type: 1,
            meta: 1,
            visibility: 1,
            createdAt: 1,
            "user._id": 1,
            "user.name": 1,
            "user.username": 1,
            "user.avatar": 1,
            "user.profilePicture": 1,
          },
        },
      ])
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: activities.length,
        activities,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get activity feed" }),
    };
  }
}

/**
 * Get user notifications
 */
async function getNotifications(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unreadOnly === "true";

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    const query = { userId: new ObjectId(userId) };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await db
      .collection("notifications")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const unreadCount = await db
      .collection("notifications")
      .countDocuments({ userId: new ObjectId(userId), read: false });

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: notifications.length,
        unreadCount,
        notifications,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get notifications" }),
    };
  }
}

/**
 * Mark notifications as read
 */
async function markNotificationsRead(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { notificationIds } = req.body; // Array of notification IDs, or null for all

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    const query = { userId: new ObjectId(userId) };
    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds.map((id) => new ObjectId(id)) };
    }

    const result = await db
      .collection("notifications")
      .updateMany(query, { $set: { read: true, readAt: new Date() } });

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        modifiedCount: result.modifiedCount,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to mark notifications as read" }),
    };
  }
}
