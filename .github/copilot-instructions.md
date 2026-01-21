# ischkul-azure: AI Agent Guide

**Project Type**: AI-powered education platform for students
**Architecture**: Express.js + MongoDB/Cosmos DB + Socket.io + OpenAI + Vector Search

## Project Structure

```
ischkul-azure/
├── backend1/              # Express.js server (Node.js + MongoDB + Socket.io)
│   ├── server.js          # Main entry point
│   ├── models/            # Mongoose schemas
│   ├── routes/            # Express route modules
│   ├── middleware/        # Auth middleware
│   └── utils/             # Helper functions
├── frontend/              # React 18 + Vite + TypeScript + TailwindCSS
├── infra/provision.sh     # Azure resource provisioning (one-command IaC)
├── scripts/               # PDF chunking, embeddings pipeline
└── docs/                  # Architecture, schemas, security, API testing
```

**Backend**: Express.js server with MongoDB/Cosmos DB, Socket.io for real-time features, and Azure AI services integration.

## Critical Workflows

### Starting Local Development
```bash
# Terminal 1: Backend Express server
cd backend1 && npm run dev           # http://localhost:5000

# Terminal 2: Frontend dev server
cd frontend && npm run dev           # http://localhost:5173
```

### Running Scripts
- **Create super admin**: `cd backend1 && node create-superadmin.js`
- **PDF chunking/embeddings**: `cd scripts && node chunk-and-embed.js <path-to-pdf>`
- **Check DB schemas**: `cd backend1 && node check_schema.js`

### Azure Deployment
```bash
cd infra && chmod +x provision.sh && ./provision.sh
# Creates: Cosmos DB, Blob Storage, Azure OpenAI, AI Search, Functions
```

## Database Architecture

**Type**: Azure Cosmos DB with MongoDB vCore API  
**Connection Pattern**:
```javascript
const { MoMongoDB via Mongoose (can use Azure Cosmos DB with MongoDB API)  
**Connection Pattern**:
```javascript
const mongoose = require('mongoose');

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ischkul', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
- `users`: Auth (bcryptjs passwords), profiles, XP/levels
- `groups`: Study groups with admin/members, settings
- `messages`: Chat (personal + group), attachments, threaded replies
- `quizzes`: AI-generated quizzes (JSON Mode structured output)
- `quizResults`: User submissions, scores, leaderboard aggregation
- `flashcardSets`: Collections of flashcards (personal/group)
- `documents`: Uploaded PDFs metadata (Co-Reader feature)
- `Express.js Server Architecture

### Server Setup ([backend1/server.js](backend1/server.js))
```javascript
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/groups', require('./routes/groups'));
// ... more routes

// Socket.io setup for real-time features
io.on('connection', (socket) => {
  console.log('User connected');
  // Socket event handlers
});

server.listen(PORT, () =AI-Powered)
**Endpoint**: `POST /api/generate/quiz`  
**Process**:
1. Call Azure OpenAI with system prompt: `"Generate 10 MCQs. Return ONLY valid JSON."`
2. Use `response_format: { type: "json_object" }` to enforce JSON
3. Parse and validate schema (retry up to 3x on failure)
4. Store in `quizzes` collection with metadata: `{model: "gpt-4o", source: "azure-openai"}`

**Implementation**: Check [backend1/routes/generate.js](backend1/routes/generate.js) for the generation logic

router.post('/create', authenticateToken, async (req, res) => {
  try {
    // Business logic
    const quiz = await Quiz.create({...req.body});
    res.json({ success: true, data: quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```
};
```

**No shared connection pool**: Each invocation creates/closes client (serverless pattern).

## AI Features Implementation

### 1. Quiz Generation (JSON Mode)
**Endpoint**: `POST /api/generate/quiz`  
**Process**:
1. Call Azure OpenAI with system prompt: `"Generate 10 MCQs. Return ONLY valid JSON."`
2. Use `response_format: { type: "json_object" }` to enforce JSON
3. Parse and validate schema (retry up to 3x on failure)
4. Store in `quizzes` collection with metadata: `{model: "gpt-4o", source: "azure-openai"}`

**Fallback**: If OpenAI fails, use `generateFallbackQuiz()` in [generate/index.js](backend/functions/generate/index.js) (rule-based extraction from text).

### 2. Co-Reader (RAG)
**Upload Pipeline** ([scripts/chunk-and-embed.js](scripts/chunk-and-embed.js)):
```
PDF → Extract text (pdf-parse) → Chunk (1024 chars, 200 overlap)
→ Genebcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hashedPassword = await bcrypt.hash(password, 10);
const token = jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
```

**Middleware Pattern** ([middleware/auth.js](backend1/middleware/auth.js)):
```javascript
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  tSocket.io Real-Time Features

### Server Setup ([backend1/server.js](backend1/server.js))
```javascript
const io = socketIo(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join group chat
  socket.on('join-group', ({ groupId }) => {
    socket.join(groupId);
  });
  
  // Send message to group
  socket.on('send-message', async (data) => {
    const message = await Message.create(data);
    io.to(data.groupId).emit('new-message', message);
  });
  
  // Personal chat
  socket.on('join_private_chat', ({ userId1, userId2 }) => {
    const roomId = [userId1, userId2].sort().join('-');
    socket.join(roomId);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
```

### Passing io to Routes
Some routes need Socket.io instance for real-time events:
```javascript
// In server.js
require('./routes/contactRequests').setIo(io);
require('./routes/admin').setIo(io);

// In route file
let io;
module.exports.seRoute
1. Create or update route file in `backend1/routes/`
2. Add route handler with authentication:
```javascript
router.post('/new-endpoint', authenticateToken, async (req, res) => {
  try {
    // Business logic
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```
3. Register route in `server.j5000/api`
- Get JWT: `POST /api/auth/login` → Copy `token` → Add to headers: `Authorization: Bearer <token>`

**Example**:
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ischkul.com","password":"admin123"}'

# Use token
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Debugg1/server.js](backend1/server.js) | Main Express server entry point |
| [backend1/README.md](backend1/README.md) | Backend setup and API documentation
- Check logs: `npm run dev` terminal output
- Enable Mongoose debug: `mongoose.set('debug', true);` in server.js
- VSCode breakpoints: Standard Node.js debuggin

module.exports = authenticateTokenng response
→ Cite sources (chunk IDs)
```

### 3. Responsible AI Practices
- System prompts include: `"Forbid discriminatory content. Cultural sensitivity required."`
- Audit logging: All AI interactions stored in `activities` collection
- Content flagging: Human review for flagged responses
- Input validation: Max 50,000 chars per generation request

## Authentication & Security

**Flow**: JWT-based (7-day expiry)
```javascript
// LoError Handling**: Always wrap async route handlers in try-catch, return `{ error: "message" }` with HTTP status (400/401/500).
2. **Environment Variables**: 
   - `MONGODB_URI`: Database connection string
   - `JWT_SECRET`: Token signing key
   - `AZURE_OPENAI_API_KEY`: Azure OpenAI access
   - `AZURE_AI_SEARCH_KEY`: Azure AI Search access
   - `FRONTEND_URL`: CORS allowed origin
3. **Password Hashing**: Use `bcryptjs` with cost factor 10 for compatibility.
4. **Leaderboard Queries**: Use MongoDB aggregation pipelines (see [backend1/routes/leaderboard.js](backend1/routes/leaderboard.js)).
5. **Socket.io Integration**: Pass io instance to routes that need real-time events via `setIo()` method.
6. **File Uploads**: Configure multer for local dev, use Azure Blob Storage for production
```javascript
// Inside function handler
const token = req.headers.authorization?.split(' ')[1];
if (!token) throw new Error("Unauthorized");
consMongoDB Connection**: Ensure MongoDB is running locally or MONGODB_URI env var is set correctly.
- **Socket.io CORS**: Must match frontend URL exactly (protocol + domain + port).
- **Azure OpenAI Rate Limits**: Handle 429 errors with exponential backoff in AI routes.
- **JWT Expiry**: Frontend must handle 401 responses by redirecting to login.
- **File Upload Size**: Limited to 50MB (adjust in `express.json({ limit: '50mb' })` if needed).
- **Socket.io Rooms**: Must call `socket.join(roomId)` before emitting to room.
- **Mongoose Models**: Always require models before using them in routes

## Frontend Architecture

**State Management**: Zustand (NOT Redux/Context)
```typescript
// src/services/store.ts
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token })
}));
```

**API Client**: [src/services/api.ts](frontend/src/services/api.ts) — Axios with interceptors for JWT attachment.

**Routing**: React Router v6, protected routes via `<ProtectedRoute>` wrapper checking `useAuthStore().user`.

## Common Tasks

### Adding a New Azure Function
1. Create folder: `backend/functions/<domain>/`
2. Add `function.json`: `{ "bindings": [{ "authLevel": "anonymous", "type": "httpTrigger", "direction": "in", "methods": ["post"] }] }`
3. Create `index.js` with `module.exports = async function (context, req) {...}`
4. Update `host.json` if needed (typically not required)

### Modifying Database Schema
1. Update [docs/SCHEMAS.md](docs/SCHEMAS.md) with new fields/collections
2. No migration needed (MongoDB flexible schema)
3. Add indexes if querying on new fields: `db.collection.createIndex({field: 1})`

### Testing APIs Locally
- Use [docs/API_TESTING.md](docs/API_TESTING.md) curl examples
- Base URL: `http://localhost:7071/api` (Azure Functions) or `http://localhost:5000/api` (Express)
- Get JWT: `POST /auth/login` → Copy `token` → Add to headers: `Authorization: Bearer <token>`

### Debugging Azure Functions
- Check logs: `func start` terminal output
- Enable verbose: `func start --verbose`
- VSCode breakpoints: Use "Attach to Node Functions" launch config

## Key Files Reference

| File | Purpose |
|------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, RAG pipeline |
| [docs/SCHEMAS.md](docs/SCHEMAS.md) | All Cosmos DB collections, aggregation queries |
| [docs/SECURITY.md](docs/SECURITY.md) | JWT, bcrypt, SAS tokens, responsible AI |
| [backend/.env.example](backend/.env.example) | Required Azure credentials template |
| [infra/provision.sh](infra/provision.sh) | Azure resource creation (IaC) |
| [scripts/chunk-and-embed.js](scripts/chunk-and-embed.js) | RAG embedding pipeline |

## Project-Specific Conventions

1. **No TypeScript in Azure Functions**: Use plain JavaScript with JSDoc comments for Azure Functions v4 compatibility.
2. **Error Responses**: Always return `{ error: "message" }` with appropriate HTTP status (400/401/500).
3. **Environment Variables**: Prefix Azure-specific with `AZURE_*` (e.g., `AZURE_OPENAI_ENDPOINT`).
4. **Leaderboard Queries**: Use MongoDB aggregation pipelines (see [backend1/routes/leaderboard.js](backend1/routes/leaderboard.js)).
5. **Socket.io**: Only in `backend1/` (Express). Azure Functions use HTTP polling or Web PubSub (future).
6. **File Uploads**: Always use Azure Blob Storage, never local filesystem. Generate SAS tokens for downloads.

## Testing Credentials

**Super Admin** (created via `backend1/create-superadmin.js`):
- Email: `admin@ischkul.com`
- Password: `admin123` (change after first login!)

## Common Pitfalls

- **Cosmos DB Connections**: Always close client in `finally` block to avoid quota exhaustion.
- **Azure OpenAI Rate Limits**: Handle 429 errors with exponential backoff.
- **JWT Expiry**: Frontend must handle 401 responses by redirecting to login.
- **File Upload Size**: Limited to 50MB (adjust in `express.json({ limit: '50mb' })` if needed).
- **Vector Search**: Requires embeddings field in Azure AI Search index (configured in `provision.sh`).

## Documentation Priority

When making changes:
1. Update [docs/SCHEMAS.md](docs/SCHEMAS.md) for DB changes
2. Update [docs/API_TESTING.md](docs/API_TESTING.md) for new endpoints
3. Update this file for new workflows or patterns
