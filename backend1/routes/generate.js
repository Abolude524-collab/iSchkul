const express = require('express');
const auth = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const { createQuestionBatch } = require('../utils/questionGenerator');
const { filterContentForQuizGeneration, isBoilerplateSection } = require('../utils/contentFilter');

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

// Educator role mapping based on student category
const educatorRoleMap = {
  'Secondary School Student': 'a patient and engaging secondary school teacher who explains concepts in simple terms suitable for teenagers',
  'University Student': 'a university lecturer or professor who asks questions testing conceptual understanding and real-world application',
  'Postgraduate Student': 'an advanced academic professor designing highly analytical and research-oriented questions',
  'Vocational/Technical Student': 'a practical technical instructor focusing on applied skills and hands-on knowledge',
  'Other': 'a versatile educator adapting to the learner\'s level'
};

// Helper function to determine educator role based on student category
function getEducatorRole(studentCategory) {
  if (educatorRoleMap[studentCategory]) {
    return educatorRoleMap[studentCategory];
  }
  const fallbackMap = {
    'Undergraduate': educatorRoleMap['University Student'],
    'Postgraduate': educatorRoleMap['Postgraduate Student'],
    'High School': educatorRoleMap['Secondary School Student'],
    'Secondary': educatorRoleMap['Secondary School Student'],
    'Primary': 'a friendly elementary school teacher who uses simple language and encouraging tone',
    'Professional': 'a professional industry certifier'
  };
  return fallbackMap[studentCategory] || educatorRoleMap['Other'];
}


// Difficulty level definitions and guidelines
const difficultyGuidelines = {
  'easy': {
    label: 'Easy',
    description: 'Focus on basic recall and fundamental understanding',
    guidelines: 'Questions should test vocabulary, basic definitions, and straightforward facts. Use simple language and direct concepts from the material.',
    bloomLevel: 'Remember/Understand'
  },
  'medium': {
    label: 'Medium',
    description: 'Balance between recall and application of concepts',
    guidelines: 'Questions should require students to apply knowledge, make comparisons, and show understanding of relationships between concepts.',
    bloomLevel: 'Apply/Analyze'
  },
  'hard': {
    label: 'Hard',
    description: 'Emphasize analysis and synthesis of complex concepts',
    guidelines: 'Questions should require deep understanding, critical thinking, and the ability to connect multiple concepts or analyze scenarios.',
    bloomLevel: 'Analyze/Evaluate'
  },
  'veryhard': {
    label: 'Very Hard',
    description: 'Maximum cognitive challenge requiring expert-level thinking',
    guidelines: 'Questions should demand synthesis, evaluation, and creation of new insights. Include edge cases, exceptions, and complex scenarios.',
    bloomLevel: 'Evaluate/Create'
  }
};

// Helper function to build prompt with subject-specific requirements
function buildQuizPrompt(numQuestions, difficulty, contentText, subject, studentCategory, educatorRole) {
  const diffGuideline = difficultyGuidelines[difficulty] || difficultyGuidelines['medium'];

  // Special handling for math/calculation subjects
  const isMathSubject = subject && /math|calculation|algebra|geometry|trigonometry|calculus|statistics|physics|chemistry/i.test(subject);

  let subjectSpecificInstructions = '';
  if (isMathSubject) {
    subjectSpecificInstructions = `
SPECIAL INSTRUCTIONS FOR ${subject.toUpperCase()}:
- For mathematical questions, include numerical calculations or numerical answers
- Show the working/steps in the explanation
- Provide options with common calculation errors as distractors
- Include both theoretical and computational questions
- Ensure numerical accuracy in all answers and explanations`;
  }

  const prompt = `You are ${educatorRole}.

Generate ${numQuestions} high-quality questions based on the study material provided.
Provide a diverse mix of the following three question types:
1. mcq_single: Traditional multiple-choice with ONE correct answer.
2. mcq_multiple: Multiple-choice where MORE THAN ONE answer can be correct (provide correctAnswers as an array of indices).
3. true_false: A statement that is either True or False.

DIFFICULTY LEVEL: ${diffGuideline.label.toUpperCase()}
Description: ${diffGuideline.description}
Bloom's Level: ${diffGuideline.bloomLevel}
Guidelines: ${diffGuideline.guidelines}

TEXT SOURCE (Study Material):
${contentText.substring(0, 3000)}

REQUIREMENTS:
- For mcq_single and mcq_multiple, provide exactly 4 options.
- For true_false, do NOT provide an options array.
- Questions should be directly relevant to the provided content.
- Include a clear explanation for each correct answer that references the source material.
- Difficulty should match the specified level.

Return ONLY valid JSON in this exact format with no additional text or markdown:
{
  "questions": [
    {
      "type": "mcq_single",
      "text": "Question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0,
      "explanation": "Explanation here"
    },
    {
      "type": "mcq_multiple",
      "text": "Which of these apply?",
      "options": ["Applies", "Does not", "Applies too", "Does not"],
      "correctAnswers": [0, 2],
      "explanation": "Explanation here"
    },
    {
      "type": "true_false",
      "text": "The earth is flat.",
      "correctAnswerBoolean": false,
      "explanation": "Explanation here"
    }
  ]
}`;

  return prompt;
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

    // Apply content filter to remove boilerplate sections before AI processing
    if (contentText && contentText.length > 500) {
      try {
        const filterResult = filterContentForQuizGeneration(contentText);
        contentText = filterResult.extracted;

        if (filterResult.removed_sections && filterResult.removed_sections.length > 0) {
          console.log('📌 Boilerplate sections removed:', filterResult.removed_sections.join(', '));
          console.log(`📌 Content filtered: ${filterResult.original_length || 'unknown'} → ${contentText.length} chars`);
        }
      } catch (filterError) {
        console.warn('⚠️ Content filtering error (using original):', filterError.message);
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
          type: 'mcq_single',
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
          type: 'true_false',
          text: `The material primarily focuses on ${keywords[0] || topic}.`,
          correctAnswerBoolean: true,
          explanation: `The core subject of the source material is indeed ${keywords[0] || topic}.`
        }
      ];

      const mediumTemplates = [
        {
          type: 'mcq_multiple',
          text: `Which of the following are mentioned in relation to ${keywords[0] || topic}?`,
          options: [
            keyPhrases[0] || 'Key concept A',
            'An unrelated distraction',
            keyPhrases[1] || 'Key concept B',
            'A random irrelevant term'
          ],
          correctAnswers: [0, 2],
          explanation: 'The text specifically mentions both concepts as relevant factors.'
        },
        {
          type: 'mcq_single',
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
          type: 'true_false',
          text: `Based on the content, ${keywords[0] || topic} can be implemented without any prior knowledge.`,
          correctAnswerBoolean: false,
          explanation: 'The complexity described in the material indicates that prerequisite knowledge is required.'
        },
        {
          type: 'mcq_single',
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
          type: 'mcq_single',
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
            // Randomly pick a question type for the sentence-based question
            const typeValue = Math.random();

            if (typeValue < 0.2) { // 20% True/False
              templates.push({
                type: 'true_false',
                text: `According to the text, is the following statement true: "${sentence.substring(0, 100)}..."?`,
                correctAnswerBoolean: true,
                explanation: `This is directly stated in the material: "${sentence.substring(0, 150)}..."`
              });
            } else if (typeValue < 0.4) { // 20% Multiple Choice (Multiple Answers)
              templates.push({
                type: 'mcq_multiple',
                text: `Which of these statements accurately reflects the material's discussion of "${sentence.substring(0, 40)}..."?`,
                options: [
                  sentence.substring(0, 100),
                  sentences[(i + 1) % sentences.length]?.substring(0, 100) || 'Alternative concept',
                  sentence.substring(0, 80) + ' (confirmed)',
                  'This is not mentioned in the text'
                ],
                correctAnswers: [0, 2],
                explanation: `The material explicitly states: "${sentence.substring(0, 150)}..."`
              });
            } else { // 60% standard MCQ
              templates.push({
                type: 'mcq_single',
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

    // AI Generation Logic
    let studentCategory = 'Other';
    try {
      const user = await User.findById(req.user._id);
      if (user && user.studentCategory) {
        studentCategory = user.studentCategory;
        console.log('Retrieved student category:', studentCategory);
      }
    } catch (userError) {
      console.warn('Could not fetch student category, using default:', userError.message);
    }

    let aiGenerated = false;

    // Try OpenAI first if available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      try {
        console.log('OpenAI API key found, attempting generation...');
        console.log('Attempting AI quiz generation for content length:', contentText.length);

        // Get educator role based on student category
        const educatorRole = getEducatorRole(studentCategory);

        // Build enhanced prompt with subject-specific guidelines
        const prompt = buildQuizPrompt(
          numQuestions || 5,
          difficulty,
          contentText,
          subject,
          studentCategory,
          educatorRole
        );

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `You are an expert educational assessment designer. Generate high-quality multiple-choice questions tailored to ${studentCategory} level.`
          }, {
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

        const aiResponse = response.data.choices[0].message.content.trim();
        let jsonStart = aiResponse.indexOf('{');
        let jsonEnd = aiResponse.lastIndexOf('}') + 1;

        if (jsonStart !== -1 && jsonEnd > 0) {
          const jsonString = aiResponse.substring(jsonStart, jsonEnd);
          const generatedContent = JSON.parse(jsonString);

          if (generatedContent.questions && Array.isArray(generatedContent.questions)) {
            const validQuestions = generatedContent.questions.filter(q => {
              const type = q.type || 'mcq_single';
              if (type === 'mcq_single') return Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctAnswer === 'number';
              if (type === 'mcq_multiple') return Array.isArray(q.options) && q.options.length >= 2 && Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0;
              if (type === 'true_false') return typeof q.correctAnswerBoolean === 'boolean';
              return false;
            });

            if (validQuestions.length >= Math.min(3, parseInt(numQuestions) || 5)) {
              mockQuiz.questions = validQuestions.slice(0, parseInt(numQuestions) || 5).map(q => {
                const type = q.type || 'mcq_single';
                const base = { text: q.text || q.question, type, explanation: q.explanation || 'Refer to source.' };
                if (type === 'mcq_single') return { ...base, options: q.options, correctAnswer: q.correctAnswer };
                if (type === 'mcq_multiple') return { ...base, options: q.options, correctAnswers: q.correctAnswers };
                if (type === 'true_false') return { ...base, correctAnswerBoolean: q.correctAnswerBoolean };
                return base;
              });
              mockQuiz.isAIGenerated = true;
              mockQuiz.generationNote = 'OpenAI generated mixed questions';
              aiGenerated = true;
              console.log('Successfully generated questions with OpenAI');
            }
          }
        }
      } catch (err) {
        console.log('OpenAI generation failed:', err.message);
      }
    }

    // If OpenAI failed or wasn't available, try Gemini
    if (!aiGenerated && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      try {
        console.log('Attempting Gemini AI fallback/alternative...');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Updated to 2.5-flash for 2026 stable version

        const educatorRole = getEducatorRole(studentCategory);
        const prompt = buildQuizPrompt(numQuestions || 5, difficulty, contentText, subject, studentCategory, educatorRole);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let geminiText = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let jsonStart = geminiText.indexOf('{');
        let jsonEnd = geminiText.lastIndexOf('}') + 1;

        if (jsonStart !== -1 && jsonEnd > 0) {
          const geminiContent = JSON.parse(geminiText.substring(jsonStart, jsonEnd));
          if (geminiContent.questions && Array.isArray(geminiContent.questions)) {
            const validQuestions = geminiContent.questions.filter(q => {
              const type = q.type || 'mcq_single';
              if (type === 'mcq_single') return Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctAnswer === 'number';
              if (type === 'mcq_multiple') return Array.isArray(q.options) && q.options.length >= 2 && Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0;
              if (type === 'true_false') return typeof q.correctAnswerBoolean === 'boolean';
              return false;
            });

            if (validQuestions.length >= Math.min(3, parseInt(numQuestions) || 5)) {
              mockQuiz.questions = validQuestions.slice(0, parseInt(numQuestions) || 5).map(q => {
                const type = q.type || 'mcq_single';
                const base = { text: q.text || q.question, type, explanation: q.explanation || 'Refer to source.' };
                if (type === 'mcq_single') return { ...base, options: q.options, correctAnswer: q.correctAnswer };
                if (type === 'mcq_multiple') return { ...base, options: q.options, correctAnswers: q.correctAnswers };
                if (type === 'true_false') return { ...base, correctAnswerBoolean: q.correctAnswerBoolean };
                return base;
              });
              mockQuiz.isAIGenerated = true;
              mockQuiz.generationNote = 'Gemini AI generated mixed questions';
              aiGenerated = true;
              console.log('Successfully generated questions with Gemini');
            }
          }
        }
      } catch (err) {
        console.log('Gemini generation failed:', err.message);
      }
    }

    // Final fallback to content-aware mock questions if all AI failed
    if (!aiGenerated) {
      console.log('All AI generation failed, using content-based fallback');
      if (contentText) {
        mockQuiz.title = `${subject || 'Content-Based'} Quiz`;
        mockQuiz.description = `Quiz generated from provided content (${contentText.length} characters)`;

        const stopwords = new Set(['that', 'with', 'from', 'this', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'their', 'there', 'these', 'those']);
        const words = (contentText.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stopwords.has(w));
        const freq = {};
        for (const w of words) freq[w] = (freq[w] || 0) + 1;
        const topKeywords = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 3);
        mockQuiz.topics = topKeywords.length > 0 ? topKeywords : [subject || 'Content Analysis'];
      }
    }

    // Generate unique title if content based
    const finalTitle = mockQuiz.title || (contentText ? `${subject || 'Content-Based'} Quiz` : `${subject || 'General'} Quiz`);
    const finalDescription = mockQuiz.description || (contentText ? `Quiz generated from provided content` : `General knowledge quiz`);

    // ALWAYS SAVE TO DATABASE - This ensures quiz has a valid MongoDB ObjectId
    try {
      // 1. Create Question documents using validator (supports multiple types)
      let questionDocs;
      try {
        // Batch validate and create questions with type support
        const validatedQuestions = createQuestionBatch(mockQuiz.questions, 'mcq_single');
        questionDocs = await Question.insertMany(validatedQuestions);
        console.log('Questions created with types:', validatedQuestions.map(q => q.type || 'mcq_single').join(', '));
      } catch (validationError) {
        console.error('Question validation error:', validationError.message);
        throw new Error('Invalid question format: ' + validationError.message);
      }

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
      console.log('Question types:', quiz.questions.map(q => q.type || 'mcq_single').join(', '));
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
    const { text, subject, numCards = 10 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    console.log(`[generate] AI flashcard generation for subject: ${subject}`);
    const { generateFlashcardsFromText } = require('../utils/flashcardGen');

    let cards = [];
    try {
      cards = await generateFlashcardsFromText(text, parseInt(numCards));
    } catch (aiError) {
      console.error('[generate] AI flashcard error:', aiError);
      // Fallback is already handled inside generateFlashcardsFromText
    }

    if (!cards || cards.length === 0) {
      return res.status(500).json({ error: 'Failed to generate flashcards' });
    }

    // Award XP for generation
    const xpReward = 5;
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { xp: xpReward, total_xp: xpReward }
      });
    } catch (xpError) {
      console.error('[generate] Failed to award flashcard XP:', xpError.message);
    }

    // Return the structure expected by the mobile app (and now resilient to both)
    res.json({
      success: true,
      xpAwarded: xpReward,
      flashcards: {
        _id: Date.now().toString(),
        title: `${subject || 'General'} Flashcards`,
        cards: cards.map((c, i) => ({
          id: (i + 1).toString(),
          front: c.question || c.front,
          back: c.answer || c.back
        })),
        createdAt: new Date().toISOString(),
        createdBy: req.user._id
      }
    });
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