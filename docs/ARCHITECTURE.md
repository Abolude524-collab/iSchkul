# Architecture: ischkul-azure (Imagine Cup 2026)

## System Overview

ischkul is a **cloud-native, serverless education platform** built on **Microsoft Azure**, designed for competition-grade reliability, scalability, and responsible AI.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Layer (Static Web App)            │
│  React + Vite │ Mobile-first UI │ TailwindCSS │ Client Routes │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST API
┌────────────────────────────▼────────────────────────────────────┐
│                  API Layer (Azure Functions)                    │
│  /auth/login │ /chat/send │ /generate/quiz │ /files/upload    │
└────────┬────────────────────────────────┬──────────────────────┘
         │                                │
    ┌────▼─────────┐            ┌────────▼───────────┐
    │ Cosmos DB    │            │ Blob Storage       │
    │ (MongoDB)    │            │ (PDFs, Avatars)   │
    │              │            │                    │
    │ Users        │            │ /uploads/          │
    │ Groups       │            │ /documents/        │
    │ Messages     │            │ /avatars/          │
    │ Quizzes      │            │                    │
    │ Results      │            └────────┬───────────┘
    │ Flashcards   │                     │
    │ Activities   │                     │
    │ Doc Chunks   │                     │
    └────┬─────────┘                     │
         │                               │
         └────────────┬──────────────────┘
                      │
         ┌────────────▼──────────────┐
         │  AI Search (Vector Index) │
         │ (Co-Reader RAG Retrieval) │
         └────────────┬──────────────┘
                      │
         ┌────────────▼────────────────┐
         │   Azure OpenAI (GPT-4o)    │
         │ • Chat responses           │
         │ • Quiz generation (JSON)   │
         │ • Flashcard creation       │
         │ • Text embeddings          │
         └────────────────────────────┘
```

---

## Core Features & Data Flows

### Feature 1: Co-Reader (RAG - Retrieval Augmented Generation)

**User Journey**: Upload PDF → Query → Intelligent Response

1. **Upload Phase**:
   ```
   User PDF → Azure Functions (/files/upload)
              ↓
           Blob Storage (persisted)
              ↓
           Background job: chunk-and-embed.js
              ├─ Extract text from PDF
              ├─ Split into chunks (1024 chars, 200 overlap)
              ├─ Clean & normalize
              └─ Generate embeddings (Azure OpenAI text-embedding-3-small)
                 ↓
              Azure AI Search (vector index)
              ↓
           Cosmos DB (document_chunks collection)
   ```

2. **Query Phase**:
   ```
   User: "Explain normalization"
              ↓
   Azure Functions (/chat/send)
              ↓
   Azure AI Search: Vector similarity search
   (Find top-3 relevant chunks)
              ↓
   Assembly: Prompt = [system instructions] + [chunks] + [user query]
              ↓
   Azure OpenAI (GPT-4o): Stream response
              ↓
   Response: Cited chunks + explanation
   Audit Log: (activities collection)
   ```

**Database Schema**:
- `documents`: { _id, fileName, totalChunks, uploadedAt, status }
- `document_chunks`: { _id, documentId, chunkIndex, text, aiSearchIndexed }
- `messages`: { userId, groupId, content, sources:[chunk IDs], createdAt }

---

### Feature 2: Quiz Generation (Structured JSON Mode)

**User Journey**: Provide text → Generate quiz → Take quiz → See results & leaderboard

1. **Generation Phase**:
   ```
   User submits text → Azure Functions (/generate/quiz)
                       ↓
                  System Prompt (Responsible AI):
                  "You are a Nigerian University Professor.
                   Generate 10 multiple-choice questions.
                   Return ONLY valid JSON."
                       ↓
                  Azure OpenAI (GPT-4o) + JSON Mode
                  (Enforces valid JSON output)
                       ↓
                  Validation: Parse + Schema check
                  If invalid: Retry (up to 3x)
                       ↓
                  Cosmos DB (quizzes collection)
   ```

2. **Submission Phase**:
   ```
   Member submits answers → Azure Functions (/quiz/submit)
                            ↓
                       Calculate score
                       ↓
                       Cosmos DB (quizResults collection)
                       ↓
                       Event: quiz.submitted (domain event)
                       ↓
                       Leaderboard aggregation query
   ```

**System Prompt (Responsible AI)**:
```
"Generate questions strictly based on provided text.
 Forbid discriminatory, harmful, or non-educational content.
 Ensure cultural sensitivity.
 Return valid JSON ONLY."
```

**Database Schema**:
- `quizzes`: { _id, title, groupId, questions:[...], createdBy, metadata:{source, model} }
- `quizResults`: { _id, quizId, userId, score, answers, takenAt }

---

### Feature 3: Flashcard Generation

**Similar to Quiz**: Text input → JSON structured cards → Personal or group storage

**Prompt Strategy**:
```
"Generate 15 flashcards from the provided text.
 Each card: front (question), back (answer), difficulty, tags.
 Return valid JSON: { cards: [...] }"
```

**Database Schema**:
- `flashcards`: { _id, createdBy, groupId, front, back, difficulty, tags, reviewCount, successRate }

---

### Feature 4: Comprehensive Social Suite

#### 4A. Personal Chat (1-on-1)

```
User A searches User B → Show user profiles
                      ↓
                 Start DM thread
                      ↓
                 (triggers creation of threadId in messages)
                      ↓
                 Real-time (future: WebSocket/SignalR)
                 Send/receive via /chat/send
                      ↓
                 Cosmos DB (messages: toUserId set)
```

#### 4B. Group Creation & Management

```
User creates group → /groups/create
                   ↓
                   Cosmos DB (groups collection)
                   ├─ adminUserId = creator
                   ├─ memberIds = [creator]
                   └─ settings: { studyModeEnabled, privacy }
                   ↓
                   Activity logged (activities collection)
```

#### 4C. Group Study Mode

```
Admin: "Set a Test" → /generate/quiz with groupId
                   ↓
                   Quiz created with groupId reference
                   ↓
                   System message in group chat
                   ↓
                   Members see quiz in group interface
                   ↓
                   Member submits → /quiz/submit with groupId
                   ↓
                   quizResults.groupId populated
                   ↓
                   Leaderboard computed (aggregation query)
```

#### 4D. Leaderboards

```
Aggregation Pipeline:
1. Match: { quizId, groupId, status: "submitted" }
2. Lookup: Join with users collection
3. Sort: score DESC, submittedAt ASC
4. Project: rank, displayName, avatarUrl, score, duration
5. Return: Top 10 (configurable)

Example query in SCHEMAS.md
```

#### 4E. Shared Resources

```
Member creates flashcard with groupId set
                   ↓
                   Flashcard appears in group stream
                   ↓
                   Other members can review/fork it
                   ↓
                   Cosmos DB: flashcards.groupId
```

---

## Real-Time Architecture (Future-Proof Design)

Currently: **REST API** (Azure Functions polling)

Future: **Azure Web PubSub** or **SignalR**

### Event Design (Domain Events)

```javascript
// Define event payloads for future pub/sub integration

const Events = {
  "message.created": {
    messageId, userId, groupId, content, timestamp
  },
  "quiz.submitted": {
    quizId, userId, groupId, score, timestamp
  },
  "group.created": {
    groupId, adminUserId, name, timestamp
  },
  "flashcard.shared": {
    flashcardId, createdBy, groupId, timestamp
  }
};

// Event emitter pattern in services:
// this.emit('message.created', { messageId, userId, ... })
// Future: Wire to Web PubSub publisher
```

---

## Security & Responsible AI

### Authentication & Authorization

- **JWT tokens**: Issued on login, stored client-side
- **Function-level auth**: Middleware checks token validity
- **Role-based access**: Admin vs Member vs Anonymous (future)

### Data Protection

- **Passwords**: Bcrypt hashing (10 rounds)
- **Blob Storage**: Private containers + SAS token URLs (time-limited)
- **Cosmos DB**: Encryption at rest + IP firewall rules

### Responsible AI Guardrails

**System Message Template**:
```
"You are an educational assistant.
 Your response must be:
 • Based on the provided text or quiz context
 • Free from discrimination, hate, or bias
 • Age-appropriate for university students
 • Focused on learning outcomes

 If unsure, respond: 'I'm not sure based on provided material.'"
```

**Logging for Review**:
```javascript
// In quiz generation:
if (response.flaggedForReview) {
  activities.insertOne({
    type: "ai.flagged-output",
    quizId, model: "gpt-4o",
    reason, timestamp
  });
  // Human review required before release
}
```

### Audit Trail

```
activities collection: { userId, type, meta, createdAt }

Types:
- quiz.submitted
- message.sent
- file.uploaded
- group.created
- ai.flagged-output (for responsible AI)

Supports: Compliance, debugging, analytics
```

---

## Deployment & DevOps

### Frontend (Azure Static Web Apps)

```yaml
Vite build → dist/ folder
             ↓
      Azure Static Web App (auto from GitHub)
             ↓
      CDN (global edge locations)
             ↓
      HTTPS, caching, purge on new builds
```

### Backend (Azure Functions)

```
npm install → npm run build → Deployment package
             ↓
Azure Functions runtime (Node.js v4)
             ↓
Consumption plan (pay-per-execution)
             ↓
Auto-scaling (0 to N instances)
```

### Database (Cosmos DB)

```
Connection pooling in backend
Indexes on frequently queried fields
Backup: Continuous backup (30 days retention)
Point-in-time restore available
```

---

## Performance Considerations

1. **Caching**:
   - Frontend: Service Worker for offline capability
   - Backend: Redis (optional, via Azure Cache for Redis)

2. **Query Optimization**:
   - Cosmos DB: Compound indexes on `{ groupId, createdAt }`
   - AI Search: Vector index tuned for cosine similarity

3. **Chunking Strategy**:
   - Configurable chunk size (default 1024 chars)
   - Overlap for context preservation (200 chars)
   - Embedding batch processing

4. **Throttling**:
   - Quiz generation: 1 per user per minute (prevent abuse)
   - File uploads: Max 50MB per file
   - API rate limiting (future)

---

## Cost Optimization

| Service | Tier | Estimated Cost | Notes |
|---------|------|-----------------|-------|
| Cosmos DB | Free | $0 | 1000 RU/s, auto-scale |
| Blob Storage | Hot | $1-5/month | PDF storage |
| AI Search | Free | $0 | 50MB limit; upgrade to Standard for production |
| OpenAI (GPT-4o) | Tokens | $0.015/1K input, $0.06/1K output | Volume discounts available |
| Functions | Consumption | Pay-per-execution | First 1M invocations free |
| Static Web App | Free | $0 | 100GB bandwidth, auto-HTTPS |

**Total**: ~$50-100/month for production volume

---

## Monitoring & Observability

- **Application Insights**: Integrated with Azure Functions
- **Logs**: Streamed to Cosmos DB (activities collection)
- **Alerts**: Cost, error rate, latency thresholds
- **Dashboard**: Azure Portal analytics

---

## References

- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [Azure AI Search (Vector Search)](https://learn.microsoft.com/azure/search/vector-search-overview)
- [Azure Functions Node.js v4 Model](https://learn.microsoft.com/azure/azure-functions/functions-node-how-to)
- [Cosmos DB Best Practices](https://learn.microsoft.com/azure/cosmos-db/best-practices)
