/**
 * Event Emitter for Domain Events
 * Enables future integration with Azure Web PubSub / SignalR
 */

const EventEmitter = require("events");

class DomainEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.eventLog = [];
  }

  // Emit and log event
  emitEvent(eventType, payload) {
    const event = {
      type: eventType,
      payload,
      timestamp: new Date(),
    };

    this.eventLog.push(event);
    this.emit(eventType, payload);

    // TODO: In production, publish to Azure Web PubSub here
    // await pubSubClient.sendGroupMessage(eventType, JSON.stringify(payload));
  }

  // Event types
  static EVENTS = {
    MESSAGE_CREATED: "message.created",
    QUIZ_SUBMITTED: "quiz.submitted",
    GROUP_CREATED: "group.created",
    FLASHCARD_SHARED: "flashcard.shared",
    AI_CONTENT_FLAGGED: "ai.flagged-output",
  };
}

module.exports = new DomainEventEmitter();
