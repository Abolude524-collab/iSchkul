/**
 * Chat Service
 * Business logic for messaging
 */

const { getDatabase } = require("../repos/mongoConnection");
const domainEvents = require("../events/domainEvents");

class ChatService {
  async sendMessage(userId, content, groupId = null, toUserId = null) {
    if (!content || content.length === 0) {
      throw new Error("Message content required");
    }

    const db = await getDatabase();
    const messagesCollection = db.collection("messages");

    const message = {
      userId,
      content,
      groupId,
      toUserId,
      createdAt: new Date(),
      archived: false,
    };

    const result = await messagesCollection.insertOne(message);

    // Emit event
    domainEvents.emitEvent(domainEvents.EVENTS.MESSAGE_CREATED, {
      messageId: result.insertedId,
      userId,
      groupId,
      content: content.substring(0, 100), // Truncate for event
      timestamp: new Date(),
    });

    return { ...message, _id: result.insertedId };
  }

  async getMessages(groupId, limit = 50) {
    const db = await getDatabase();
    const messagesCollection = db.collection("messages");

    return messagesCollection
      .find({ groupId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = new ChatService();
