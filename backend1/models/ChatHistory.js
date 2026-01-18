const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    citations: [{
        pageNumber: Number,
        snippet: String,
        chunkId: String
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    sessionId: {
        type: String,
        required: true
    },
    messages: [messageSchema],
    metadata: {
        totalTokens: { type: Number, default: 0 },
        avgResponseTime: { type: Number, default: 0 },
        pagesDiscussed: [{ type: Number }]
    }
}, { timestamps: true });

// Index for quick retrieval of chat history by document
chatHistorySchema.index({ userId: 1, documentId: 1 });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
