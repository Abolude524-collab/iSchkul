# Flashcard Generation Implementation Status

## ✅ Completed Features

### 1. Gemini AI Integration
- **File**: `utils/flashcardGen.js`
- **Model**: Gemini 2.0-flash-exp (primary), OpenAI GPT-4o-mini (fallback)
- **Structured Output**: Uses "Q:" and "A:" format for reliable parsing
- **Fallback**: Heuristic sentence-based generation if AI fails

### 2. File Upload Support
- **Formats**: PDF, DOCX, TXT
- **Function**: `extractText()` in flashcardGen.js
- **Libraries**: 
  - `pdf-parse` for PDF extraction
  - `mammoth` for DOCX extraction
  - UTF-8 decoding for plain text

### 3. Generation Endpoint
- **Route**: `POST /api/flashcards/generate`
- **Authentication**: JWT required
- **Input Options**:
  - File upload (PDF/DOCX/TXT)
  - Direct text paste
  - Number of cards (default: 10)
- **Response**: Array of flashcard objects with `front` and `back` fields

### 4. PDF Export (Full Set)
- **Route**: `GET /api/flashcards/:setId/export/pdf`
- **Authentication**: JWT required
- **Features**:
  - Title page with set name and date
  - Each card on separate page
  - Copyright footer: "Powered by iSchkul 2026" on every page
  - Clean formatting with question/answer sections

### 5. Individual Card Download
- **Route**: `GET /api/flashcards/:setId/cards/:cardId/download`
- **Authentication**: JWT required
- **Format**: A6-sized PDF card
- **Features**:
  - Compact single-card layout
  - Q: and A: format
  - Copyright footer: "Powered by iSchkul 2026"

## Implementation Details

### Gemini AI Prompt Structure
```
Generate exactly ${numCards} flashcards from the following text.
Format: Each flashcard should be on a new line starting with "Q:" for question and "A:" for answer.

Example:
Q: What is the capital of France?
A: Paris

Text:
${text}
```

### Parsing Logic
1. **Primary Parser**: Looks for "Q:" and "A:" markers
   - Supports multi-line questions/answers
   - Trims and cleans text
2. **Fallback Parser**: Splits on " - " delimiter
3. **Heuristic Generator**: Sentence-based pairing if all AI methods fail

### File Processing Flow
```
File Upload → extractText() → generateFlashcardsFromText() → Store in DB
                ↓
    PDF/DOCX/TXT detection
                ↓
    Appropriate parser (pdf-parse/mammoth/utf8)
                ↓
    Clean text extraction
```

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/flashcards/generate` | POST | Generate flashcards from text/file | ✅ |
| `/api/flashcards/:setId/export/pdf` | GET | Export full set as PDF | ✅ |
| `/api/flashcards/:setId/cards/:cardId/download` | GET | Download single card | ✅ |

## Testing Steps

### 1. Test File Upload Generation
```bash
curl -X POST http://localhost:5000/api/flashcards/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-document.pdf" \
  -F "numCards=10"
```

### 2. Test Text Generation
```bash
curl -X POST http://localhost:5000/api/flashcards/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Photosynthesis is the process by which plants convert sunlight into energy. It occurs in chloroplasts and produces oxygen as a byproduct.",
    "numCards": 5
  }'
```

### 3. Test PDF Export
```bash
curl -X GET http://localhost:5000/api/flashcards/SET_ID/export/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output flashcards.pdf
```

### 4. Test Single Card Download
```bash
curl -X GET http://localhost:5000/api/flashcards/SET_ID/cards/CARD_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output card.pdf
```

## Dependencies Installed
- ✅ `@google/generative-ai`: ^0.21.0
- ✅ `pdfkit`: ^0.17.2
- ✅ `pdf-parse`: ^1.1.1
- ✅ `mammoth`: ^1.6.0
- ✅ `multer`: ^1.4.5-lts.1

## Environment Variables Required
```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_key_for_fallback
```

## Next Steps (Frontend Integration)

### 1. Update FlashcardPage.tsx
- Ensure `handleGenerate` function sends files correctly
- Display generated flashcards in UI
- Add export/download buttons

### 2. Add Export UI
```typescript
// Export all as PDF
const handleExportPDF = async (setId: string) => {
  const response = await fetch(`/api/flashcards/${setId}/export/pdf`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcards.pdf';
  a.click();
};

// Download single card
const handleDownloadCard = async (setId: string, cardId: string) => {
  const response = await fetch(`/api/flashcards/${setId}/cards/${cardId}/download`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `card-${cardId}.pdf`;
  a.click();
};
```

## Responsible AI Notes
- Text input limited to prevent abuse
- Copyright footer on all exports
- User authentication required for all endpoints
- Generated content logged for audit purposes

## Success Criteria
✅ Gemini AI generates flashcards from uploaded files  
✅ Supports PDF, DOCX, and TXT files  
✅ Falls back to OpenAI if Gemini unavailable  
✅ PDF export includes copyright footer  
✅ Individual card download available  
✅ Structured Q&A format for reliable parsing  

## Known Limitations
- PDF extraction quality depends on PDF structure (scanned PDFs may have poor OCR)
- DOCX must be in standard format (complex formatting may be lost)
- AI generation quality varies with input text clarity
- Maximum file size: 50MB (configured in multer)
- Generation may take 10-30 seconds depending on file size

## Troubleshooting

### Issue: "AI generation failed"
- Check `GEMINI_API_KEY` environment variable
- Verify Gemini API quota and rate limits
- Check logs for specific error messages

### Issue: "Failed to extract text from file"
- Ensure file is not corrupted
- Check file mimetype is recognized
- Verify pdf-parse/mammoth dependencies are installed

### Issue: "PDF export fails"
- Confirm pdfkit is installed: `npm list pdfkit`
- Check flashcard set exists and user has access
- Verify MongoDB connection is active

---

**Last Updated**: January 2026  
**Status**: Production Ready ✅
