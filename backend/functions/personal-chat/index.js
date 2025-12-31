const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  context.log("Personal Chat endpoint triggered");

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
      return await createChat(context, req, userId);
    } else if (req.method === "GET" && action === "list") {
      return await listChats(context, req, userId);
    } else if (req.method === "GET" && action === "messages") {
      return await getChatMessages(context, req, userId);
    } else if (req.method === "POST" && action === "send") {
      return await sendMessage(context, req, userId);
    }

    context.res = { status: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

/**
 * Create a new personal chat or return existing one
 */
async function createChat(context, req, userId) {
  const { contactId } = req.body;

  if (!contactId) {
    context.res = { status: 400, body: JSON.stringify({ error: "contactId required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const chatsCollection = db.collection("personalChats");

  try {
    // Check if chat already exists
    const existingChat = await chatsCollection.findOne({
      participants: { $all: [userId, contactId] }
    });

    if (existingChat) {
      context.res = {
        status: 200,
        body: JSON.stringify({
          success: true,
          chatId: existingChat._id.toString(),
          chat: {
            _id: existingChat._id.toString(),
            participants: existingChat.participants,
            createdAt: existingChat.createdAt,
            lastMessage: existingChat.lastMessage
          }
        })
      };
      return;
    }

    // Create new chat
    const newChat = {
      participants: [userId, contactId],
      messages: [],
      createdAt: new Date(),
      lastMessage: null
    };

    const result = await chatsCollection.insertOne(newChat);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        chatId: result.insertedId.toString(),
        chat: {
          _id: result.insertedId.toString(),
          participants: newChat.participants,
          createdAt: newChat.createdAt,
          lastMessage: null
        }
      })
    };
  } finally {
    await client.close();
  }
}

/**
 * List all personal chats for a user
 */
async function listChats(context, req, userId) {
  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const chatsCollection = db.collection("personalChats");
  const usersCollection = db.collection("users");

  try {
    const chats = await chatsCollection.find({
      participants: userId
    }).sort({ "lastMessage.timestamp": -1 }).toArray();

    // Get participant details
    const chatList = await Promise.all(chats.map(async (chat) => {
      const otherParticipantId = chat.participants.find(p => p !== userId);
      const otherParticipant = await usersCollection.findOne({ _id: new ObjectId(otherParticipantId) });

      return {
        _id: chat._id.toString(),
        participants: chat.participants,
        lastMessage: chat.lastMessage,
        otherParticipant: otherParticipant ? {
          _id: otherParticipant._id.toString(),
          name: otherParticipant.name,
          username: otherParticipant.username,
          avatar: otherParticipant.avatar || otherParticipant.profilePicture
        } : null,
        createdAt: chat.createdAt
      };
    }));

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        chats: chatList
      })
    };
  } finally {
    await client.close();
  }
}

/**
 * Get messages for a specific chat
 */
async function getChatMessages(context, req, userId) {
  const chatId = req.params.chatId;

  if (!chatId) {
    context.res = { status: 400, body: JSON.stringify({ error: "chatId required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const chatsCollection = db.collection("personalChats");

  try {
    const chat = await chatsCollection.findOne({
      _id: new ObjectId(chatId),
      participants: userId
    });

    if (!chat) {
      context.res = { status: 404, body: JSON.stringify({ error: "Chat not found" }) };
      return;
    }

    context.res = {
      status: 200,
      body: JSON.stringify({
        success: true,
        messages: chat.messages || []
      })
    };
  } finally {
    await client.close();
  }
}

/**
 * Send a message in a personal chat
 */
async function sendMessage(context, req, userId) {
  const chatId = req.params.chatId;
  const { content, messageType = "text" } = req.body;

  if (!chatId || !content) {
    context.res = { status: 400, body: JSON.stringify({ error: "chatId and content required" }) };
    return;
  }

  const client = new MongoClient(process.env.COSMOS_MONGO_CONN);
  await client.connect();
  const db = client.db(process.env.COSMOS_DB_NAME);
  const chatsCollection = db.collection("personalChats");
  const usersCollection = db.collection("users");

  try {
    // Verify chat exists and user is participant
    const chat = await chatsCollection.findOne({
      _id: new ObjectId(chatId),
      participants: userId
    });

    if (!chat) {
      context.res = { status: 404, body: JSON.stringify({ error: "Chat not found" }) };
      return;
    }

    // Get sender info
    const sender = await usersCollection.findOne({ _id: new ObjectId(userId) });

    // Create message
    const message = {
      _id: new ObjectId(),
      sender: userId,
      content,
      messageType,
      timestamp: new Date(),
      readBy: [userId] // Mark as read by sender
    };

    // Add message to chat
    await chatsCollection.updateOne(
      { _id: new ObjectId(chatId) },
      {
        $push: { messages: message },
        $set: { lastMessage: message }
      }
    );

    // Prepare message payload for real-time
    const messagePayload = {
      _id: message._id.toString(),
      chatId,
      ...message,
      sender: {
        _id: sender._id.toString(),
        name: sender.name,
        username: sender.username,
        avatar: sender.avatar || sender.profilePicture
      }
    };

    // Send via Web PubSub to both participants
    const { WebPubSubServiceClient } = require("@azure/web-pubsub");
    const serviceClient = new WebPubSubServiceClient(
      process.env.WEB_PUBSUB_CONNECTION_STRING,
      process.env.WEB_PUBSUB_HUB_NAME || "chat"
    );

    const recipientId = chat.participants.find(p => p !== userId);
    await serviceClient.sendToUser(recipientId, {
      type: "personal_message",
      data: messagePayload
    });
    await serviceClient.sendToUser(userId, {
      type: "personal_message",
      data: messagePayload
    });

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        messageId: message._id.toString(),
        message: messagePayload
      })
    };
  } finally {
    await client.close();
  }
}