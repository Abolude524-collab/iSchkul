# ischkul-azure Backend

## Overview

Azure Functions backend implementing four core features:
1. **Co-Reader (RAG)**: PDF upload → embedding → AI Search → GPT-4o responses
2. **Quiz Generation**: Text → JSON-mode structured quizzes
3. **Flashcard Generation**: Similar to quiz with flashcard schema
4. **Social Suite**: Groups, chats, leaderboards, shared resources

## Project Structure

```
backend/
├── functions/          # Azure Functions (HTTP triggers)
│   ├── auth/          # Login, register
│   ├── chat/          # Send/receive messages
│   ├── files/         # PDF upload
│   └── generate/      # Quiz, flashcard generation
├── libs/
│   ├── controllers/   # Request handlers
│   ├── services/      # Business logic
│   ├── repos/         # Data access
│   └── events/        # Domain events (for Web PubSub)
├── host.json          # Functions config
├── local.settings.json  # Dev environment
├── package.json
└── .env.example
```

## Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Azure credentials

# Start local functions runtime
npm run dev:functions
```

## API Endpoints

### Authentication
- `POST /auth/login` — Login with email/password

### Chat
- `POST /chat/send` — Send message
- `GET /chat/messages` — Get messages (group or DM)

### Quiz
- `POST /generate/quiz` — Generate quiz from text
- `GET /quiz/{quizId}` — Get quiz details
- `POST /quiz/{quizId}/submit` — Submit quiz answers

### Files
- `POST /files/upload` — Upload PDF

### Groups
- `POST /groups/create` — Create study group
- `GET /groups` — List user's groups
- `GET /groups/{groupId}` — Get group details

## Key Features

### Responsible AI
- System prompts forbid discriminatory content
- Content flagging for human review
- Audit logging in activities collection

### Real-Time Ready
Domain events defined for future Web PubSub integration:
- `message.created`
- `quiz.submitted`
- `group.created`
- `flashcard.shared`

### Database
All data persists in Cosmos DB (MongoDB API):
- users, groups, messages, quizzes, quizResults, flashcards, activities, document_chunks

See [docs/SCHEMAS.md](../docs/SCHEMAS.md) for full schema documentation.

## Deployment

```bash
# Deploy to Azure Functions
func azure functionapp publish <FUNCAPP_NAME>
```

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for full deployment guide.
