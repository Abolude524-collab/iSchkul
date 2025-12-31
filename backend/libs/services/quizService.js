/**
 * Quiz Service
 * Business logic for quiz generation, validation, and storage
 */

const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { getDatabase } = require("../repos/mongoConnection");
const domainEvents = require("../events/domainEvents");

class QuizService {
  constructor() {
    this.openaiClient = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
    );
  }

  async generateQuiz(text, numQuestions, createdBy, groupId = null, maxRetries = 3) {
    if (!text || text.length > 50000) {
      throw new Error("Text must be 1-50000 characters");
    }

    let quizData;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const systemPrompt = `You are an expert educational assessment designer.
Generate exactly ${numQuestions} rigorous multiple-choice questions strictly based on provided text.

STRICT REQUIREMENTS:
- Return ONLY valid JSON (no markdown)
- Each question has 4 options
- Mark answer by letter (a/b/c/d)
- Include explanation
- Set difficulty: easy|medium|hard
- Add tags

RESPONSIBLE AI:
- Forbid discriminatory/harmful content
- Ensure cultural sensitivity
- Never create trick questions

SCHEMA:
{
  "questions": [
    {
      "id": "q1",
      "stem": "question",
      "options": [{"label": "a", "text": "option"}],
      "answer": "a",
      "explanation": "why",
      "difficulty": "medium",
      "tags": []
    }
  ]
}`;

        const response = await this.openaiClient.getChatCompletions(
          process.env.AZURE_OPENAI_DEPLOYMENT,
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate quiz:\n\n${text}` },
          ],
          {
            responseFormat: { type: "json_object" },
            temperature: 0.7,
            maxTokens: 4000,
          }
        );

        quizData = JSON.parse(response.choices[0].message.content);

        // Validate schema
        if (!quizData.questions || !Array.isArray(quizData.questions)) {
          throw new Error("Invalid schema");
        }

        // Success - break loop
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw new Error(`Quiz generation failed after ${maxRetries} attempts`);
        }
      }
    }

    // Save to database
    const db = await getDatabase();
    const quizzesCollection = db.collection("quizzes");

    const quiz = {
      title: `Auto-generated Quiz (${numQuestions} questions)`,
      questions: quizData.questions,
      groupId,
      createdBy,
      createdAt: new Date(),
      minPassingScore: 70,
      metadata: {
        source: "azure-openai-json-mode",
        model: "gpt-4o",
      },
    };

    const result = await quizzesCollection.insertOne(quiz);

    // Emit event
    domainEvents.emitEvent(domainEvents.EVENTS.QUIZ_SUBMITTED, {
      quizId: result.insertedId,
      createdBy,
      groupId,
      timestamp: new Date(),
    });

    return { quizId: result.insertedId, ...quiz };
  }

  async getQuiz(quizId) {
    const db = await getDatabase();
    const quizzesCollection = db.collection("quizzes");
    return quizzesCollection.findOne({ _id: quizId });
  }

  async submitQuiz(quizId, userId, answers, groupId = null) {
    const db = await getDatabase();
    const quizResultsCollection = db.collection("quizResults");

    // Score quiz
    const quiz = await this.getQuiz(quizId);
    let score = 0;

    for (const answer of answers) {
      const question = quiz.questions.find((q) => q.id === answer.questionId);
      if (question && question.answer === answer.selectedAnswer) {
        score++;
      }
    }

    const scorePercentage = Math.round((score / quiz.questions.length) * 100);

    const result = {
      quizId,
      groupId,
      userId,
      score: scorePercentage,
      answers,
      duration: 0, // TODO: Track from client
      takenAt: new Date(),
      submittedAt: new Date(),
      status: "submitted",
    };

    const insertResult = await quizResultsCollection.insertOne(result);

    // Emit event
    domainEvents.emitEvent(domainEvents.EVENTS.QUIZ_SUBMITTED, {
      quizId,
      userId,
      groupId,
      score: scorePercentage,
      timestamp: new Date(),
    });

    return { ...result, _id: insertResult.insertedId };
  }
}

module.exports = new QuizService();
