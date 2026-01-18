const express = require('express');
const auth = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

// Optional dependencies - lazy loaded only when needed
let Tesseract;
let JSZip;

// Lazy load OCR
async function loadOCR() {
  if (!Tesseract) {
    try {
      Tesseract = require('tesseract.js');
    } catch (e) {
      console.warn('Warning: tesseract.js not installed. OCR features disabled.');
      Tesseract = null;
    }
  }
  return Tesseract;
}

// Lazy load JSZip for PPTX parsing
async function loadJSZip() {
  if (!JSZip) {
    try {
      JSZip = require('jszip');
    } catch (e) {
      console.warn('Warning: jszip not installed. PPTX support disabled. Install with: npm install jszip');
      JSZip = null;
    }
  }
  return JSZip;
}

const router = express.Router();

// Generate quiz
router.post('/quiz', auth, async (req, res) => {
  try {
    const {
      text,
      subject,
      difficulty = 'medium',
      file,
      numQuestions = 5,
      timeLimit = 1800 // default 30 minutes in seconds
    } = req.body;

    let contentText = text;

    // If file is provided, extract text from it
    if (file && file.data) {
      try {
        // Decode base64 to buffer
        const buffer = Buffer.from(file.data, 'base64');

        if (file.mimetype === 'application/pdf') {
          const data = await pdfParse(buffer);
          contentText = data.text;
          
          // If PDF appears to be scanned (very little text), use OCR if available
          if (contentText.trim().length < 100) {
            console.log('Detected scanned PDF, attempting OCR...');
            const Tesseract = await loadOCR();
            if (Tesseract) {
              const ocrResult = await extractTextWithOCR(buffer, file.filename);
              contentText = ocrResult;
            } else {
              console.warn('OCR not available, using pdf-parse result');
            }
          }
        } else if (file.mimetype === 'text/plain') {
          contentText = buffer.toString('utf8');
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
                   file.filename?.endsWith('.pptx')) {
          // PPTX file handling
          const ZipLib = await loadJSZip();
          if (ZipLib) {
            contentText = await extractTextFromPPTX(buffer);
          } else {
            return res.status(400).json({ 
              error: 'PPTX support not installed. Install with: npm install jszip' 
            });
          }
        } else if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || 
                   file.mimetype === 'image/jpg' || file.mimetype === 'image/webp') {
          // Image files - use OCR
          console.log('Processing image file with OCR...');
          const Tesseract = await loadOCR();
          if (Tesseract) {
            contentText = await extractTextWithOCR(buffer, file.filename);
          } else {
            return res.status(400).json({ 
              error: 'OCR support not installed. Install optional dependencies: npm install tesseract.js' 
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Unsupported file type. Supported types: PDF, PPTX, TXT, JPG, PNG, WEBP' 
          });
        }
      } catch (fileError) {
        console.error('File processing error:', fileError);
        return res.status(400).json({ error: 'Failed to process uploaded file: ' + fileError.message });
      }
    }

    if (!contentText) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    // Generate dynamic mock questions based on content
    const generateMockQuestions = (topic, contentText, numQuestions = 5, difficulty = 'medium') => {
      const questions = [];

      // Extract keywords and key phrases from content
      let keywords = [topic || 'this topic'];
      let keyPhrases = [];
      let sentences = [];

      if (contentText) {
        // Extract sentences and clean them
        sentences = contentText.split(/[.!?]+/).filter(s => s.trim().length > 20);

        // Extract potential important terms
        const words = contentText.toLowerCase().split(/\s+/).filter(word =>
          word.length > 3 &&
          !['that', 'with', 'from', 'this', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'their', 'there', 'these', 'those'].includes(word)
        );

        // Get most frequent words as keywords
        const wordFreq = {};
        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        keywords = Object.keys(wordFreq)
          .sort((a, b) => wordFreq[b] - wordFreq[a])
          .slice(0, 12);

        // Extract key phrases
        keyPhrases = sentences.slice(0, Math.min(sentences.length, numQuestions * 2))
          .map(s => s.trim().substring(0, 80));
      }

      // Fallback keywords if none extracted
      if (keywords.length === 0) {
        keywords = [topic || 'this concept'];
      }

      // Content-aware question templates adapted to difficulty
      const easyTemplates = [
        {
          text: `What is ${keywords[0] || topic || 'this concept'}?`,
          options: [
            keyPhrases[0] || 'A fundamental concept',
            keyPhrases[1] || 'A related idea',
            'Something else entirely',
            'None of the above'
          ],
          correctAnswer: 0,
          explanation: `The text defines ${keywords[0] || 'this'} as: ${keyPhrases[0] || 'a key concept'}`
        },
        {
          text: `According to the content, what is mentioned about ${keywords[1] || topic}?`,
          options: [
            keyPhrases[2] || 'It is important',
            'It is irrelevant',
            'It is outdated',
            'It is controversial'
          ],
          correctAnswer: 0,
          explanation: 'This information is directly stated in the provided text.'
        }
      ];

      const mediumTemplates = [
        {
          text: `How does the content describe the relationship between ${keywords[0] || topic} and ${keywords[1] || 'related concepts'}?`,
          options: [
            'They are interconnected',
            'They are completely separate',
            'They oppose each other',
            'No relationship exists'
          ],
          correctAnswer: 0,
          explanation: 'The text indicates these concepts are related and build upon each other.'
        },
        {
          text: `What approach does the material suggest for ${keywords[0] || topic}?`,
          options: [
            'Systematic understanding',
            'Memorization only',
            'Ignoring details',
            'Random application'
          ],
          correctAnswer: 0,
          explanation: 'The content emphasizes the importance of systematic understanding.'
        }
      ];

      const hardTemplates = [
        {
          text: `Analyze the implications of ${keywords[0] || topic} in the context presented. What conclusion is most supported?`,
          options: [
            'It requires critical evaluation and synthesis',
            'It is straightforward to implement',
            'It has no practical application',
            'It contradicts established principles'
          ],
          correctAnswer: 0,
          explanation: 'The text suggests complex relationships requiring analytical thinking.'
        },
        {
          text: `Evaluate how ${keywords[0] || topic} relates to ${keywords[1] || 'broader concepts'}. Which interpretation is most accurate?`,
          options: [
            'They form an integrated framework',
            'They are loosely connected',
            'They are mutually exclusive',
            'They serve different purposes'
          ],
          correctAnswer: 0,
          explanation: 'The material demonstrates integration between these concepts.'
        }
      ];

      const veryHardTemplates = [
        {
          text: `Synthesize the advanced concepts discussed regarding ${keywords[0] || topic}. Which theoretical framework best explains the relationships?`,
          options: [
            'A multidimensional integrative model',
            'A simple cause-effect relationship',
            'An isolated phenomenon',
            'A contradictory set of principles'
          ],
          correctAnswer: 0,
          explanation: 'Advanced analysis reveals complex, interconnected relationships requiring sophisticated understanding.'
        }
      ];

      // Select templates based on difficulty
      let templates = [];
      if (difficulty === 'easy') {
        templates = [...easyTemplates];
      } else if (difficulty === 'medium') {
        templates = [...easyTemplates, ...mediumTemplates];
      } else if (difficulty === 'hard') {
        templates = [...mediumTemplates, ...hardTemplates];
      } else {
        templates = [...hardTemplates, ...veryHardTemplates];
      }

      // Add content-specific questions from actual sentences
      if (sentences.length >= numQuestions) {
        for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
          const sentence = sentences[i].trim();
          if (sentence.length > 30) {
            templates.push({
              text: `Based on the text, which statement is accurate about the content?`,
              options: [
                sentence.substring(0, 100),
                sentences[(i + 1) % sentences.length]?.substring(0, 100) || 'Alternative statement',
                sentences[(i + 2) % sentences.length]?.substring(0, 100) || 'Different concept',
                'None of these are mentioned'
              ],
              correctAnswer: 0,
              explanation: `This is directly stated in the source material: "${sentence.substring(0, 150)}..."`
            });
          }
        }
      }

      // Shuffle and select questions
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, numQuestions).map((q, index) => ({
        ...q,
        id: (index + 1).toString()
      }));
    };

    // Mock quiz generation - in production, use OpenAI API
    const mockQuiz = {
      // Note: _id will be generated by MongoDB after saving, do NOT set it here
      title: contentText ? `${subject || 'Content-Based'} Quiz` : `${subject || 'General'} Quiz`,
      description: contentText ? `Quiz generated from provided content` : `General knowledge quiz`,
      difficulty: difficulty,
      timeLimit: timeLimit,
      topics: contentText ? [subject || 'Content Analysis'] : [subject || 'General'],
      questions: generateMockQuestions(subject || (contentText ? 'provided content' : 'general knowledge'), contentText, parseInt(numQuestions) || 5, difficulty),
      createdAt: new Date().toISOString(),
      createdBy: req.user._id,
      isAIGenerated: false,
      isPublic: true,
      generationNote: contentText ? 'Content-based questions (AI unavailable)' : 'General knowledge questions'
    };

    // If OpenAI API key is available, use it
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      try {
        console.log('OpenAI API key found, length:', process.env.OPENAI_API_KEY.length);
        console.log('Attempting AI quiz generation for content length:', contentText.length);

        // Prepare a more detailed prompt for better AI generation
        const prompt = `Generate a quiz with ${numQuestions || 5} multiple-choice questions based on this text. Each question must have exactly 4 options (A, B, C, D) and be directly relevant to the content.

Text content: ${contentText.substring(0, 3000)}

Requirements:
- Questions should test understanding of key concepts from the text
- Each question must have exactly 4 answer options
- Include a brief explanation for each correct answer
- Make questions specific to the content provided
- Difficulty level: ${difficulty}

Return ONLY valid JSON in this exact format with no additional text:
{
  "questions": [
    {
      "text": "Specific question about the content?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct based on the content"
    }
  ]
}`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 4000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        });

        console.log('OpenAI API response status:', response.status);
        const aiResponse = response.data.choices[0].message.content.trim();
        console.log('Raw AI Response length:', aiResponse.length);

        // Try to extract JSON from the response
        let jsonStart = aiResponse.indexOf('{');
        let jsonEnd = aiResponse.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
          console.log('No JSON brackets found in response');
          throw new Error('No JSON found in AI response');
        }

        const jsonString = aiResponse.substring(jsonStart, jsonEnd);
        console.log('Extracted JSON string length:', jsonString.length);

        const generatedContent = JSON.parse(jsonString);
        console.log('Parsed JSON successfully');

        if (generatedContent.questions && Array.isArray(generatedContent.questions)) {
          console.log('Found questions array with length:', generatedContent.questions.length);

          // Validate the structure and content relevance
          const validQuestions = generatedContent.questions.filter(q => {
            // Check for either 'text' or 'question' field for backward compatibility
            const questionText = q.text || q.question;
            return questionText &&
              questionText.length > 10 &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              typeof q.correctAnswer === 'number' &&
              q.correctAnswer >= 0 && q.correctAnswer < 4 &&
              q.explanation &&
              q.explanation.length > 10;
          });

          console.log('Valid questions found:', validQuestions.length);

          if (validQuestions.length >= Math.min(3, parseInt(numQuestions) || 5)) {
            // Normalize to use 'text' field
            mockQuiz.questions = validQuestions.slice(0, parseInt(numQuestions) || 5).map(q => ({
              text: q.text || q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation
            }));
            mockQuiz.isAIGenerated = true;
            mockQuiz.difficulty = difficulty;
            mockQuiz.timeLimit = timeLimit;
            mockQuiz.generationNote = 'AI-generated questions based on provided content';
            console.log(`Successfully generated ${mockQuiz.questions.length} AI questions`);
          } else {
            console.log('Not enough valid questions from AI, using enhanced mock questions');
            throw new Error('AI generated insufficient valid questions');
          }
        } else {
          throw new Error('AI response missing questions array');
        }
      } catch (aiError) {
        console.log('OpenAI generation failed:', aiError.message);
        if (aiError.response) {
          console.log('OpenAI API error response:', aiError.response.status, aiError.response.data);
        } else if (aiError.code === 'ECONNABORTED') {
          console.log('OpenAI API request timed out');
        }

        // Try Gemini as fallback
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
          try {
            console.log('Attempting Gemini AI fallback...');
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const geminiPrompt = `Generate a quiz with ${numQuestions || 5} multiple-choice questions based on this text. Each question must have exactly 4 options and be directly relevant to the content.

Text content: ${contentText.substring(0, 4000)}

Requirements:
- Questions should test understanding of key concepts from the text
- Each question must have exactly 4 answer options
- Include a brief explanation for each correct answer
- Make questions specific to the content provided
- Difficulty level: ${difficulty}

Return ONLY valid JSON in this exact format with no additional text:
{
  "questions": [
    {
      "text": "Specific question about the content?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this answer is correct based on the content"
    }
  ]
}`;

            const result = await model.generateContent(geminiPrompt);
            const response = await result.response;
            let geminiText = response.text();

            console.log('Gemini response received, length:', geminiText.length);
            console.log('Gemini raw response (first 500 chars):', geminiText.substring(0, 500));

            // Clean up markdown if present
            geminiText = geminiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            // Extract JSON
            let jsonStart = geminiText.indexOf('{');
            let jsonEnd = geminiText.lastIndexOf('}') + 1;

            if (jsonStart !== -1 && jsonEnd > 0) {
              const jsonString = geminiText.substring(jsonStart, jsonEnd);
              console.log('Extracted JSON string (first 300 chars):', jsonString.substring(0, 300));

              const geminiContent = JSON.parse(jsonString);
              console.log('Parsed Gemini content, has questions array:', !!geminiContent.questions);

              if (geminiContent.questions && Array.isArray(geminiContent.questions)) {
                console.log('Number of questions in response:', geminiContent.questions.length);
                console.log('First question sample:', JSON.stringify(geminiContent.questions[0], null, 2));

                const validQuestions = geminiContent.questions.filter(q => {
                  // Check for either 'text' or 'question' field for backward compatibility
                  const questionText = q.text || q.question;
                  return questionText &&
                    questionText.length > 10 &&
                    Array.isArray(q.options) &&
                    q.options.length === 4 &&
                    typeof q.correctAnswer === 'number' &&
                    q.correctAnswer >= 0 && q.correctAnswer < 4 &&
                    q.explanation &&
                    q.explanation.length > 10;
                });

                console.log('Valid questions after filtering:', validQuestions.length);

                if (validQuestions.length >= Math.min(3, parseInt(numQuestions) || 5)) {
                  // Normalize to use 'text' field
                  mockQuiz.questions = validQuestions.slice(0, parseInt(numQuestions) || 5).map(q => ({
                    text: q.text || q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation
                  }));
                  mockQuiz.isAIGenerated = true;
                  mockQuiz.difficulty = difficulty;
                  mockQuiz.timeLimit = timeLimit;
                  mockQuiz.generationNote = 'Gemini AI-generated questions';
                  console.log(`Successfully generated ${mockQuiz.questions.length} Gemini questions`);
                  // Continue to database save at the end - do NOT return early
                } else {
                  console.log(`Not enough valid questions. Need at least ${Math.min(3, parseInt(numQuestions) || 5)}, got ${validQuestions.length}`);
                }
              }
            }

            console.log('Gemini response did not contain valid questions, using fallback');
          } catch (geminiError) {
            console.log('Gemini fallback also failed:', geminiError.message);
          }
        } else {
          console.log('No Gemini API key configured');
        }

        console.log('Using content-based fallback questions');

        // Enhance mock quiz with content analysis
        if (contentText) {
          // Use subject name for title instead of content excerpt
          mockQuiz.title = `${subject || 'Content-Based'} Quiz`;
          mockQuiz.description = `Quiz generated from provided content (${contentText.length} characters)`;

          // Extract simple keywords from content to use as topics
          const stopwords = new Set([
            'that', 'with', 'from', 'this', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should',
            'their', 'there', 'these', 'those', 'into', 'about', 'after', 'before', 'because', 'while', 'where',
            'which', 'when', 'what', 'your', 'ours', 'mine', 'them', 'then', 'than', 'also', 'such', 'many', 'much'
          ]);
          const words = (contentText.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stopwords.has(w));
          const freq = {};
          for (const w of words) freq[w] = (freq[w] || 0) + 1;
          const topKeywords = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 3);
          mockQuiz.topics = topKeywords.length > 0 ? topKeywords : [subject || 'Content Analysis'];
        }
      }
    } else {
      console.log('No OpenAI API key configured, using enhanced mock data');
    }

    // Generate unique title if content based
    const finalTitle = mockQuiz.title || (contentText ? `${subject || 'Content-Based'} Quiz` : `${subject || 'General'} Quiz`);
    const finalDescription = mockQuiz.description || (contentText ? `Quiz generated from provided content` : `General knowledge quiz`);

    // ALWAYS SAVE TO DATABASE - This ensures quiz has a valid MongoDB ObjectId
    try {
      // 1. Create Question documents
      const questionDocs = await Question.insertMany(
        mockQuiz.questions.map(q => ({
          text: q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
        }))
      );

      // 2. Create Quiz document with ACTUAL subject from request
      const quiz = new Quiz({
        title: finalTitle,
        subject: subject && subject.trim() ? subject : 'General',
        description: finalDescription,
        questions: questionDocs.map(q => q._id),
        timeLimit: timeLimit || 1800,
        difficulty: difficulty || 'medium',
        isPublic: true,
        createdBy: req.user._id,
      });

      await quiz.save();
      await quiz.populate('questions');

      console.log('=== QUIZ GENERATION & SAVE COMPLETE ===');
      console.log('Quiz ID:', quiz._id);
      console.log('Quiz title:', quiz.title);
      console.log('Quiz subject:', quiz.subject);
      console.log('Number of questions:', quiz.questions.length);
      console.log('AI Generated:', mockQuiz.isAIGenerated);
      console.log('================================');

      return res.json({ quiz });
    } catch (saveError) {
      console.error('Failed to save generated quiz:', saveError);
      res.status(500).json({ error: 'Failed to save quiz to database: ' + saveError.message });
    }
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate flashcards
router.post('/flashcards', auth, async (req, res) => {
  try {
    const { text, subject } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    // Mock flashcard generation
    const mockFlashcards = {
      _id: Date.now().toString(),
      title: `${subject || 'General'} Flashcards`,
      cards: [
        {
          id: '1',
          front: 'What is photosynthesis?',
          back: 'The process by which plants convert sunlight, carbon dioxide, and water into glucose and oxygen.'
        },
        {
          id: '2',
          front: 'What is the powerhouse of the cell?',
          back: 'Mitochondria'
        }
      ],
      createdAt: new Date().toISOString(),
      createdBy: req.user._id
    };

    res.json({ flashcards: mockFlashcards });
  } catch (error) {
    console.error('Flashcard generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== Helper Functions ====================

/**
 * Extract text from PPTX file using jszip
 * @param {Buffer} buffer - PPTX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPPTX(buffer) {
  try {
    const ZipLib = await loadJSZip();
    if (!ZipLib) {
      throw new Error('PPTX support requires: npm install jszip');
    }
    
    console.log('[generate] Loading PPTX with jszip...');
    const zip = new ZipLib();
    await zip.loadAsync(buffer);
    
    let allText = [];
    
    // Get all slide files from ppt/slides/ directory
    const slideFiles = [];
    zip.folder('ppt/slides')?.forEach((relativePath, file) => {
      if (relativePath.endsWith('.xml') && !relativePath.includes('_rels')) {
        slideFiles.push({ path: relativePath, file });
      }
    });
    
    console.log(`[generate] Found ${slideFiles.length} slides`);
    
    // Sort slides by number to maintain order
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.path.match(/\d+/) || [0]);
      const numB = parseInt(b.path.match(/\d+/) || [0]);
      return numA - numB;
    });
    
    // Extract text from each slide
    for (const { path: slidePath, file } of slideFiles) {
      try {
        const xmlContent = await file.async('string');
        const slideText = extractTextFromXML(xmlContent);
        if (slideText.trim()) {
          allText.push(slideText);
        }
      } catch (slideErr) {
        console.warn(`[generate] Error parsing slide ${slidePath}:`, slideErr.message);
      }
    }
    
    const result = allText.join('\n').trim();
    console.log(`[generate] Extracted ${result.length} characters from PPTX`);
    return result || 'No text found in presentation';
  } catch (error) {
    console.error('[generate] PPTX extraction error:', error);
    throw new Error('Failed to extract text from PPTX: ' + error.message);
  }
}

/**
 * Extract text from PPTX XML content
 * @param {string} xmlContent - XML content from a slide
 * @returns {string} Extracted text
 */
function extractTextFromXML(xmlContent) {
  try {
    // Use regex to extract text content from XML
    // PowerPoint text is typically in <a:t> tags
    const textMatches = xmlContent.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    const texts = textMatches.map(match => match.replace(/<a:t>|<\/a:t>/g, ''));
    return texts.join(' ').trim();
  } catch (err) {
    console.warn('[generate] Error extracting XML text:', err.message);
    return '';
  }
}

/**
 * Extract text from image or scanned PDF using OCR
 * @param {Buffer} buffer - File buffer (image or PDF)
 * @param {string} filename - Original filename
 * @returns {Promise<string>} Extracted text
 */
async function extractTextWithOCR(buffer, filename) {
  try {
    const Tesseract = await loadOCR();
    if (!Tesseract) {
      throw new Error('OCR (Tesseract.js) not available. Install with: npm install tesseract.js');
    }
    
    console.log(`Starting OCR process for: ${filename}`);
    
    // Save buffer to temporary file for OCR
    const tempDir = path.join(__dirname, '..', 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const imagePath = path.join(tempDir, `ocr_${Date.now()}.png`);
    fs.writeFileSync(imagePath, buffer);
    
    // Run Tesseract OCR
    console.log('Running Tesseract OCR...');
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      ['eng', 'fra', 'deu', 'spa'], // Support multiple languages
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${(m.progress * 100).toFixed(2)}%`);
          }
        }
      }
    );
    
    // Clean up temporary file
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    console.log(`OCR completed. Extracted ${text.length} characters`);
    return text || 'No text could be extracted from image';
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract text using OCR: ' + error.message);
  }
}

/**
 * Validate file type for upload
 * @param {string} mimetype - File MIME type
 * @param {string} filename - File name
 * @returns {boolean} Whether file type is supported
 */
function isValidFileType(mimetype, filename) {
  const supportedTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
  ];
  
  const supportedExtensions = ['.pdf', '.txt', '.pptx', '.png', '.jpg', '.jpeg', '.webp'];
  
  const ext = path.extname(filename).toLowerCase();
  return supportedTypes.includes(mimetype) || supportedExtensions.includes(ext);
}

module.exports = router;