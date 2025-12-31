# API Testing Guide & Sample Requests

This guide provides **copy-paste Curl** and **Postman** examples for testing all ischkul-azure endpoints.

---

## Prerequisites

- Backend running: `npm run dev:functions` (port 7071)
- Environment variables configured in `backend/local.settings.json`
- Azure OpenAI quota and services active

---

## 1. Authentication

### 1.1 Login

```bash
curl -X POST http://localhost:7071/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "hashedpassword"
  }'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "student@example.com",
    "displayName": "Adekunle",
    "avatarUrl": "https://blob.azure.com/avatars/..."
  }
}
```

**Postman**:
1. Method: `POST`
2. URL: `http://localhost:7071/api/auth/login`
3. Body (JSON): See curl example
4. Send

---

## 2. Chat

### 2.1 Send Message

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:7071/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "content": "Hey, did you understand the database lecture?",
    "groupId": "507f1f77bcf86cd799439012",
    "isGroupChat": true
  }'
```

**Response**:
```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439099",
  "message": {
    "userId": "507f1f77bcf86cd799439011",
    "content": "Hey, did you understand the database lecture?",
    "groupId": "507f1f77bcf86cd799439012",
    "isGroupChat": true,
    "createdAt": "2025-12-29T10:30:00Z",
    "archived": false
  }
}
```

### 2.2 Get Messages

```bash
curl -X GET "http://localhost:7071/api/chat/messages?groupId=507f1f77bcf86cd799439012&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Quiz Generation

### 3.1 Generate Quiz

```bash
curl -X POST http://localhost:7071/api/generate/quiz \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Database normalization is the process of organizing data in a database. It involves dividing data into tables and establishing relationships. The three normal forms are 1NF, 2NF, and 3NF...",
    "numQuestions": 5,
    "createdBy": "507f1f77bcf86cd799439011",
    "groupId": "507f1f77bcf86cd799439012"
  }'
```

**Response**:
```json
{
  "success": true,
  "quizId": "507f1f77bcf86cd799439100",
  "quiz": {
    "title": "Auto-generated Quiz (5 questions)",
    "questions": [
      {
        "id": "q1",
        "stem": "What is database normalization?",
        "options": [
          {"label": "a", "text": "Organizing data in tables"},
          {"label": "b", "text": "Deleting redundant rows"},
          {"label": "c", "text": "Creating backups"},
          {"label": "d", "text": "Compressing database files"}
        ],
        "answer": "a",
        "explanation": "As stated in the provided text, normalization involves organizing data into tables and establishing relationships.",
        "difficulty": "easy",
        "tags": ["database", "normalization"]
      }
    ],
    "groupId": "507f1f77bcf86cd799439012",
    "createdBy": "507f1f77bcf86cd799439011",
    "createdAt": "2025-12-29T10:30:00Z",
    "minPassingScore": 70,
    "metadata": {
      "source": "azure-openai-json-mode",
      "model": "gpt-4o"
    }
  }
}
```

### 3.2 Get Quiz

```bash
curl -X GET http://localhost:7071/api/quiz/507f1f77bcf86cd799439100 \
  -H "Authorization: Bearer $TOKEN"
```

### 3.3 Submit Quiz

```bash
curl -X POST http://localhost:7071/api/quiz/507f1f77bcf86cd799439100/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "answers": [
      {
        "questionId": "q1",
        "selectedAnswer": "a"
      }
    ]
  }'
```

**Response**:
```json
{
  "success": true,
  "result": {
    "_id": "507f1f77bcf86cd799439200",
    "quizId": "507f1f77bcf86cd799439100",
    "userId": "507f1f77bcf86cd799439011",
    "score": 100,
    "answers": [...],
    "duration": 120,
    "takenAt": "2025-12-29T10:35:00Z",
    "submittedAt": "2025-12-29T10:37:00Z",
    "status": "submitted"
  }
}
```

---

## 4. File Upload (Co-Reader)

### 4.1 Upload PDF

```bash
curl -X POST http://localhost:7071/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@lecture-notes.pdf" \
  -F "userId=507f1f77bcf86cd799439011"
```

**Response**:
```json
{
  "success": true,
  "documentId": "507f1f77bcf86cd799439300",
  "message": "File uploaded. Chunking and embedding in progress."
}
```

**Behind the scenes**:
1. PDF saved to Azure Blob Storage
2. Chunking job queued (uses `scripts/chunk-and-embed.js`)
3. Embeddings generated (Azure OpenAI)
4. Indexed to Azure AI Search
5. Metadata stored in Cosmos DB

---

## 5. Co-Reader Query (RAG)

### 5.1 Query Document

```bash
curl -X POST http://localhost:7071/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "content": "Explain the concept of normalization",
    "isCoReaderQuery": true,
    "documentId": "507f1f77bcf86cd799439300"
  }'
```

**Backend Process**:
1. Search Azure AI Search for top-3 similar chunks
2. Assemble prompt: `[system] + [chunks] + [query]`
3. Call Azure OpenAI GPT-4o
4. Return response with sources cited

**Response**:
```json
{
  "success": true,
  "response": "Based on the document provided... (explanation with citations)",
  "sources": [
    {
      "chunkId": "doc-id-chunk-0",
      "similarity": 0.94,
      "excerpt": "Database normalization is..."
    }
  ]
}
```

---

## 6. Groups

### 6.1 Create Group

```bash
curl -X POST http://localhost:7071/api/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "CS201 Study Group",
    "description": "Collaborative study for Database Systems",
    "adminUserId": "507f1f77bcf86cd799439011"
  }'
```

**Response**:
```json
{
  "success": true,
  "groupId": "507f1f77bcf86cd799439400",
  "group": {
    "_id": "507f1f77bcf86cd799439400",
    "name": "CS201 Study Group",
    "description": "Collaborative study for Database Systems",
    "adminUserId": "507f1f77bcf86cd799439011",
    "memberIds": ["507f1f77bcf86cd799439011"],
    "settings": {
      "studyModeEnabled": true,
      "privacy": "private"
    },
    "createdAt": "2025-12-29T10:30:00Z"
  }
}
```

### 6.2 Get Groups

```bash
curl -X GET http://localhost:7071/api/groups \
  -H "Authorization: Bearer $TOKEN"
```

### 6.3 Get Group Details

```bash
curl -X GET http://localhost:7071/api/groups/507f1f77bcf86cd799439400 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. Leaderboard

### 7.1 Get Leaderboard for Quiz

**MongoDB Aggregation** (run in Cosmos DB):

```javascript
db.quizResults.aggregate([
  {
    $match: {
      quizId: ObjectId("507f1f77bcf86cd799439100"),
      groupId: ObjectId("507f1f77bcf86cd799439400"),
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
]).pretty()
```

**Via API** (future):

```bash
curl -X GET "http://localhost:7071/api/quiz/507f1f77bcf86cd799439100/leaderboard?groupId=507f1f77bcf86cd799439400" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Postman Collection

### Import:

1. Open Postman
2. Click **Import** → **Raw text**
3. Paste this JSON:

```json
{
  "info": {
    "name": "ischkul-azure",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": {
              "raw": "http://localhost:7071/api/auth/login",
              "protocol": "http",
              "host": ["localhost"],
              "port": "7071",
              "path": ["api", "auth", "login"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"email\": \"student@example.com\", \"password\": \"password\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Quiz",
      "item": [
        {
          "name": "Generate Quiz",
          "request": {
            "method": "POST",
            "url": {
              "raw": "http://localhost:7071/api/generate/quiz",
              "protocol": "http",
              "host": ["localhost"],
              "port": "7071",
              "path": ["api", "generate", "quiz"]
            },
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\"text\": \"...\", \"numQuestions\": 5, \"createdBy\": \"...\", \"groupId\": \"...\"}"
            }
          }
        }
      ]
    }
  ]
}
```

4. Click **Import**

---

## Common Errors

| Status | Error | Fix |
|--------|-------|-----|
| 400 | Missing required fields | Check request body |
| 401 | Unauthorized | Ensure Authorization header with Bearer token |
| 500 | Server error | Check backend logs; ensure Azure services active |
| 429 | Too many requests | Rate limiting engaged; wait and retry |

---

## End-to-End Demo Flow

**Scenario**: Student generates quiz from lecture notes, takes it, sees leaderboard.

### Step 1: Login
```bash
TOKEN=$(curl -s -X POST http://localhost:7071/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"pass"}' | jq -r '.token')

echo "Token: $TOKEN"
```

### Step 2: Create Group
```bash
GROUP_ID=$(curl -s -X POST http://localhost:7071/api/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"DB Study","description":"Database","adminUserId":"USER_ID"}' | jq -r '.groupId')

echo "Group: $GROUP_ID"
```

### Step 3: Generate Quiz
```bash
QUIZ_ID=$(curl -s -X POST http://localhost:7071/api/generate/quiz \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"Database normalization...","numQuestions":5,"createdBy":"USER_ID","groupId":"'$GROUP_ID'"}' | jq -r '.quizId')

echo "Quiz: $QUIZ_ID"
```

### Step 4: Submit Quiz
```bash
curl -X POST http://localhost:7071/api/quiz/$QUIZ_ID/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"USER_ID","answers":[{"questionId":"q1","selectedAnswer":"a"}]}'
```

### Step 5: View Leaderboard (via Cosmos DB)
Run aggregation query (see section 7.1)

---

## Security Notes

- **Never hardcode tokens** in production
- Use environment variables for sensitive values
- Rotate JWT_SECRET regularly
- Validate all user inputs server-side
- Log all API calls for audit trail

---

For comprehensive API documentation, see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
