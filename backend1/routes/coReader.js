const express = require('express');
const router = express.Router();
const coReaderController = require('../controllers/coReaderController');
const auth = require('../middleware/auth');

router.post('/chat', auth, coReaderController.chat);
router.post('/pomodoro-quiz', auth, coReaderController.generatePomodoroQuiz);

module.exports = router;
