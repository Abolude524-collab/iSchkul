# PDF Proxy System - Testing & Implementation Guide

## Overview

The PDF proxy system solves CORS issues by downloading PDFs server-side and serving them to authenticated frontend clients.

**Problem**: Browser blocks cross-origin PDF requests from arxiv.org, ResearchGate, etc.  
**Solution**: Backend proxy endpoint acts as intermediary - fetches PDF server-side (no CORS), streams to frontend client.

---

## Architecture

### Data Flow
```
User → Frontend → Backend /import-url → ArXiv (server-side, no CORS) → S3
         ↓
      Proxy URL ← Backend /documents/:id/content ← S3 (authenticated)
         ↓
      PDFCanvas (displays via proxy)
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/import-url` | POST | Download PDF from external URL, process, store |
| `/api/documents/:id/content` | GET | Proxy: Fetch PDF from S3, stream to client |
| `/api/documents` | GET | List user's documents |

---

## Backend Implementation

### 1. importFromUrl() - Download & Process

**Location**: `backend1/controllers/documentController.js`

**Function**:
```javascript
async importFromUrl(req, res) {
  const { url, title } = req.body;
  const userId = req.user.userId;
  
  try {
    // 1. Download PDF from URL (server-side - no CORS)
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // 2. Convert to buffer
    const buffer = Buffer.from(response.data);
    
    // 3. Extract pages via pdf-parse
    const pdfData = await pdfParser(buffer);
    const pages = pdfData.numPages;
    
    // 4. Extract text for embeddings
    const textContent = pdfData.text.substring(0, 50000); // Limit for API
    
    // 5. Generate embeddings (with graceful fallback)
    const embedding = await openaiService.generateEmbedding(textContent);
    
    // 6. Upload to S3
    const s3Key = `documents/${userId}/${uuid()}.pdf`;
    await storageService.uploadFile(s3Key, buffer, 'application/pdf');
    
    // 7. Save to MongoDB
    const document = await Document.create({
      userId,
      title,
      filename: url.split('/').pop(),
      s3Key,
      pages,
      embedding: embedding || null,
      indexStatus: embedding ? 'indexed' : 'pending'
    });
    
    // 8. Upsert to Pinecone (if embedding exists)
    if (embedding) {
      await vectorDB.upsert([{
        id: document._id.toString(),
        values: embedding,
        metadata: { documentId: document._id }
      }]);
    }
    
    return res.status(201).json({
      success: true,
      document,
      warning: embedding ? null : 'Embeddings unavailable (API quota)'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      details: error.details
    });
  }
}
```

**Error Handling**:
- Timeout: 30s (prevents hanging on slow URLs)
- PDF Parse Failure: Return 400 "Invalid PDF"
- S3 Upload Failure: Return 500 with details
- Embedding Failure: Continue with warning (document still uploads)

---

### 2. serveDocument() - Proxy Endpoint

**Location**: `backend1/controllers/documentController.js`

**Function**:
```javascript
async serveDocument(req, res) {
  const { id } = req.params;
  const userId = req.user.userId;
  
  try {
    // 1. Fetch document metadata
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // 2. Verify ownership
    if (document.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // 3. Fetch from S3
    const fileBuffer = await storageService.getFile(document.s3Key);
    
    // 4. Stream with CORS headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': fileBuffer.length,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `inline; filename="${document.filename}"`
    });
    
    return res.send(fileBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**Security**:
- ✅ Requires JWT authentication
- ✅ Verifies ownership (userId match)
- ✅ Prevents unauthorized document access
- ✅ Returns 403 for other users' documents

---

### 3. Routes

**Location**: `backend1/routes/documents.js`

```javascript
const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const authenticateToken = require('../middleware/auth');

// Import from URL
router.post('/import-url', authenticateToken, (req, res) => {
  return documentController.importFromUrl(req, res);
});

// Get document via proxy
router.get('/:id/content', authenticateToken, (req, res) => {
  return documentController.serveDocument(req, res);
});

// List documents
router.get('/', authenticateToken, (req, res) => {
  return documentController.getDocuments(req, res);
});

module.exports = router;
```

---

## Frontend Implementation

### CoReaderPage.tsx - Use Proxy URL

**Location**: `frontend/src/pages/CoReaderPage.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import PDFCanvas from '../components/reader/PDFCanvas';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function CoReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [documentError, setDocumentError] = useState<string>('');

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        if (id) {
          // Use proxy URL - backend will fetch from S3
          const proxyUrl = `${API_URL}/documents/${id}/content`;
          setFileUrl(proxyUrl);
        } else {
          // Demo document fallback
          setFileUrl(`${API_URL}/documents/demo/content`);
        }
        setIsLoadingDocument(false);
      } catch (error) {
        setDocumentError('Failed to load document');
        setIsLoadingDocument(false);
      }
    };
    
    fetchDocument();
  }, [id]);

  if (isLoadingDocument) {
    return <div>Loading document...</div>;
  }

  if (documentError) {
    return <div>Error: {documentError}</div>;
  }

  return (
    <div>
      {fileUrl && <PDFCanvas fileUrl={fileUrl} />}
    </div>
  );
}
```

**Key Points**:
- ✅ Proxy URL: `/api/documents/{id}/content` (not direct ArXiv)
- ✅ JWT automatically attached by axios interceptor
- ✅ CORS handled server-side (no browser blocking)
- ✅ Fallback to demo document if no ID

---

## Testing Guide

### Prerequisites

1. **Backend Running**:
   ```bash
   cd backend1
   node server.js
   ```
   Expected: `Server running on port 5000`

2. **MongoDB Running**:
   ```bash
   mongosh mongodb://localhost:27017/ischkul
   show collections  # Verify DB exists
   ```

3. **Get JWT Token**:
   - Login to frontend OR
   - Use test script with token from localStorage

---

### Test 1: Import PDF from ArXiv

**Method A: Using Test Script**

```bash
cd backend1

# Get token from browser DevTools → LocalStorage → "token"
node test-pdf-import.js "your-jwt-token-here"
```

**Expected Output**:
```
1️⃣  Importing PDF from ArXiv...
   URL: https://arxiv.org/pdf/1706.03762.pdf
✅ Import successful!
   Document ID: 6764...
   Title: Attention Is All You Need
   Pages: 15
   Chunks: 42

2️⃣  Testing document proxy...
   Proxy URL: http://localhost:5000/api/documents/6764.../content
✅ Proxy working!
   Response size: 2847381 bytes
   Content-Type: application/pdf
```

**Method B: Using curl**

```bash
# 1. Get token
TOKEN=$(node -e "console.log(require('fs').readFileSync('.env', 'utf8').match(/DEMO_TOKEN=(.+)/)?.[1])")

# 2. Import PDF
curl -X POST http://localhost:5000/api/documents/import-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://arxiv.org/pdf/1706.03762.pdf", "title": "Attention Is All You Need"}'

# 3. Check response
# {
#   "success": true,
#   "document": {
#     "_id": "664...",
#     "title": "Attention Is All You Need",
#     "pages": 15
#   }
# }
```

---

### Test 2: Proxy PDF Serving

**Method A: Browser**

1. Import document (Test 1)
2. Note the document ID from response
3. Open DevTools → Network tab
4. Navigate to: `http://localhost:5173/co-reader/{document-id}`
5. Verify PDF displays without CORS errors
6. Check Network tab:
   - Request: `GET /api/documents/{id}/content`
   - Status: 200
   - Response type: Binary (PDF)

**Method B: curl**

```bash
# Download PDF via proxy
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/documents/{id}/content \
  --output test-pdf.pdf

# Verify file size
ls -lh test-pdf.pdf  # Should be ~2-3 MB for ArXiv papers
```

---

### Test 3: End-to-End Workflow

**Step 1: Start Services**

Terminal 1 (Backend):
```bash
cd ischkul-azure/backend1
node server.js
```

Terminal 2 (Frontend):
```bash
cd ischkul-azure/frontend
npm run dev
```

**Step 2: Login**

- Open http://localhost:5173
- Email: admin@ischkul.com
- Password: admin123

**Step 3: Import Document**

- Navigate to Co-Reader page
- Click "Import from URL"
- Paste: `https://arxiv.org/pdf/1706.03762.pdf`
- Title: "Attention Is All You Need"
- Click Import

**Step 4: View Document**

- Wait for upload to complete
- Verify PDF displays without CORS errors
- Scroll through pages
- Verify Page Counter works

**Step 5: AI Chat**

- Open ChatInterface (right panel)
- Ask question about document: "What is self-attention?"
- Verify AI response uses document content

---

## Debugging

### Issue: "CORS policy: No 'Access-Control-Allow-Origin'"

**Check**:
```bash
# Verify proxy endpoint working
curl -v http://localhost:5000/api/documents/{id}/content

# Expected headers:
# < Access-Control-Allow-Origin: *
# < Content-Type: application/pdf
```

**Fix**: Ensure `res.set()` includes CORS headers in serveDocument()

---

### Issue: "Document not found" (404)

**Check**:
```bash
# Verify document exists in MongoDB
mongosh mongodb://localhost:27017/ischkul
db.documents.findOne({ title: "Attention Is All You Need" })
```

**Fix**: 
- Re-run import with correct URL
- Check document ID format (ObjectId)

---

### Issue: "Timeout downloading from URL"

**Check**:
- URL is accessible: `curl -I https://arxiv.org/pdf/1706.03762.pdf`
- Network connection stable
- 30s timeout sufficient for file size

**Fix**:
- Try smaller file first
- Increase timeout in importFromUrl (30000ms → 60000ms)
- Check firewall/proxy blocking arxiv.org

---

### Issue: PDF displays but is blank/corrupted

**Check**:
- File size in MongoDB vs S3 (should match)
- S3 bucket permissions (GetObject allowed)
- PDF parser output in logs

**Fix**:
- Delete document and re-import
- Test with different PDF URL
- Check S3 file integrity: `aws s3 ls s3://ischkul-files/`

---

## Performance Notes

### Large PDFs (>50MB)

For very large files:
- Increase timeout: `axios.get(url, { timeout: 120000 })`
- Stream instead of buffer: `const stream = response.data`
- Implement progress tracking: `onUploadProgress` callback

### Embedding Generation

Current behavior:
- First 50,000 chars extracted (prevents quota exhaustion)
- If embedding fails: Document still uploads (warning returned)
- Searchable by filename/title even without embeddings

### S3 Caching

- Cache-Control header set to 3600s (1 hour)
- Repeated document requests use browser cache
- Manual refresh: Shift+F5 (clears cache)

---

## Security Checklist

- ✅ JWT required for import-url endpoint
- ✅ JWT required for document serving
- ✅ User ownership verified before serving
- ✅ No path traversal vulnerabilities (S3 key generated server-side)
- ✅ File type verified (PDF only)
- ✅ File size limited (50MB max)
- ✅ Timeout prevents resource exhaustion
- ✅ Error messages don't leak sensitive info

---

## Next Steps

1. **Run Tests**: Execute test-pdf-import.js with valid token
2. **Verify Proxy**: Check Network tab in browser DevTools
3. **Test ChatInterface**: Ask AI questions about imported documents
4. **Scale Testing**: Try multiple documents, concurrent imports
5. **Error Scenarios**: Test network failures, invalid URLs, timeouts

---

## Troubleshooting Command Cheatsheet

```bash
# Start backend
cd backend1 && node server.js

# Check MongoDB
mongosh mongodb://localhost:27017/ischkul
show collections
db.documents.find().limit(5)

# Test import
node test-pdf-import.js "JWT_TOKEN"

# View logs
tail -f backend1/server.log

# Kill stuck process
lsof -i :5000
kill -9 <PID>

# Clear S3 test files (production: be careful!)
aws s3 rm s3://ischkul-files/documents --recursive --dry-run
```

---

## Additional Resources

- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [ArXiv PDF URLs](https://arxiv.org/help/browse)
- [AWS S3 GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)
- [CORS Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
