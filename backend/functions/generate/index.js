const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

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

  const { text, numQuestions = 10, groupId, createdBy, file, subject } = req.body;

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
    const systemPrompt = `You are an expert educational assessment designer from a Nigerian University. Generate exactly ${numQuestions} rigorous multiple-choice questions strictly based on the provided text.

STRICT REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no explanation)
- Never create questions not supported by the provided text
- Each question must have 4 distinct options
- Mark correct answer by option letter (a/b/c/d)
- Include clear explanations referencing the text
- Assign difficulty: easy|medium|hard
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

    // Call Azure OpenAI with JSON mode
    const response = await client.getChatCompletions(
      process.env.AZURE_OPENAI_DEPLOYMENT,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate quiz questions from this text:\n\n${text}` },
      ],
      {
        responseFormat: { type: "json_object" },
        temperature: 0.7,
        maxTokens: 4000,
      }
    );

    let quizData;
    try {
      quizData = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      context.log("JSON parse error, retrying...");
      context.res = { status: 400, body: JSON.stringify({ error: "Invalid quiz generation output", retry: true }) };
      return;
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
      questions: quizData.questions,
      groupId: groupId || null,
      createdBy,
      createdAt: new Date(),
      minPassingScore: 70,
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
