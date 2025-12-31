# Cosmos DB Schema Design (MongoDB vCore API)

## Overview

All collections use MongoDB flexible schema with Cosmos DB's global distribution and strong consistency for audit/transactional data.

---

## Collections

### 1. `users`

**Purpose**: Core user identity and profile

```json
{
  "_id": ObjectId,
  "email": "student@ischkul.edu",
  "username": "adekunle",
  "displayName": "Adekunle Okonkwo",
  "password": "bcrypt_hash",
  "avatarUrl": "https://blob.azure.com/users/avatar-123.jpg",
  "profileMeta": {
    "bio": "Computer Science student",
    "university": "University of Lagos",
    "major": "CS",
    "year": 200
  },
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "updatedAt": ISODate("2025-12-29T10:00:00Z"),
  "status": "active" // active|suspended|deleted
}
```

**Indexes**:
```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
```

---

### 2. `groups`

**Purpose**: Study groups with admin and membership

```json
{
  "_id": ObjectId,
  "name": "CS201 Database Group",
  "description": "Collaborative study for Database Systems",
  "adminUserId": ObjectId("user-admin-id"),
  "memberIds": [
    ObjectId("user-id-1"),
    ObjectId("user-id-2"),
    ObjectId("user-id-3")
  ],
  "settings": {
    "studyModeEnabled": true,
    "privacy": "private", // public|private
    "allowExternalResources": true
  },
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "updatedAt": ISODate("2025-12-29T10:00:00Z"),
  "status": "active"
}
```

**Indexes**:
```javascript
db.groups.createIndex({ adminUserId: 1 });
db.groups.createIndex({ memberIds: 1 });
```

---

### 3. `messages`

**Purpose**: Chat messages (personal DM or group)

```json
{
  "_id": ObjectId,
  "fromUserId": ObjectId("user-sender-id"),
  "toUserId": ObjectId("user-receiver-id"), // null for group messages
  "groupId": ObjectId("group-id"), // null for personal messages
  "threadId": ObjectId("message-id"), // for threaded replies
  "content": "Hey, did you understand the database normalization lecture?",
  "attachments": [
    {
      "type": "file|image|pdf",
      "url": "https://blob.azure.com/uploads/file-123.pdf",
      "name": "notes.pdf"
    }
  ],
  "type": "text|file|system", // system for automated messages
  "isReadBy": [ObjectId("user-id-2")],
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "archived": false
}
```

**Indexes**:
```javascript
db.messages.createIndex({ groupId: 1, createdAt: -1 });
db.messages.createIndex({ fromUserId: 1, createdAt: -1 });
db.messages.createIndex({ toUserId: 1, createdAt: -1 });
```

---

### 4. `quizzes`

**Purpose**: Quiz definitions (auto-generated or manual)

```json
{
  "_id": ObjectId,
  "title": "Database Normalization Quiz",
  "description": "Test your understanding of 3NF",
  "groupId": ObjectId("group-id"), // null for personal quizzes
  "createdBy": ObjectId("user-id"),
  "questions": [
    {
      "id": "q1",
      "stem": "What is BCNF?",
      "options": [
        { "label": "a", "text": "Boyce-Codd Normal Form" },
        { "label": "b", "text": "Business Continuity Normal Form" },
        { "label": "c", "text": "Backup Code Normal Form" },
        { "label": "d", "text": "None of the above" }
      ],
      "answer": "a",
      "explanation": "BCNF is a stricter form of 3NF...",
      "difficulty": "medium",
      "tags": ["normalization", "database-design"]
    }
  ],
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "minPassingScore": 70,
  "timeLimit": 1800, // seconds
  "metadata": {
    "source": "azure-openai-json-mode",
    "model": "gpt-4o",
    "systemPrompt": "You are a Nigerian University Professor..."
  }
}
```

**Indexes**:
```javascript
db.quizzes.createIndex({ groupId: 1, createdAt: -1 });
db.quizzes.createIndex({ createdBy: 1 });
```

---

### 5. `quizResults`

**Purpose**: Track quiz attempts and scores (used for leaderboards)

```json
{
  "_id": ObjectId,
  "quizId": ObjectId("quiz-id"),
  "groupId": ObjectId("group-id"), // null for personal quizzes
  "userId": ObjectId("user-id"),
  "score": 85, // percentage
  "answers": [
    { "questionId": "q1", "selectedAnswer": "a", "isCorrect": true, "timeSpent": 45 }
  ],
  "duration": 1200, // seconds
  "takenAt": ISODate("2025-12-29T10:15:00Z"),
  "submittedAt": ISODate("2025-12-29T10:25:00Z"),
  "status": "submitted" // started|submitted|graded
}
```

**Indexes**:
```javascript
db.quizResults.createIndex({ quizId: 1, userId: 1 }, { unique: true });
db.quizResults.createIndex({ groupId: 1, takenAt: -1 });
db.quizResults.createIndex({ userId: 1, takenAt: -1 });
```

---

### 6. `flashcards`

**Purpose**: Study cards (individual or shared to group)

```json
{
  "_id": ObjectId,
  "createdBy": ObjectId("user-id"),
  "groupId": ObjectId("group-id"), // null for personal flashcards
  "front": "What is normalization?",
  "back": "Normalization is a process to organize data...",
  "tags": ["database", "cs201"],
  "difficulty": "easy", // easy|medium|hard
  "reviewCount": 5,
  "successRate": 0.8, // 80%
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "updatedAt": ISODate("2025-12-29T10:00:00Z"),
  "archived": false
}
```

**Indexes**:
```javascript
db.flashcards.createIndex({ createdBy: 1 });
db.flashcards.createIndex({ groupId: 1 });
db.flashcards.createIndex({ tags: 1 });
```

---

### 7. `activities`

**Purpose**: Event log for feeds, notifications, audit trail

```json
{
  "_id": ObjectId,
  "userId": ObjectId("user-id"),
  "type": "quiz.submitted|message.sent|group.joined|flashcard.shared",
  "meta": {
    "quizId": ObjectId("quiz-id"),
    "score": 85,
    "groupId": ObjectId("group-id")
  },
  "visibility": "public|private|group", // who can see this activity
  "createdAt": ISODate("2025-12-29T10:00:00Z")
}
```

**Indexes**:
```javascript
db.activities.createIndex({ userId: 1, createdAt: -1 });
db.activities.createIndex({ type: 1, createdAt: -1 });
db.activities.createIndex({ createdAt: -1 }); // for global feed
```

---

### 8. `document_chunks` (for Co-Reader)

**Purpose**: Indexed PDF chunks with embedding metadata

```json
{
  "_id": "doc-id-chunk-0",
  "documentId": ObjectId("document-id"),
  "chunkIndex": 0,
  "text": "Database normalization is...",
  "sourceFile": "lecture-notes.pdf",
  "createdAt": ISODate("2025-12-29T10:00:00Z"),
  "status": "indexed",
  "aiSearchIndexed": true
}
```

---

## Sample Aggregation Queries

### Leaderboard for a Group Quiz

```javascript
// Fetch top 10 scorers for a specific group quiz
db.quizResults.aggregate([
  {
    $match: {
      quizId: ObjectId("quiz-id"),
      groupId: ObjectId("group-id"),
      status: "submitted"
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  },
  {
    $unwind: "$user"
  },
  {
    $sort: { score: -1, submittedAt: 1 }
  },
  {
    $limit: 10
  },
  {
    $project: {
      rank: { $add: [{ $indexOfArray: ["$$ROOT"] }, 1] },
      userId: 1,
      displayName: "$user.displayName",
      avatarUrl: "$user.avatarUrl",
      score: 1,
      duration: 1,
      submittedAt: 1
    }
  }
]);
```

### User's Group Statistics

```javascript
// Get aggregated stats for a user across all groups
db.quizResults.aggregate([
  {
    $match: { userId: ObjectId("user-id") }
  },
  {
    $group: {
      _id: "$groupId",
      avgScore: { $avg: "$score" },
      totalAttempts: { $sum: 1 },
      highestScore: { $max: "$score" },
      lastAttempt: { $max: "$submittedAt" }
    }
  },
  {
    $lookup: {
      from: "groups",
      localField: "_id",
      foreignField: "_id",
      as: "group"
    }
  },
  {
    $unwind: "$group"
  },
  {
    $sort: { lastAttempt: -1 }
  }
]);
```

### Recent Group Activity Feed

```javascript
// Fetch latest activities in a group
db.activities.aggregate([
  {
    $match: {
      "meta.groupId": ObjectId("group-id"),
      visibility: { $in: ["public", "group"] }
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "actor"
    }
  },
  {
    $unwind: "$actor"
  },
  {
    $sort: { createdAt: -1 }
  },
  {
    $limit: 20
  },
  {
    $project: {
      type: 1,
      actor: { displayName: "$actor.displayName", avatarUrl: "$actor.avatarUrl" },
      meta: 1,
      createdAt: 1
    }
  }
]);
```

---

## Data Retention & TTL

```javascript
// Auto-delete message archives after 90 days
db.messages.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);
```

---

## Security Considerations

- All sensitive fields (passwords) stored with bcryptjs hashing
- JWT tokens never stored in DB; only user IDs
- Blob Storage URLs generated with SAS tokens (time-limited)
- Audit logging in `activities` collection
- RBAC enforced at function level (admin vs member vs anonymous)
