const express = require('express');
const auth = require('../middleware/auth');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizResult = require('../models/QuizResult');
const User = require('../models/User');

const router = express.Router();

// Create a new quiz
router.post('/create', auth, async (req, res) => {
  try {
    const { title, subject, questions, timeLimit, difficulty, isPublic = true } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }

    // Create questions first
    const questionDocs = await Question.insertMany(
      questions.map(q => ({
        text: q.question || q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        imageUrl: q.imageUrl || null,
      }))
    );

    // Create quiz
    const quiz = new Quiz({
      title,
      subject: subject || 'General',
      questions: questionDocs.map(q => q._id),
      timeLimit: timeLimit || 1800, // 30 minutes default
      difficulty: difficulty || 'medium',
      isPublic,
      createdBy: req.user._id,
      createdAt: new Date(),
    });

    await quiz.save();

    // Populate questions for response
    await quiz.populate('questions');
    await quiz.populate('createdBy', 'name username');

    res.status(201).json({ quiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Get all quizzes (public or user's own)
router.get('/', auth, async (req, res) => {
  try {
    const { subject, difficulty, limit = 20, offset = 0 } = req.query;

    let query = {
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    };

    if (subject) query.subject = new RegExp(subject, 'i');
    if (difficulty) query.difficulty = difficulty;

    const quizzes = await Quiz.find(query)
      .populate('createdBy', 'name username')
      .select('-questions') // Don't populate questions for list view
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Quiz.countDocuments(query);

    res.json({
      quizzes,
      total,
      hasMore: parseInt(offset) + quizzes.length < total
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get quiz by ID with full details
router.get('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('questions')
      .populate('createdBy', 'name username')
      .lean();

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if user can access this quiz
    if (!quiz.isPublic && quiz.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Update quiz
router.put('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only creator can update quiz' });
    }

    const { title, subject, questions, timeLimit, difficulty, isPublic } = req.body;

    if (title) quiz.title = title;
    if (subject) quiz.subject = subject;
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit;
    if (difficulty) quiz.difficulty = difficulty;
    if (isPublic !== undefined) quiz.isPublic = isPublic;

    if (questions && Array.isArray(questions)) {
      // Remove old questions
      await Question.deleteMany({ _id: { $in: quiz.questions } });

      // Create new questions
      const questionDocs = await Question.insertMany(
        questions.map(q => ({
          text: q.question || q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          imageUrl: q.imageUrl || null,
        }))
      );

      quiz.questions = questionDocs.map(q => q._id);
    }

    await quiz.save();
    await quiz.populate('questions');
    await quiz.populate('createdBy', 'name username');

    res.json({ quiz });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete quiz
router.delete('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only creator can delete quiz' });
    }

    // Delete questions and results
    await Question.deleteMany({ _id: { $in: quiz.questions } });
    await QuizResult.deleteMany({ quizId: quiz._id });

    await quiz.deleteOne();

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// Submit quiz result
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { answers, timeSpent } = req.body;

    const quiz = await Quiz.findById(req.params.id).populate('questions');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    let correctCount = 0;
    const detailedResults = quiz.questions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionId: question._id,
        question: question.text,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const score = correctCount;
    const percentage = Math.round((correctCount / quiz.questions.length) * 100);

    // Save result
    const result = new QuizResult({
      quizId: quiz._id,
      userId: req.user._id,
      answers,
      score,
      percentage,
      timeSpent: timeSpent || 0,
      completedAt: new Date(),
      detailedResults,
    });

    await result.save();

    // Award XP
    try {
      const xpAmount = percentage >= 80 ? 20 : percentage >= 60 ? 15 : 10;
      // Note: XP awarding would be handled by gamification service
    } catch (xpError) {
      console.error('XP award error:', xpError);
    }

    res.json({
      result: {
        score,
        totalQuestions: quiz.questions.length,
        percentage,
        timeSpent: timeSpent || 0,
        detailedResults,
        passed: percentage >= 60, // 60% passing grade
      }
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// Get user's quiz results
router.get('/:id/results', auth, async (req, res) => {
  try {
    const results = await QuizResult.find({
      quizId: req.params.id,
      userId: req.user._id
    })
    .sort({ completedAt: -1 })
    .limit(10)
    .lean();

    res.json({ results });
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get quiz leaderboard
router.get('/:id/leaderboard', auth, async (req, res) => {
  try {
    const results = await QuizResult.find({ quizId: req.params.id })
      .populate('userId', 'name username')
      .sort({ percentage: -1, timeSpent: 1 }) // Sort by score desc, then time asc
      .limit(50)
      .lean();

    const leaderboard = results.map((result, index) => ({
      rank: index + 1,
      user: {
        id: result.userId._id,
        name: result.userId.name,
        username: result.userId.username,
      },
      score: result.score,
      percentage: result.percentage,
      timeSpent: result.timeSpent,
      completedAt: result.completedAt,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;