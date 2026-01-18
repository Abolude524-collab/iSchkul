const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: String, // Can be linked to a Course model if needed
        default: null
    },
    fileUrl: {
        type: String,
        required: true
    },
    pages: {
        type: Number,
        default: 0
    },
    chunkCount: {
        type: Number,
        default: 0
    },
    indexStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    metadata: {
        fileSize: Number,
        contentType: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    vectorIndexId: {
        type: String // Namespace or Index ID
    },
    accessControl: {
        visibility: {
            type: String,
            enum: ['private', 'group', 'public'],
            default: 'private'
        },
        allowedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
