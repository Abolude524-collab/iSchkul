const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// Lazy load optional dependencies
async function loadPPTXParser() {
  try {
    return require('jszip');
  } catch (e) {
    console.warn('[flashcardGen] jszip not installed. Install with: npm install jszip xml2js');
    return null;
  }
}

async function loadXMLParser() {
  try {
    return require('xml2js');
  } catch (e) {
    console.warn('[flashcardGen] xml2js not installed. Install with: npm install xml2js');
    return null;
  }
}

async function loadOCR() {
  try {
    return require('tesseract.js');
  } catch (e) {
    console.warn('[flashcardGen] tesseract.js not installed. Install with: npm install tesseract.js --save-optional');
    return null;
  }
}

// Extract text from PPTX files using jszip
async function extractTextFromPPTX(buffer) {
  const JSZip = await loadPPTXParser();
  const { parseString } = await loadXMLParser();
  
  if (!JSZip || !parseString) {
    throw new Error('PPTX support requires: npm install jszip xml2js');
  }

  try {
    console.log('[flashcardGen] Loading PPTX with jszip...');
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    
    let allText = [];
    
    // Get all slide files from ppt/slides/ directory
    const slideFiles = [];
    zip.folder('ppt/slides')?.forEach((relativePath, file) => {
      if (relativePath.endsWith('.xml') && !relativePath.includes('_rels')) {
        slideFiles.push({ path: relativePath, file });
      }
    });
    
    console.log(`[flashcardGen] Found ${slideFiles.length} slides`);
    
    // Sort slides by number to maintain order
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.path.match(/\d+/) || [0]);
      const numB = parseInt(b.path.match(/\d+/) || [0]);
      return numA - numB;
    });
    
    // Extract text from each slide
    for (const { path, file } of slideFiles) {
      try {
        const xmlContent = await file.async('string');
        const slideText = extractTextFromXML(xmlContent);
        if (slideText.trim()) {
          allText.push(slideText);
        }
      } catch (slideErr) {
        console.warn(`[flashcardGen] Error parsing slide ${path}:`, slideErr.message);
      }
    }
    
    const result = allText.join('\n').trim();
    console.log('[flashcardGen] Extracted PPTX text length:', result.length);
    
    if (!result) {
      console.warn('[flashcardGen] PPTX extraction returned empty text');
      return '';
    }
    
    return result;
  } catch (err) {
    console.error('[flashcardGen] PPTX extraction error:', err.message);
    console.error('[flashcardGen] Error stack:', err.stack);
    throw new Error('Failed to extract text from PPTX: ' + err.message);
  }
}

// Helper function to extract text from PPTX XML
function extractTextFromXML(xmlContent) {
  try {
    // Use regex to extract text content from XML
    // PowerPoint text is typically in <a:t> tags
    const textMatches = xmlContent.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    const texts = textMatches.map(match => match.replace(/<a:t>|<\/a:t>/g, ''));
    return texts.join(' ').trim();
  } catch (err) {
    console.warn('[flashcardGen] Error extracting XML text:', err.message);
    return '';
  }
}

// OCR text extraction for scanned documents
async function extractTextWithOCR(buffer, filename) {
  const Tesseract = await loadOCR();
  if (!Tesseract) {
    throw new Error('OCR support requires: npm install tesseract.js --save-optional');
  }

  try {
    const result = await Tesseract.recognize(buffer, ['eng', 'fra', 'deu', 'spa']);
    return result.data.text;
  } catch (err) {
    console.error('[flashcardGen] OCR error:', err.message);
    throw new Error('Failed to process document with OCR: ' + err.message);
  }
}

// Extract text from PDF or DOCX files (Buffer-based)
async function extractText(buffer, mimeType, filename = '') {
  console.log(`[flashcardGen] extractText called with mimeType: "${mimeType}", filename: "${filename}"`);
  
  // Normalize filename
  const lowerFilename = (filename || '').toLowerCase();
  const lowerMimeType = (mimeType || '').toLowerCase();
  
  // PDF detection
  if (lowerMimeType === 'application/pdf' || lowerFilename.endsWith('.pdf')) {
    console.log('[flashcardGen] Processing as PDF');
    const data = await pdf(buffer);
    let text = data.text;
    
    // Auto-detect scanned PDF (very short text = likely scanned)
    if (text.trim().length < 100) {
      try {
        console.log('[flashcardGen] Detected scanned PDF, applying OCR');
        text = await extractTextWithOCR(buffer, filename);
      } catch (ocrErr) {
        console.warn('[flashcardGen] OCR failed, using PDF text:', ocrErr.message);
      }
    }
    return text;
  }
  
  // PPTX detection (multiple MIME type variations)
  if (lowerMimeType.includes('presentationml') || 
      lowerMimeType === 'application/vnd.ms-powerpoint' ||
      lowerMimeType === 'application/x-pptx' ||
      lowerFilename.endsWith('.pptx')) {
    console.log('[flashcardGen] Processing as PPTX');
    return await extractTextFromPPTX(buffer);
  }
  
  // PPT detection (old PowerPoint format)
  if (lowerMimeType === 'application/vnd.ms-powerpoint' ||
      lowerMimeType === 'application/x-ppt' ||
      lowerMimeType === 'application/mspowerpoint' ||
      lowerFilename.endsWith('.ppt')) {
    console.log('[flashcardGen] Processing as PPT (old format)');
    throw new Error('PPT (old PowerPoint format) not supported. Please convert to PPTX format. You can convert PPT to PPTX using: Microsoft PowerPoint, Google Slides, LibreOffice Impress, or online converters.');
  }
  
  // DOCX detection
  if (lowerMimeType.includes('wordprocessingml') || 
      lowerMimeType === 'application/msword' ||
      lowerMimeType === 'application/x-docx' ||
      lowerFilename.endsWith('.docx')) {
    console.log('[flashcardGen] Processing as DOCX');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  
  // TXT detection
  if (lowerMimeType === 'text/plain' || lowerFilename.endsWith('.txt')) {
    console.log('[flashcardGen] Processing as TXT');
    return buffer.toString('utf-8');
  }
  
  // Image detection
  if (lowerMimeType && lowerMimeType.startsWith('image/')) {
    console.log('[flashcardGen] Processing as image with OCR');
    try {
      return await extractTextWithOCR(buffer, filename);
    } catch (ocrErr) {
      throw new Error('Image OCR failed: ' + ocrErr.message);
    }
  }
  
  // Fallback: try to auto-detect by extension if no MIME type
  if (!mimeType && buffer instanceof Buffer) {
    if (lowerFilename.endsWith('.pptx')) {
      console.log('[flashcardGen] No MIME type, but detected .pptx extension, processing as PPTX');
      return await extractTextFromPPTX(buffer);
    }
    console.log('[flashcardGen] No MIME type, treating as text');
    return buffer.toString('utf-8');
  }
  
  // Unsupported format
  console.error(`[flashcardGen] Unsupported format - mimeType: "${mimeType}", filename: "${filename}"`);
  throw new Error(`Unsupported file format "${filename}" (${mimeType}). Supported: PDF, PPTX, DOCX, TXT, and images (with OCR if installed).`);
}

// Generates flashcards using Gemini AI
async function generateFlashcardsFromText(text, numCards = 10) {
  const prompt = `Extract key information from this text and create exactly ${numCards} academic flashcards.

Return ONLY a JSON array of objects with "question" and "answer" fields.
Do not include any other text, markdown formatting, or explanations.
Just the raw JSON array.

Example format:
[
  { "question": "What is the capital of France?", "answer": "Paris" },
  { "question": "What is 2+2?", "answer": "4" }
]

Text to analyze:
${text}`;

  let output = '';

  // Try Gemini first
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    output = response.text();

    if (output && output.trim()) {
      console.log('[flashcardGen] Gemini generation successful');
    }
  } catch (err) {
    console.warn('[flashcardGen] Gemini failed:', err.message);
    // Try OpenAI as fallback
    try {
      const { createChatCompletion } = require('./openaiClient');
      const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

      for (const model of models) {
        try {
          const resp = await createChatCompletion({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2000
          });
          output = resp?.choices?.[0]?.message?.content || '';
          if (output && output.trim()) {
            console.log(`[flashcardGen] OpenAI ${model} successful`);
            break;
          }
        } catch (modelErr) {
          console.warn(`[flashcardGen] OpenAI ${model} failed:`, modelErr.message);
        }
      }
    } catch (openaiErr) {
      console.warn('[flashcardGen] All AI models failed');
    }
  }

  // If no output, fall back to heuristic
  if (!output || !output.trim()) {
    return heuristicFallback(text, numCards);
  }

  // Parse flashcards from AI output
  try {
    // Try to find JSON in the output (in case AI included prose)
    const jsonMatch = output.match(/\[\s*\{.*\}\s*\]/s);
    const jsonString = jsonMatch ? jsonMatch[0] : output;
    const parsed = JSON.parse(jsonString);

    if (Array.isArray(parsed)) {
      console.log(`[flashcardGen] Parsed ${parsed.length} flashcards from JSON`);
      return parsed.slice(0, numCards).map(fc => ({
        question: fc.question || fc.front || fc.prompt || fc.q || '',
        answer: fc.answer || fc.back || fc.a || ''
      }));
    }
  } catch (parseErr) {
    console.warn('[flashcardGen] JSON parsing failed, trying structured text parsing', parseErr.message);
  }

  // Structured text parsing fallback
  const flashcards = [];
  const lines = output.split(/\r?\n/);
  let currentQuestion = '';
  let currentAnswer = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:') || trimmed.startsWith('Question:')) {
      if (currentQuestion && currentAnswer) {
        flashcards.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() });
      }
      currentQuestion = trimmed.replace(/^(Q:|Question:)\s*/i, '').trim();
      currentAnswer = '';
    } else if (trimmed.startsWith('A:') || trimmed.startsWith('Answer:')) {
      currentAnswer = trimmed.replace(/^(A:|Answer:)\s*/i, '').trim();
    } else if (currentAnswer && trimmed) {
      currentAnswer += ' ' + trimmed;
    } else if (currentQuestion && !currentAnswer && trimmed) {
      currentQuestion += ' ' + trimmed;
    }
  }

  if (currentQuestion && currentAnswer) {
    flashcards.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() });
  }

  if (flashcards.length > 0) {
    return flashcards.slice(0, numCards);
  }

  return heuristicFallback(text, numCards);
}

function heuristicFallback(text, numCards) {
  console.log('[flashcardGen] Using fallback heuristic generation');
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const naive = [];
  for (let i = 0; i < sentences.length && naive.length < numCards; i += 2) {
    const q = sentences[i] ? sentences[i].slice(0, 200) : null;
    const a = sentences[i + 1] ? sentences[i + 1].slice(0, 400) : 'See referenced text.';
    if (q) naive.push({ question: q, answer: a });
  }
  return naive;
}

module.exports = {
  extractText,
  generateFlashcardsFromText,
};