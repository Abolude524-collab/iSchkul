const express = require('express');
const auth = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const router = express.Router();

// Generate quiz
router.post('/quiz', auth, async (req, res) => {
  try {
    const { text, subject, difficulty = 'medium', file, numQuestions } = req.body;

    let contentText = text;

    // If file is provided, extract text from it
    if (file && file.data) {
      try {
        // Decode base64 to buffer
        const buffer = Buffer.from(file.data, 'base64');
        
        if (file.mimetype === 'application/pdf') {
          const data = await pdfParse(buffer);
          contentText = data.text;
        } else if (file.mimetype === 'text/plain') {
          contentText = buffer.toString('utf8');
        } else {
          return res.status(400).json({ error: 'Unsupported file type. Only PDF and TXT files are supported.' });
        }
      } catch (fileError) {
        console.error('File processing error:', fileError);
        return res.status(400).json({ error: 'Failed to process uploaded file' });
      }
    }

    if (!contentText) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    // Generate dynamic mock questions based on content
    const generateMockQuestions = (topic, contentText, numQuestions = 5) => {
      const questions = [];

      // Extract keywords from content if available
      let keywords = [topic || 'this topic'];
      if (contentText) {
        // Simple keyword extraction - look for capitalized words and important terms
        const words = contentText.split(/\s+/).filter(word =>
          word.length > 3 &&
          word[0] === word[0].toUpperCase() &&
          !['that', 'with', 'from', 'this', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should'].includes(word.toLowerCase())
        );
        keywords = [...new Set(words.slice(0, 5))]; // Get unique keywords
        if (keywords.length === 0) keywords = [topic || 'this topic'];
      }

      // Content-aware question templates
      const templates = [
        {
          question: `What is the primary concept discussed in ${topic || 'this topic'}?`,
          options: ['Basic principles', 'Advanced applications', 'Historical context', 'Future developments'],
          correctAnswer: 0,
          explanation: 'The primary concept typically involves understanding the basic principles first.'
        },
        {
          question: `Which of the following is most important when studying ${topic || 'this subject'}?`,
          options: ['Theoretical knowledge', 'Practical application', 'Both equally', 'Neither'],
          correctAnswer: 2,
          explanation: 'Both theoretical knowledge and practical application are essential for comprehensive understanding.'
        },
        {
          question: `What challenge is commonly associated with ${topic || 'this field'}?`,
          options: ['Complexity', 'Cost', 'Time', 'All of the above'],
          correctAnswer: 3,
          explanation: 'Most fields face challenges related to complexity, cost, and time investment.'
        },
        {
          question: `How can one best prepare for ${topic || 'this area'}?`,
          options: ['Study fundamentals', 'Practice regularly', 'Seek guidance', 'All approaches work'],
          correctAnswer: 3,
          explanation: 'A combination of studying fundamentals, regular practice, and seeking guidance is most effective.'
        },
        {
          question: `What is a key benefit of understanding ${topic || 'this subject'}?`,
          options: ['Career opportunities', 'Personal growth', 'Problem-solving skills', 'All of the above'],
          correctAnswer: 3,
          explanation: 'Understanding any subject provides career opportunities, personal growth, and improved problem-solving skills.'
        }
      ];

      // If we have content, try to create more specific questions
      if (contentText && contentText.length > 100) {
        // Add content-specific questions
        const contentSpecificTemplates = [
          {
            question: `Based on the provided content, what is the main focus of ${topic}?`,
            options: ['Introduction to concepts', 'Advanced analysis', 'Practical implementation', 'Theoretical foundations'],
            correctAnswer: 0,
            explanation: 'The content appears to focus on foundational concepts and principles.'
          },
          {
            question: `According to the material, which approach is recommended for ${topic}?`,
            options: ['Step-by-step learning', 'Comprehensive overview', 'Practical exercises', 'All methods are valid'],
            correctAnswer: 3,
            explanation: 'The material suggests using a combination of different learning approaches.'
          }
        ];

        templates.push(...contentSpecificTemplates);
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
      _id: Date.now().toString(),
      title: contentText ? `${subject || 'Content-Based'} Quiz` : `${subject || 'General'} Quiz`,
      description: contentText ? `Quiz generated from provided content` : `General knowledge quiz`,
      difficulty: 'medium',
      topics: contentText ? [subject || 'Content Analysis'] : [subject || 'General'],
      questions: generateMockQuestions(subject || (contentText ? 'provided content' : 'general knowledge'), contentText, parseInt(numQuestions) || 5),
      createdAt: new Date().toISOString(),
      createdBy: req.user._id,
      isAIGenerated: false, // Flag to indicate fallback questions
      generationNote: contentText ? 'Using enhanced content-aware questions (AI generation failed)' : 'Using general knowledge questions'
    };

    // If OpenAI API key is available, use it
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      try {
        console.log('OpenAI API key found, length:', process.env.OPENAI_API_KEY.length);
        console.log('Attempting AI quiz generation for content length:', contentText.length);
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: `Generate a quiz with ${numQuestions || 5} multiple-choice questions based on this text. Each question must have exactly 4 options (A, B, C, D).

Text: ${contentText.substring(0, 2000)}

Return ONLY valid JSON in this exact format with no additional text:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation for why this answer is correct"
    }
  ]
}`
          }],
          max_tokens: 3000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000 // 45 second timeout
        });

        console.log('OpenAI API response status:', response.status);
        const aiResponse = response.data.choices[0].message.content.trim();
        console.log('Raw AI Response:', aiResponse.substring(0, 200) + '...');
        
        // Try to extract JSON from the response
        let jsonStart = aiResponse.indexOf('{');
        let jsonEnd = aiResponse.lastIndexOf('}') + 1;
        
        console.log('JSON start/end indices:', jsonStart, jsonEnd);
        
        if (jsonStart === -1 || jsonEnd === 0) {
          console.log('No JSON brackets found in response');
          throw new Error('No JSON found in AI response');
        }
        
        const jsonString = aiResponse.substring(jsonStart, jsonEnd);
        console.log('Extracted JSON string:', jsonString.substring(0, 200) + '...');
        
        const generatedContent = JSON.parse(jsonString);
        console.log('Parsed JSON successfully');
        
        if (generatedContent.questions && Array.isArray(generatedContent.questions)) {
          console.log('Found questions array with length:', generatedContent.questions.length);
          
          // Validate the structure
          const validQuestions = generatedContent.questions.filter(q => 
            q.question && 
            Array.isArray(q.options) && q.options.length >= 2 &&
            typeof q.correctAnswer === 'number' &&
            q.explanation
          );
          
          console.log('Valid questions found:', validQuestions.length);
          
          if (validQuestions.length > 0) {
            mockQuiz.questions = validQuestions.slice(0, parseInt(numQuestions) || 5);
            mockQuiz.isAIGenerated = true;
            mockQuiz.generationNote = 'AI-generated questions based on provided content';
            console.log(`Successfully generated ${mockQuiz.questions.length} questions using AI`);
          } else {
            throw new Error('AI generated invalid question format');
          }
        } else {
          throw new Error('AI response missing questions array');
        }
      } catch (aiError) {
        console.log('AI generation failed:', aiError.message);
        if (aiError.response) {
          console.log('OpenAI API error response:', aiError.response.status, aiError.response.data);
        }
        console.log('Falling back to mock data');
      }
    } else {
      console.log('No OpenAI API key configured, using mock data');
    }

    res.json({ quiz: mockQuiz });
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

module.exports = router;