const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

// Intelligent fallback quiz generator (no AI required)
function generateFallbackQuiz(text, numQuestions, difficulty, subject) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
  
  // Extract key concepts (words that appear frequently and are capitalized or technical)
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordFreq = {};
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const keyTerms = Object.entries(wordFreq)
    .filter(([w, freq]) => freq > 2 && w.length > 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  const questions = [];
  const usedSentences = new Set();

  for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
    // Find an unused sentence with substance
    let baseSentence = null;
    for (let attempt = 0; attempt < sentences.length; attempt++) {
      const candidate = sentences[(i * 7 + attempt) % sentences.length];
      if (!usedSentences.has(candidate) && candidate.trim().length > 40) {
        baseSentence = candidate;
        usedSentences.add(candidate);
        break;
      }
    }

    if (!baseSentence) baseSentence = sentences[i % sentences.length];

    // Generate question stem based on difficulty
    let stem;
    const topic = keyTerms[(i * 3) % keyTerms.length] || subject || "the content";
    
    if (difficulty === 'easy') {
      stem = `According to the text, what is mentioned about ${topic}?`;
    } else if (difficulty === 'medium') {
      stem = `Which statement best describes ${topic} as presented in the material?`;
    } else if (difficulty === 'hard') {
      stem = `Analyze the relationship between ${topic} and the concepts discussed. Which conclusion is most supported?`;
    } else {
      stem = `Evaluate the theoretical implications of ${topic}. Which advanced interpretation is most accurate?`;
    }

    // Generate options
    const correctAnswer = baseSentence.trim().replace(/^[^a-zA-Z]+/, '').substring(0, 100);
    const distractors = [];

    // Create plausible distractors
    for (let d = 0; d < 3; d++) {
      const distractorIdx = (i + d + 1) % Math.max(paragraphs.length, 1);
      const distPara = paragraphs[distractorIdx] || baseSentence;
      const distSentences = distPara.match(/[^.!?]+[.!?]+/g) || [distPara];
      const distText = (distSentences[d % distSentences.length] || distSentences[0] || "Alternative explanation")
        .trim()
        .replace(/^[^a-zA-Z]+/, '')
        .substring(0, 100);
      distractors.push(distText);
    }

    // Shuffle options
    const allOptions = [correctAnswer, ...distractors];
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    const correctIndex = shuffled.indexOf(correctAnswer);
    const correctLabel = ['a', 'b', 'c', 'd'][correctIndex];

    const question = {
      id: `q${i + 1}`,
      stem,
      options: shuffled.map((text, idx) => ({
        label: ['a', 'b', 'c', 'd'][idx],
        text
      })),
      answer: correctLabel,
      explanation: `This answer is directly supported by the text: "${baseSentence.substring(0, 150)}..."`,
      difficulty: difficulty || 'medium',
      tags: [subject || 'general', topic].filter(Boolean)
    };

    questions.push(question);
  }

  return { questions };
}

module.exports = async function (context, req) {
  context.log("Quiz generation triggered");

  if (req.method !== "POST") {
    context.res = { status: 405, body: "Method not allowed" };
    return;
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    context.res = { status: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    context.res = { status: 401, body: JSON.stringify({ error: "Invalid token" }) };
    return;
  }

  const { 
    text, 
    numQuestions = 10, 
    groupId, 
    createdBy, 
    file, 
    subject,
    difficulty = 'medium',
    timeLimit = 1800 // default 30 minutes in seconds
  } = req.body;

  if ((!text || text.trim().length === 0) && !file) {
    context.res = { status: 400, body: JSON.stringify({ error: "text or file required" }) };
    return;
  }

  if (!createdBy) {
    context.res = { status: 400, body: JSON.stringify({ error: "createdBy required" }) };
    return;
  }

  let textToProcess = text;

  // If file uploaded, extract text
  if (file) {
    const fileBuffer = Buffer.from(file.data, 'base64');

    if (file.mimetype === "application/pdf") {
      // Extract text from PDF
      const data = await pdfParse(fileBuffer);
      textToProcess = data.text;
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // Extract text from DOCX
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      textToProcess = result.value;
    } else {
      context.res = {
        status: 400,
        body: JSON.stringify({ error: "Unsupported file type. Only PDF and DOCX allowed." }),
      };
      return;
    }
  }

  if (!textToProcess || textToProcess.trim().length === 0) {
    context.res = {
      status: 400,
      body: JSON.stringify({ error: "No text content found to process" }),
    };
    return;
  }

  try {
    // Initialize Azure OpenAI
    const client = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
    );

    // System prompt with responsible AI constraints
    const systemPrompt = `You are an expert educational assessment designer from a Nigerian University. Generate exactly ${numQuestions} rigorous ${difficulty} multiple-choice questions strictly based on the provided text.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficulty === 'easy' ? '- Focus on basic recall and understanding\n- Use straightforward language\n- Test fundamental concepts' : ''}
${difficulty === 'medium' ? '- Balance recall and application\n- Include some analytical thinking\n- Test comprehension and connections' : ''}
${difficulty === 'hard' ? '- Emphasize analysis and synthesis\n- Require deep understanding\n- Test complex reasoning and connections' : ''}
${difficulty === 'veryhard' ? '- Maximum cognitive challenge\n- Require expert-level analysis\n- Test advanced critical thinking and synthesis' : ''}

STRICT REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanation)
- Never create questions not supported by the provided text
- Each question must have 4 distinct options
- Mark correct answer by option letter (a/b/c/d)
- Include clear explanations referencing the text
- Assign difficulty: ${difficulty}
- Add relevant subject tags

RESPONSIBLE AI:
- Forbid discriminatory, harmful, or non-educational content
- Ensure cultural sensitivity and inclusivity
- Never generate trick questions that mislead

JSON SCHEMA (REQUIRED):
{
  "questions": [
    {
      "id": "q1",
      "stem": "question text",
      "options": [
        {"label": "a", "text": "option A"},
        {"label": "b", "text": "option B"},
        {"label": "c", "text": "option C"},
        {"label": "d", "text": "option D"}
      ],
      "answer": "c",
      "explanation": "why this is correct...",
      "difficulty": "medium",
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

    let quizData;
    
    try {
      // Call Azure OpenAI with JSON mode
      const response = await client.getChatCompletions(
        process.env.AZURE_OPENAI_DEPLOYMENT,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate quiz questions from this text:\n\n${textToProcess.substring(0, 10000)}` },
        ],
        {
          responseFormat: { type: "json_object" },
          temperature: 0.7,
          maxTokens: 4000,
        }
      );

      quizData = JSON.parse(response.choices[0].message.content);
    } catch (aiError) {
      // Log AI error details
      context.log("AI generation failed:", aiError.message || aiError);
      
      // Check if it's a quota/billing issue
      const isQuotaError = aiError.message && (
        aiError.message.includes('quota') || 
        aiError.message.includes('429') ||
        aiError.message.includes('insufficient')
      );

      if (isQuotaError) {
        context.log("Quota exceeded, using intelligent fallback generation");
      }

      // FALLBACK: Generate quiz from content analysis
      quizData = generateFallbackQuiz(textToProcess, numQuestions, difficulty, subject);
    }

    // Validate quiz structure
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      context.res = { status: 400, body: JSON.stringify({ error: "Invalid quiz structure" }) };
      return;
    }

    // Store in Cosmos DB
    const mongoClient = new MongoClient(process.env.COSMOS_MONGO_CONN);
    await mongoClient.connect();
    const db = mongoClient.db(process.env.COSMOS_DB_NAME);
    const quizzesCollection = db.collection("quizzes");

    const quiz = {
      title: subject ? `${subject} Quiz` : `Auto-generated Quiz (${numQuestions} questions)`,
      subject: subject || null,
      difficulty: difficulty || 'medium',
      timeLimit: timeLimit, // in seconds
      questions: quizData.questions,
      groupId: groupId || null,
      createdBy,
      createdAt: new Date(),
      minPassingScore: 70,
      isPublic: true,
      metadata: {
        source: file ? "file-upload" : "text-input",
        model: "gpt-4o",
        originalFileName: file?.filename || null,
      },
    };

    const result = await quizzesCollection.insertOne(quiz);

    context.res = {
      status: 201,
      body: JSON.stringify({
        success: true,
        quizId: result.insertedId,
        quiz,
      }),
    };

    await mongoClient.close();
  } catch (error) {
    context.log("Error:", error);
    context.res = { status: 500, body: JSON.stringify({ error: "Server error", message: error.message }) };
  }
};
