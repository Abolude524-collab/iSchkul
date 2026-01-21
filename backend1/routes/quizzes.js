const express = require('express');
const auth = require('../middleware/auth');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizResult = require('../models/QuizResult');
const User = require('../models/User');
const XpLog = require('../models/XpLog');

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

// Get all quizzes (only user's own quizzes)
router.get('/', auth, async (req, res) => {
  try {
    const { subject, difficulty, limit = 20, offset = 0 } = req.query;

    // FIXED: Only return quizzes created by the current user
    // Public quizzes can still be accessed via direct link (/quizzes/:id or /public/:id)
    let query = {
      createdBy: req.user._id
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

// Public route for accessing public quizzes without authentication
router.get('/public/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('questions')
      .populate('createdBy', 'name username')
      .lean();

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Only allow access to public quizzes
    if (!quiz.isPublic) {
      return res.status(403).json({ error: 'This quiz is private' });
    }

    res.json({ quiz });
  } catch (error) {
    console.error('Get public quiz error:', error);
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

    console.log('[submitQuiz] Starting submission for quiz:', req.params.id);
    console.log('[submitQuiz] User ID:', req.user._id);
    console.log('[submitQuiz] Answers received:', answers?.length || 0);
    console.log('[submitQuiz] Time spent:', timeSpent);

    const quiz = await Quiz.findById(req.params.id).populate('questions');
    if (!quiz) {
      console.log('[submitQuiz] Quiz not found:', req.params.id);
      return res.status(404).json({ error: 'Quiz not found' });
    }

    console.log('[submitQuiz] Quiz found:', quiz.title, 'Questions:', quiz.questions?.length || 0);

    // Validate answers array
    if (!answers || !Array.isArray(answers)) {
      console.log('[submitQuiz] Invalid answers format:', typeof answers);
      return res.status(400).json({ error: 'Answers must be an array' });
    }

    if (answers.length !== quiz.questions.length) {
      console.log('[submitQuiz] Answer count mismatch. Expected:', quiz.questions.length, 'Got:', answers.length);
      return res.status(400).json({ error: 'Answer count does not match question count' });
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

    console.log('[submitQuiz] Score calculated:', score, '/', quiz.questions.length, '=', percentage + '%');

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

    console.log('[submitQuiz] Saving quiz result...');
    await result.save();
    console.log('[submitQuiz] Quiz result saved successfully:', result._id);

    // Award XP - using direct User update to ensure it's saved
    try {
      const xpAmount = percentage >= 80 ? 20 : percentage >= 60 ? 15 : 10;
      console.log('[submitQuiz] Awarding XP:', xpAmount);
      
      // Method 1: Try using app.locals.awardXp if available
      if (req.app && req.app.locals && typeof req.app.locals.awardXp === 'function') {
        const xpResult = await req.app.locals.awardXp(String(req.user._id), 'QUIZ_COMPLETE', xpAmount);
        console.log('[submitQuiz] XP awarded via app.locals:', xpResult);
      } else {
        // Method 2: Fallback - direct update to User and create XP log
        console.log('[submitQuiz] Using fallback XP award method');
        
        // Create XP log entry with correct schema field names
        const xpLog = await XpLog.create({
          user_id: req.user._id,
          xp_earned: xpAmount,
          activity_type: 'QUIZ_COMPLETE',
          metadata: {
            quizId: quizId,
            quizScore: score,
            description: `Quiz completed with ${percentage}% score`
          }
        });
        
        // Update user XP
        const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { $inc: { xp: xpAmount } },
          { new: true }
        );
        
        console.log('[submitQuiz] XP awarded via fallback. User XP now:', updatedUser.xp, 'XP Log ID:', xpLog._id);
      }
    } catch (xpError) {
      console.error('[submitQuiz] XP award error:', xpError.message);
      console.error('[submitQuiz] XP error stack:', xpError.stack);
    }

    console.log('[submitQuiz] Sending success response');
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
    console.error('[submitQuiz] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'Failed to submit quiz', details: error.message });
  }
});

// Get user's quiz results for a specific quiz
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

// Get consolidated quiz history for the user
router.get('/user/history', auth, async (req, res) => {
  try {
    const results = await QuizResult.find({ userId: req.user._id })
      .populate({
        path: 'quizId',
        select: 'title subject difficulty questions',
        populate: {
          path: 'questions',
          select: '_id'
        }
      })
      .sort({ completedAt: -1 })
      .lean();

    // Map to a cleaner format for the frontend
    const history = results.map(result => ({
      _id: result._id,
      quizId: result.quizId?._id,
      title: result.quizId?.title || 'Unknown Quiz',
      subject: result.quizId?.subject || 'General',
      difficulty: result.quizId?.difficulty || 'medium',
      score: result.score,
      percentage: result.percentage,
      totalQuestions: result.quizId?.questions?.length || result.detailedResults?.length || 0,
      timeSpent: result.timeSpent,
      completedAt: result.completedAt,
    }));

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
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