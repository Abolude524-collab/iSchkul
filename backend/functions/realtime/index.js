/**
 * Web PubSub Integration for Real-Time Chat
 * Provides connection, messaging, and presence features
 */

const { WebPubSubServiceClient } = require("@azure/web-pubsub");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// Initialize Web PubSub client
const serviceClient = new WebPubSubServiceClient(
  process.env.WEB_PUBSUB_CONNECTION_STRING,
  process.env.WEB_PUBSUB_HUB_NAME || "chat"
);

module.exports = async function (context, req) {
  context.log("Web PubSub endpoint triggered");

  const action = req.params.action;

  if (req.method === "POST" && action === "negotiate") {
    return await negotiateConnection(context, req);
  } else if (req.method === "POST" && action === "send") {
    return await sendMessage(context, req);
  } else if (req.method === "POST" && action === "typing") {
    return await sendTypingIndicator(context, req);
  } else if (req.method === "POST" && action === "presence") {
    return await updatePresence(context, req);
  } else if (req.method === "GET" && action === "online") {
    return await getOnlineUsers(context, req);
  }

  context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};

/**
 * Negotiate WebSocket connection
 */
async function negotiateConnection(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Generate client access token for Web PubSub
    const clientToken = await serviceClient.getClientAccessToken({
      userId: userId,
      roles: ["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"],
      expirationTimeInMinutes: 60,
    });

    // Update user online status
    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isOnline: true, lastSeen: new Date() } }
    );
    await client.close();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        url: clientToken.url,
        token: clientToken.token,
        userId,
      }),
    };
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to negotiate connection" }),
    };
  }
}

/**
 * Send message via Web PubSub
 */
async function sendMessage(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { content, groupId, toUserId, attachments } = req.body;

    if (!content) {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "content required" }),
      };
      return;
    }

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);
    const messagesCollection = db.collection("messages");
    const usersCollection = db.collection("users");

    // Get sender info
    const sender = await usersCollection.findOne({ _id: new ObjectId(userId) });

    // Store message in database
    const message = {
      fromUserId: new ObjectId(userId),
      toUserId: toUserId ? new ObjectId(toUserId) : null,
      groupId: groupId ? new ObjectId(groupId) : null,
      content,
      attachments: attachments || [],
      type: "text",
      isReadBy: [],
      createdAt: new Date(),
      archived: false,
    };

    const result = await messagesCollection.insertOne(message);

    // Prepare message payload for real-time
    const messagePayload = {
      _id: result.insertedId.toString(),
      ...message,
      sender: {
        _id: sender._id.toString(),
        name: sender.name,
        username: sender.username,
        avatar: sender.avatar || sender.profilePicture,
      },
    };

    // Send via Web PubSub
    if (groupId) {
      // Send to group
      await serviceClient.sendToGroup(`group-${groupId}`, messagePayload);
    } else if (toUserId) {
      // Send to specific user
      await serviceClient.sendToUser(toUserId, messagePayload);
      await serviceClient.sendToUser(userId, messagePayload); // Echo to sender
    }

    // Create notification
    if (toUserId || groupId) {
      const notificationsCollection = db.collection("notifications");
      await notificationsCollection.insertOne({
        userId: toUserId ? new ObjectId(toUserId) : null,
        groupId: groupId ? new ObjectId(groupId) : null,
        type: "new_message",
        title: groupId ? `New message in group` : `New message from ${sender.name}`,
        body: content.substring(0, 100),
        data: {
          messageId: result.insertedId,
          fromUserId: userId,
          groupId,
          toUserId,
        },
        read: false,
        createdAt: new Date(),
      });
    }

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        messageId: result.insertedId,
        message: messagePayload,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to send message" }),
    };
  }
}

/**
 * Send typing indicator
 */
async function sendTypingIndicator(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { groupId, toUserId, isTyping } = req.body;

    const payload = {
      type: "typing",
      userId,
      isTyping,
      timestamp: new Date(),
    };

    if (groupId) {
      await serviceClient.sendToGroup(`group-${groupId}`, payload);
    } else if (toUserId) {
      await serviceClient.sendToUser(toUserId, payload);
    }

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to send typing indicator" }),
    };
  }
}

/**
 * Update user presence
 */
async function updatePresence(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { isOnline } = req.body;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isOnline, lastSeen: new Date() } }
    );

    // Broadcast presence to all groups user is in
    const groups = await db.collection("groups").find({ memberIds: new ObjectId(userId) }).toArray();

    for (const group of groups) {
      await serviceClient.sendToGroup(`group-${group._id}`, {
        type: "presence",
        userId,
        isOnline,
        timestamp: new Date(),
      });
    }

    context.res = {
      status: 200,
      body: JSON.stringify({ success: true }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to update presence" }),
    };
  }
}

/**
 * Get online users
 */
async function getOnlineUsers(context, req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const groupId = req.query.groupId;

    const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_NAME);

    let query = { isOnline: true };

    if (groupId) {
      const group = await db.collection("groups").findOne({ _id: new ObjectId(groupId) });
      if (group) {
        query._id = { $in: group.memberIds };
      }
    }

    const onlineUsers = await db
      .collection("users")
      .find(query, {
        projection: {
          _id: 1,
          name: 1,
          username: 1,
          avatar: 1,
          profilePicture: 1,
          isOnline: 1,
          lastSeen: 1,
        },
      })
      .toArray();

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        count: onlineUsers.length,
        users: onlineUsers,
      }),
    };

    await client.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = {
      status: 500,
      body: JSON.stringify({ error: "Failed to get online users" }),
    };
  }
}
