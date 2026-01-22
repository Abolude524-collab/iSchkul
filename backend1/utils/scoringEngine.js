/**
 * Scoring Engine - Type-aware quiz submission scoring
 * Supports: mcq_single, mcq_multiple, true_false
 * Maintains backward compatibility with existing questions
 */

/**
 * Score a single question based on its type
 * @param {Object} question - Question document with text, type, correct answer(s)
 * @param {*} userAnswer - User's submitted answer (number or array or boolean)
 * @returns {Object} { isCorrect: boolean, userAnswer: *, explanation: string }
 */
function scoreQuestion(question, userAnswer) {
  if (!question) {
    throw new Error('Question is required');
  }

  const questionType = question.type || 'mcq_single'; // Default to mcq_single for backward compatibility

  switch (questionType) {
    case 'mcq_single':
      return scoreMCQSingle(question, userAnswer);
    case 'mcq_multiple':
      return scoreMCQMultiple(question, userAnswer);
    case 'true_false':
      return scoreTrueFalse(question, userAnswer);
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

/**
 * Score MCQ_SINGLE (radio button - single answer)
 * @param {Object} question - Question with correctAnswer (number)
 * @param {Number} userAnswer - Option index selected by user
 * @returns {Object} { isCorrect: boolean, userAnswer: number, explanation: string }
 */
function scoreMCQSingle(question, userAnswer) {
  // Handle null/undefined answers
  if (userAnswer === null || userAnswer === undefined) {
    return {
      isCorrect: false,
      userAnswer: null,
      explanation: question.explanation || '',
    };
  }

  // Convert to number if string
  const answer = typeof userAnswer === 'string' ? parseInt(userAnswer, 10) : userAnswer;

  // Validate answer is a valid option index
  if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
    return {
      isCorrect: false,
      userAnswer: answer,
      explanation: question.explanation || '',
    };
  }

  const isCorrect = answer === question.correctAnswer;

  return {
    isCorrect,
    userAnswer: answer,
    correctAnswer: question.correctAnswer,
    selectedOption: isCorrect ? question.options[answer] : null,
    correctOption: question.options[question.correctAnswer],
    explanation: question.explanation || '',
  };
}

/**
 * Score MCQ_MULTIPLE (checkboxes - multiple correct answers)
 * @param {Object} question - Question with correctAnswers (array of indices)
 * @param {Array} userAnswers - Array of option indices selected by user
 * @returns {Object} { isCorrect: boolean, userAnswers: array, explanation: string }
 */
function scoreMCQMultiple(question, userAnswers) {
  // Handle null/undefined
  if (!userAnswers) {
    return {
      isCorrect: false,
      userAnswers: [],
      correctAnswers: question.correctAnswers || [],
      explanation: question.explanation || '',
    };
  }

  // Ensure userAnswers is array
  if (!Array.isArray(userAnswers)) {
    return {
      isCorrect: false,
      userAnswers: Array.isArray(userAnswers) ? userAnswers : [],
      correctAnswers: question.correctAnswers || [],
      explanation: question.explanation || '',
    };
  }

  // Convert all to integers
  const normalizedAnswers = userAnswers
    .map((a) => (typeof a === 'string' ? parseInt(a, 10) : a))
    .filter((a) => Number.isInteger(a) && a >= 0 && a < question.options.length);

  // Correct only if ALL correct answers are selected and NO incorrect answers
  const correctAnswersSet = new Set(question.correctAnswers || []);
  const userAnswersSet = new Set(normalizedAnswers);

  const isCorrect =
    correctAnswersSet.size === userAnswersSet.size &&
    Array.from(correctAnswersSet).every((ans) => userAnswersSet.has(ans));

  return {
    isCorrect,
    userAnswers: normalizedAnswers,
    correctAnswers: question.correctAnswers || [],
    selectedOptions: normalizedAnswers.map((idx) => question.options[idx]),
    correctOptions: (question.correctAnswers || []).map((idx) => question.options[idx]),
    explanation: question.explanation || '',
  };
}

/**
 * Score TRUE_FALSE (toggle - boolean answer)
 * @param {Object} question - Question with correctAnswerBoolean (true or false)
 * @param {Boolean} userAnswer - User's boolean selection
 * @returns {Object} { isCorrect: boolean, userAnswer: boolean, explanation: string }
 */
function scoreTrueFalse(question, userAnswer) {
  // Handle null/undefined
  if (userAnswer === null || userAnswer === undefined) {
    return {
      isCorrect: false,
      userAnswer: null,
      correctAnswer: question.correctAnswerBoolean,
      explanation: question.explanation || '',
    };
  }

  // Convert string to boolean if needed
  let answer = userAnswer;
  if (typeof userAnswer === 'string') {
    answer = userAnswer.toLowerCase() === 'true' || userAnswer === '1';
  } else if (typeof userAnswer !== 'boolean') {
    answer = Boolean(userAnswer);
  }

  const isCorrect = answer === question.correctAnswerBoolean;

  return {
    isCorrect,
    userAnswer: answer,
    correctAnswer: question.correctAnswerBoolean,
    explanation: question.explanation || '',
  };
}

/**
 * Score multiple questions from a quiz submission
 * @param {Array} questions - Array of Question documents
 * @param {Array} answers - Array of user answers (may be mixed types)
 * @returns {Object} { score: number, totalQuestions: number, percentage: number, detailedResults: array }
 */
function scoreQuiz(questions, answers) {
  if (!Array.isArray(questions) || !Array.isArray(answers)) {
    throw new Error('questions and answers must be arrays');
  }

  if (questions.length !== answers.length) {
    throw new Error(`Mismatch: ${questions.length} questions, ${answers.length} answers`);
  }

  let correctCount = 0;
  const detailedResults = [];

  questions.forEach((question, index) => {
    const result = scoreQuestion(question, answers[index]);

    if (result.isCorrect) {
      correctCount += 1;
    }

    detailedResults.push({
      questionId: question._id,
      questionType: question.type || 'mcq_single',
      questionText: question.text,
      ...result,
    });
  });

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    score: correctCount,
    totalQuestions,
    percentage,
    detailedResults,
  };
}

module.exports = {
  scoreQuestion,
  scoreQuiz,
  scoreMCQSingle,
  scoreMCQMultiple,
  scoreTrueFalse,
};
