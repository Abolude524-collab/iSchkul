# AI Co-Reader: Technical Specification v2.0
**iSchkul Platform**

---

## 📋 Table of Contents
1. [Executive Summary](#executive-summary)
2. [Problem Statement & Solution](#problem-statement--solution)
3. [User Experience Design](#user-experience-design)
4. [Technical Architecture](#technical-architecture)
5. [API Specifications](#api-specifications)
6. [Implementation Details](#implementation-details)
7. [Security & Performance](#security--performance)
8. [Responsible AI Integration](#responsible-ai-integration)
9. [Roadmap & Future Features](#roadmap--future-features)

---

## 1. Executive Summary

### Overview
The **AI Co-Reader** is a context-aware document intelligence assistant that transforms passive PDF reading into an interactive learning experience. Built on modern open-source AI infrastructure, it provides real-time comprehension assistance while maintaining focus and minimizing distractions.

### Core Value Proposition
> **"Read alone when you want focus. Toggle the AI when you get stuck."**

Unlike traditional chatbots that operate in isolation, the Co-Reader is:
- ✅ **Context-Aware**: Knows what page and document the student is viewing
- ✅ **Non-Intrusive**: Seamlessly toggles between focus and assistance modes
- ✅ **Verifiable**: Provides page citations for every answer
- ✅ **Gamified**: Integrates with Pomodoro timers for active recall challenges

### Target Outcome
Transform studying from a lonely, passive activity into an engaging, AI-augmented learning dialogue—without sacrificing focus or requiring context switching.

---

## 2. Problem Statement & Solution

### The Problem
**Traditional E-Learning PDF Readers:**
- 📄 Static documents = passive learning
- 🔍 Students must leave the document to search for explanations
- 😴 No engagement tracking or comprehension verification
- 🤖 Generic AI chatbots lack document context

### Our Solution: The Three-Mode Study System

#### Mode 1: **Focus Mode** (Default)
- **State**: Full-screen, distraction-free PDF viewer
- **UI**: Clean interface with only navigation controls
- **Purpose**: Deep reading and concentration
- **Toggle**: Floating "✨ AI Co-Reader" button (bottom-right, unobtrusive)

#### Mode 2: **Co-Reader Mode** (AI Assistance)
- **State**: Split-screen (70% PDF / 30% AI Panel)
- **UI**: AI chat panel slides in from right with smooth animation
- **Purpose**: On-demand explanations, summaries, and Q&A
- **Context**: AI greets with document-specific insights
  ```
  "Hi Testimony! I see you're reading CHM101 Module 1: Atomic Theory.
  
  Quick navigation:
  • Section 1.2: Dalton's Law (Page 12)
  • Section 1.4: Stoichiometry (Page 18)
  
  What would you like to explore?"
  ```

#### Mode 3: **Active Study Mode** (Pomodoro Integration)
- **Trigger**: After 25 minutes of continuous reading
- **UI**: AI panel auto-expands with "Brain Break" badge
- **Purpose**: Active recall and spaced repetition
- **Example**:
  ```
  🧠 Brain Break Challenge!
  
  You've been reading for 25 minutes. Time to test your recall:
  
  Q: What is the 3rd postulate of Dalton's Atomic Theory?
  
  [Type Answer] [Skip] [Next Question]
  ```

---

## 3. User Experience Design

### 3.1 Interface Components

#### A. Toggle Button
```css
/* Floating Action Button */
.ai-toggle-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  z-index: 1000;
  transition: all 0.3s ease;
}

.ai-toggle-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}
```

**States**:
- Inactive: "✨ AI Co-Reader" (gray)
- Active: "🤖 Co-Reader Active" (gradient)
- Pulsing: "🧠 Brain Break Ready!" (animated)

#### B. Split-Screen Layout
```typescript
interface LayoutConfig {
  focusMode: {
    pdfWidth: '100%',
    aiPanelWidth: '0px',
    aiPanelVisible: false
  },
  coReaderMode: {
    pdfWidth: '70%',
    aiPanelWidth: '30%',
    aiPanelVisible: true,
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
  }
}
```

#### C. Chat Interface Design

**Message Bubbles**:
```typescript
// User Message
<div className="message user">
  <div className="bubble bg-blue-600 text-white">
    Explain Stoichiometry in simple terms
  </div>
  <span className="timestamp">14:32</span>
</div>

// AI Response
<div className="message ai">
  <div className="bubble bg-gray-100 text-gray-900">
    <p>Stoichiometry is the calculation of reactants and products in chemical reactions...</p>
    <div className="citations">
      <a href="#page-18" className="citation">[Page 18]</a>
      <a href="#page-19" className="citation">[Page 19]</a>
    </div>
  </div>
  <span className="timestamp">14:32</span>
</div>
```

**Quick Actions Bar**:
```html
<div class="quick-actions">
  <button>📄 Summarize This Page</button>
  <button>❓ Generate Quiz</button>
  <button>🔍 Find Key Terms</button>
  <button>💡 Explain Concept</button>
</div>
```

### 3.2 Page-Aware Follow Mode

**Behavior**: AI tracks user's current page in real-time

**Implementation**:
```typescript
// Frontend tracking
const pdfViewer = useRef<PDFViewerRef>(null);

useEffect(() => {
  const handleScroll = () => {
    const currentPage = pdfViewer.current?.getCurrentPage();
    setActivePage(currentPage);
    
    // Send page context to AI
    updateAIContext({
      documentId: currentDoc.id,
      currentPage: currentPage,
      visibleText: extractVisibleText(currentPage)
    });
  };
  
  pdfViewer.current?.addEventListener('scroll', debounce(handleScroll, 500));
}, [currentDoc]);
```

**Feature: "Explain This Page"**:
```typescript
const handleExplainPage = async () => {
  const pageText = await extractPageText(activePage);
  
  const response = await coReaderAPI.chat({
    message: "Summarize and explain the key concepts on this page",
    context: {
      documentId: currentDoc.id,
      pageNumber: activePage,
      pageContent: pageText
    }
  });
  
  displayAIResponse(response);
};
```

---

## 4. Technical Architecture

### 4.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│  ┌─────────────────┐              ┌────────────────────┐   │
│  │  PDF.js Viewer  │◄────────────►│  AI Chat Panel     │   │
│  │  - Page tracking│              │  - Message history │   │
│  │  - Text extract │              │  - Quick actions   │   │
│  └────────┬────────┘              └─────────┬──────────┘   │
└───────────┼──────────────────────────────────┼──────────────┘
            │                                  │
            │ Page Context                     │ Chat Query
            ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Express.js)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Co-Reader Service                       │   │
│  │  - Document context management                       │   │
│  │  - Query preprocessing                               │   │
│  │  - Response formatting with citations                │   │
│  └───────┬──────────────────────────┬──────────────────┘   │
└──────────┼──────────────────────────┼──────────────────────┘
           │                          │
           │ Vector Search            │ LLM Request
           ▼                          ▼
┌─────────────────────┐    ┌──────────────────────────┐
│  Pinecone / Qdrant  │    │   OpenAI API / Gemini    │
│  - Vector index     │    │   - GPT-4o model         │
│  - Semantic ranking │    │   - Streaming responses  │
│  - Hybrid search    │    │   - Content moderation   │
└─────────────────────┘    └──────────────────────────┘
           ▲
           │ PDF Chunks
┌──────────┴──────────┐
│  AWS S3 / GridFS    │
│  - PDF documents    │
│  - Extracted text   │
│  - Metadata         │
└─────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| | PDF.js | PDF rendering and text extraction |
| | Zustand | State management |
| | TailwindCSS | Styling and animations |
| **Backend** | Express.js (Node.js) | REST API server |
| | Socket.io | Real-time page tracking |
| | Mongoose | MongoDB ODM |
| **AI Services** | OpenAI API (GPT-4o) | Conversational AI |
| | Google Gemini (fallback) | Alternative AI model |
| | Pinecone / Qdrant | Vector database & RAG |
| | AWS S3 / MongoDB GridFS | Document storage |
| **Database** | MongoDB | User data, chat history |
| **DevOps** | Heroku / Railway / VPS | Hosting |
| | PM2 / Node clusters | Process management |

### 4.3 Data Flow: RAG Pipeline

**Step-by-Step Process**:

1. **Document Upload & Ingestion**
```typescript
// POST /api/documents/upload
async function uploadDocument(file: File) {
  // 1. Upload to S3 or MongoDB GridFS
  const fileUrl = await s3Storage.upload(file);
  // OR: const fileId = await gridFS.upload(file);
  
  // 2. Extract text with pdf-parse
  const pdfText = await extractText(file);
  
  // 3. Chunk the document
  const chunks = chunkDocument(pdfText, {
    chunkSize: 1024,
    overlap: 200,
    preserveParagraphs: true
  });
  
  // 4. Generate embeddings with OpenAI
  const embeddings = await openAI.createEmbeddings(chunks);
  
  // 5. Index in Pinecone or Qdrant
  await vectorDB.upsert({
    namespace: docId,
    vectors: chunks.map((chunk, idx) => ({
      id: `${docId}_chunk_${idx}`,
      values: embeddings[idx],
      metadata: {
        content: chunk.text,
        pageNumber: chunk.pageNumber,
        title: file.name,
        uploadedBy: userId
      }
    }))
  });
  
  return { documentId: docId, status: 'indexed' };
}
```

2. **Query Processing**
```typescript
// POST /api/co-reader/chat
async function processQuery(query: string, context: DocumentContext) {
  // 1. Generate query embedding
  const queryEmbedding = await openAI.createEmbedding(query);
  
  // 2. Vector similarity search with Pinecone/Qdrant
  const relevantChunks = await vectorDB.query({
    vector: queryEmbedding,
    filter: {
      uploadedBy: context.userId // Only user's documents
    },
    topK: 5,
    includeMetadata: true
  });
  
  // 3. Build augmented prompt
  const systemPrompt = `You are the AI Co-Reader for iSchkul. You help students understand their course materials.
  
CONTEXT FROM DOCUMENT "${context.documentTitle}":
${relevantChunks.map(c => `[Page ${c.metadata.pageNumber}]\n${c.metadata.content}`).join('\n\n')}

INSTRUCTIONS:
- Answer based ONLY on the provided context
- Cite page numbers in [Page X] format
- If information is not in context, say "I don't see that information in this document"
- Use simple, student-friendly language
- Highlight key terms in **bold**`;

  const userPrompt = `Student is on Page ${context.currentPage}. Question: ${query}`;
  
  // 4. Stream response from OpenAI API
  const stream = await openAI.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    stream: true
  });
  
  return stream;
}
```

---

## 5. API Specifications

### 5.1 RESTful Endpoints

#### **POST /api/documents/upload**
Upload and process a PDF document for Co-Reader functionality.

**Request**:
```http
POST /api/documents/upload HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

file: [binary PDF data]
courseId: "CHM101"
title: "Module 1: Atomic Theory"
```

**Response**:
```json
{
  "success": true,
  "document": {
    "id": "doc_abc123",
    "title": "Module 1: Atomic Theory",
    "filename": "chm101_module1.pdf",
    "pages": 24,
    "uploadedAt": "2026-01-17T14:30:00Z",
    "fileUrl": "https://s3.amazonaws.com/ischkul-docs/...",
    "indexStatus": "completed",
    "chunkCount": 156
  }
}
```

#### **POST /api/co-reader/chat**
Send a message to the AI Co-Reader with document context.

**Request**:
```json
{
  "documentId": "doc_abc123",
  "message": "Explain Stoichiometry in simple terms",
  "context": {
    "currentPage": 18,
    "visibleText": "Stoichiometry is derived from...",
    "previousMessages": [
      { "role": "user", "content": "What is this chapter about?" },
      { "role": "assistant", "content": "This chapter covers..." }
    ]
  },
  "options": {
    "temperature": 0.7,
    "maxTokens": 500,
    "streamResponse": true
  }
}
```

**Response** (Streaming):
```json
{
  "messageId": "msg_xyz789",
  "content": "**Stoichiometry** is the branch of chemistry...",
  "citations": [
    { "pageNumber": 18, "snippet": "reactants and products..." },
    { "pageNumber": 19, "snippet": "molar ratios..." }
  ],
  "metadata": {
    "tokensUsed": 247,
    "processingTime": 1.2,
    "model": "gpt-4o"
  }
}
```

#### **GET /api/co-reader/quick-actions/:documentId**
Get contextual quick actions for the current page.

**Response**:
```json
{
  "actions": [
    {
      "id": "summarize",
      "label": "📄 Summarize This Page",
      "prompt": "Provide a concise summary of page {pageNumber}"
    },
    {
      "id": "quiz",
      "label": "❓ Generate Quiz",
      "prompt": "Create 5 multiple choice questions from page {pageNumber}"
    },
    {
      "id": "key-terms",
      "label": "🔍 Extract Key Terms",
      "prompt": "List and define the key terms on page {pageNumber}"
    }
  ]
}
```

#### **POST /api/co-reader/pomodoro-quiz**
Generate a Pomodoro break quiz from recently read pages.

**Request**:
```json
{
  "documentId": "doc_abc123",
  "pagesRead": [12, 13, 14, 15, 16, 17, 18],
  "difficulty": "medium",
  "questionCount": 3
}
```

**Response**:
```json
{
  "quizId": "quiz_pomo_001",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "What is the 3rd postulate of Dalton's Atomic Theory?",
      "options": [
        "Atoms are indivisible",
        "Atoms of the same element are identical",
        "Atoms combine in whole number ratios",
        "Atoms can be created or destroyed"
      ],
      "correctAnswer": 2,
      "pageReference": 14
    }
  ],
  "timeLimit": 180
}
```

### 5.2 WebSocket Events (Socket.io)

**Event: `page-changed`**
```typescript
socket.emit('page-changed', {
  documentId: 'doc_abc123',
  pageNumber: 18,
  timestamp: Date.now()
});
```

**Event: `co-reader-message`**
```typescript
socket.on('co-reader-response', (data) => {
  // Receive streaming AI response chunks
  appendToChat(data.content);
});
```

---

## 6. Implementation Details

### 6.1 Frontend Component Structure

```
src/pages/
├── CoReaderPage.tsx              # Main Co-Reader interface
├── components/
│   ├── PDFViewer/
│   │   ├── PDFCanvas.tsx         # PDF.js wrapper
│   │   ├── PageNavigator.tsx     # Page controls
│   │   └── TextExtractor.ts      # Text extraction utilities
│   ├── AIPanel/
│   │   ├── ChatInterface.tsx     # Message display
│   │   ├── QuickActions.tsx      # Action buttons
│   │   ├── MessageBubble.tsx     # Individual messages
│   │   └── CitationLink.tsx      # Page reference links
│   └── CoReaderToggle.tsx        # Floating toggle button
```

### 6.2 Backend Route Structure

```
backend1/routes/
├── coReader.js                   # Main Co-Reader routes
├── documents.js                  # Document management
└── services/
    ├── openai.js                 # OpenAI API integration
    ├── vectorDB.js               # Pinecone/Qdrant client
    ├── storageService.js         # S3/GridFS storage
    ├── pdfProcessor.js           # PDF chunking & embedding
    └── citationExtractor.js      # Citation generation
```

### 6.3 Database Schemas

**Document Schema**:
```typescript
{
  _id: ObjectId,
  title: String,
  filename: String,
  uploadedBy: ObjectId,
  courseId: String,
  fileUrl: String, // S3 URL or GridFS file ID
  pages: Number,
  chunkCount: Number,
  indexStatus: 'pending' | 'processing' | 'completed' | 'failed',
  metadata: {
    fileSize: Number,
    contentType: String,
    uploadedAt: Date
  },
  vectorIndexId: String, // Pinecone namespace or Qdrant collection
  accessControl: {
    visibility: 'private' | 'group' | 'public',
    allowedUsers: [ObjectId]
  }
}
```

**Chat History Schema**:
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  documentId: ObjectId,
  sessionId: String,
  messages: [{
    role: 'user' | 'assistant',
    content: String,
    citations: [{
      pageNumber: Number,
      snippet: String,
      chunkId: String
    }],
    timestamp: Date
  }],
  metadata: {
    totalTokens: Number,
    avgResponseTime: Number,
    pagesDiscussed: [Number]
  }
}
```

---

## 7. Security & Performance

### 7.1 Security Measures

**Access Control**:
- ✅ JWT authentication for all Co-Reader endpoints
- ✅ Document-level permissions (private, group, public)
- ✅ Rate limiting: 30 queries/minute per user (using express-rate-limit)
- ✅ Content moderation via OpenAI Moderation API

**Data Privacy**:
- ✅ End-to-end encryption for uploaded documents
- ✅ Automatic PII detection and redaction
- ✅ GDPR-compliant data retention (90 days)
- ✅ User consent for AI interaction logging

### 7.2 Performance Optimization

**Caching Strategy**:
```typescript
// Redis cache for frequent queries
const cacheKey = `co-reader:${documentId}:${hashQuery(query)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// Cache for 1 hour
await redis.setex(cacheKey, 3600, JSON.stringify(response));
```

**Streaming Responses**:
```typescript
// Server-Sent Events for real-time AI responses
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

for await (const chunk of aiStream) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
```

**PDF Processing**:
- Lazy loading: Load only visible pages
- Web Workers for text extraction (non-blocking)
- Thumbnail caching in IndexedDB

---

## 8. Responsible AI Integration

### 8.1 Content Safety

**System Prompts Include**:
```
- Prohibit discriminatory or biased responses
- Promote academic integrity (no exam answers)
- Cultural sensitivity in explanations
- Age-appropriate language (college level)
- Decline inappropriate requests
```

**Audit Trail**:
- All AI interactions logged with `activityType: 'co_reader_query'`
- Monthly bias audits using OpenAI Moderation API
- User feedback mechanism for response quality

### 8.2 Transparency

**Citations Required**:
- Every AI response must cite source pages
- "Confidence score" displayed for answers
- "I don't know" responses when context insufficient

**Human-in-the-Loop**:
- Flagged responses reviewed by educators
- User can report inaccurate answers
- Community-driven answer improvements

---

## 9. Roadmap & Future Features

### Phase 1: MVP (Current)
- ✅ Split-screen PDF viewer with AI chat
- ✅ Context-aware Q&A with citations
- ✅ Pomodoro trivia integration
- ✅ Page-aware follow mode

### Phase 2: Enhanced Interactivity (Q2 2026)
- 🎯 **Voice Mode**: Web Speech API or ElevenLabs for audio reading
- 🎯 **Annotation Sync**: Highlight text → Ask AI about selection
- 🎯 **Collaborative Reading**: Share Co-Reader sessions with groups
- 🎯 **Smart Summaries**: Auto-generate chapter summaries

### Phase 3: Advanced Intelligence (Q3 2026)
- 🚀 **Multi-Doc Chat**: Compare concepts across multiple PDFs
- 🚀 **Adaptive Learning**: AI adjusts explanation complexity
- 🚀 **Exam Predictor**: Suggests likely exam questions
- 🚀 **Visual Learning**: Generate diagrams from text

### Phase 4: Ecosystem Integration (Q4 2026)
- 🌟 **Lecture Integration**: Sync Co-Reader with recorded lectures
- 🌟 **Flashcard Generator**: Auto-create Anki decks from PDFs
- 🌟 **Study Path Optimizer**: AI-curated reading order
- 🌟 **Mobile Companion**: Offline Co-Reader for iOS/Android

---

## 10. Success Metrics

### User Engagement
- **Target**: 70% of PDF readers activate Co-Reader within 10 minutes
- **Metric**: Average 8 queries per study session
- **Retention**: 85% return rate for Co-Reader feature

### Learning Outcomes
- **Target**: 25% improvement in comprehension quiz scores
- **Metric**: 90% positive feedback on AI answer accuracy
- **Impact**: 40% reduction in "stuck time" (seeking external help)

### Technical Performance
- **Latency**: <2s for first response token
- **Availability**: 99.5% uptime
- **Accuracy**: 95% citation correctness

---

## 💡 Strategic Importance

### Why This is Your Killer Feature

**1. Solves the Distraction Problem**  
Unlike standalone chatbots, the Co-Reader is embedded in the study workflow. Students don't context-switch—they stay in their document.

**2. Verifiable Intelligence**  
Page citations build trust. Students can fact-check the AI instantly, addressing the "hallucination" concern.

**3. Gamification Bridge**  
Pomodoro integration transforms passive reading into active challenges, earning XP and maintaining engagement.

**4. Open-Source Stack**  
Built entirely on open-source and accessible AI technologies, making it cost-effective and vendor-independent while maintaining world-class performance.

**5. Scalable & Sustainable**  
RAG architecture ensures the AI scales with document uploads without retraining. Add 1,000 PDFs? No problem.

---

**Document Version**: 2.0  
**Last Updated**: January 17, 2026  
**Authors**: iSchkul Development Team  
**Status**: Ready for Implementation 🚀

---

## Additional Implementation Notes

### Vector Database Options

#### Option 1: Pinecone (Managed)
```javascript
// services/vectorDB.js
const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const index = pinecone.index('ischkul-documents');

// Upsert vectors
await index.upsert({
  vectors: embeddings,
  namespace: userId
});

// Query
const results = await index.query({
  vector: queryEmbedding,
  topK: 5,
  includeMetadata: true
});
```

#### Option 2: Qdrant (Self-hosted or Cloud)
```javascript
// services/vectorDB.js
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

// Create collection
await client.createCollection('documents', {
  vectors: { size: 1536, distance: 'Cosine' }
});

// Insert vectors
await client.upsert('documents', {
  points: embeddings.map((vec, idx) => ({
    id: idx,
    vector: vec,
    payload: metadata[idx]
  }))
});

// Search
const results = await client.search('documents', {
  vector: queryEmbedding,
  limit: 5,
  filter: { userId: userId }
});
```

#### Option 3: Weaviate (Self-hosted)
```javascript
// services/vectorDB.js
const weaviate = require('weaviate-ts-client');

const client = weaviate.client({
  scheme: 'http',
  host: process.env.WEAVIATE_HOST,
});

// Store objects
await client.data.creator()
  .withClassName('Document')
  .withProperties(metadata)
  .withVector(embedding)
  .do();

// Query
const result = await client.graphql
  .get()
  .withClassName('Document')
  .withNearVector({ vector: queryEmbedding })
  .withLimit(5)
  .do();
```

### Storage Solutions

#### Option 1: AWS S3
```javascript
// services/storageService.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function uploadFile(file) {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `documents/${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype
  });
  
  await s3.send(command);
  return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
}
```

#### Option 2: MongoDB GridFS (For smaller setups)
```javascript
// services/storageService.js
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');

const conn = mongoose.createConnection(process.env.MONGODB_URI);
let gfs;

conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const writestream = gfs.createWriteStream({
      filename: file.originalname,
      content_type: file.mimetype
    });
    
    writestream.on('close', (file) => {
      resolve(file._id);
    });
    
    writestream.on('error', reject);
    writestream.write(file.buffer);
    writestream.end();
  });
}
```

### AI Model Alternatives

#### Primary: OpenAI API
```javascript
// services/openai.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate embeddings
const embeddings = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: textChunks
});

// Chat completion
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: messages,
  stream: true
});
```

#### Fallback: Google Gemini
```javascript
// services/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateResponse(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

#### Alternative: Anthropic Claude
```javascript
// services/anthropic.js
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const message = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
  stream: true
});
```
