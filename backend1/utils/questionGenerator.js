/**
 * Question Generator Utilities
 * Supports creating questions of different types:
 * - mcq_single: Single correct answer
 * - mcq_multiple: Multiple correct answers
 * - true_false: Boolean answer
 */

/**
 * Convert raw question data from AI to database format
 * Intelligently determines question type and ensures all required fields are present
 * 
 * @param {Object} rawQuestion - Raw question from AI generation
 * @param {String} defaultType - Default question type if not specified (default: 'mcq_single')
 * @returns {Object} Question object ready for database insertion
 */
function createQuestionDocument(rawQuestion, defaultType = 'mcq_single') {
  // Validate input
  if (!rawQuestion || !rawQuestion.text) {
    throw new Error('Question text is required');
  }

  const questionType = rawQuestion.type || defaultType;

  // Build base question
  const baseQuestion = {
    text: rawQuestion.text,
    type: questionType,
    explanation: rawQuestion.explanation || '',
    imageUrl: rawQuestion.imageUrl || null,
    difficulty: rawQuestion.difficulty || 'medium',
  };

  // Type-specific validation and field population
  switch (questionType) {
    case 'mcq_single':
      return createMCQSingleQuestion(rawQuestion, baseQuestion);

    case 'mcq_multiple':
      return createMCQMultipleQuestion(rawQuestion, baseQuestion);

    case 'true_false':
      return createTrueFalseQuestion(rawQuestion, baseQuestion);

    default:
      throw new Error(`Unsupported question type: ${questionType}`);
  }
}

/**
 * Create MCQ_SINGLE question (single radio button answer)
 */
function createMCQSingleQuestion(rawQuestion, baseQuestion) {
  if (!rawQuestion.options || !Array.isArray(rawQuestion.options) || rawQuestion.options.length < 2) {
    throw new Error('MCQ_SINGLE requires at least 2 options');
  }

  if (rawQuestion.correctAnswer === undefined || rawQuestion.correctAnswer === null) {
    throw new Error('MCQ_SINGLE requires correctAnswer (option index)');
  }

  const correctAnswerIndex = parseInt(rawQuestion.correctAnswer, 10);
  if (
    !Number.isInteger(correctAnswerIndex) ||
    correctAnswerIndex < 0 ||
    correctAnswerIndex >= rawQuestion.options.length
  ) {
    throw new Error(
      `MCQ_SINGLE correctAnswer must be valid option index (0-${rawQuestion.options.length - 1})`
    );
  }

  return {
    ...baseQuestion,
    options: rawQuestion.options,
    correctAnswer: correctAnswerIndex,
  };
}

/**
 * Create MCQ_MULTIPLE question (multiple checkbox answers)
 */
function createMCQMultipleQuestion(rawQuestion, baseQuestion) {
  if (!rawQuestion.options || !Array.isArray(rawQuestion.options) || rawQuestion.options.length < 2) {
    throw new Error('MCQ_MULTIPLE requires at least 2 options');
  }

  if (!rawQuestion.correctAnswers || !Array.isArray(rawQuestion.correctAnswers)) {
    throw new Error('MCQ_MULTIPLE requires correctAnswers array');
  }

  if (rawQuestion.correctAnswers.length === 0) {
    throw new Error('MCQ_MULTIPLE requires at least 1 correct answer');
  }

  // Validate and normalize correct answers indices
  const correctAnswerIndices = rawQuestion.correctAnswers
    .map((ans) => parseInt(ans, 10))
    .filter((ans) => Number.isInteger(ans) && ans >= 0 && ans < rawQuestion.options.length);

  if (correctAnswerIndices.length === 0) {
    throw new Error('MCQ_MULTIPLE has no valid correct answer indices');
  }

  // Ensure uniqueness
  const uniqueIndices = [...new Set(correctAnswerIndices)];

  return {
    ...baseQuestion,
    options: rawQuestion.options,
    correctAnswers: uniqueIndices,
    correctAnswer: undefined, // Not used for this type
  };
}

/**
 * Create TRUE_FALSE question (boolean answer)
 */
function createTrueFalseQuestion(rawQuestion, baseQuestion) {
  if (rawQuestion.correctAnswerBoolean === undefined || rawQuestion.correctAnswerBoolean === null) {
    throw new Error('TRUE_FALSE requires correctAnswerBoolean (true or false)');
  }

  let correctAnswer = rawQuestion.correctAnswerBoolean;
  if (typeof correctAnswer === 'string') {
    correctAnswer = correctAnswer.toLowerCase() === 'true' || correctAnswer === '1';
  } else {
    correctAnswer = Boolean(correctAnswer);
  }

  return {
    ...baseQuestion,
    options: ['True', 'False'], // Standard options for true/false
    correctAnswerBoolean: correctAnswer,
    correctAnswer: undefined, // Not used for this type
  };
}

/**
 * Batch create question documents from array
 * @param {Array} rawQuestions - Array of raw question objects from AI
 * @param {String} defaultType - Default question type
 * @returns {Array} Array of validated question objects
 */
function createQuestionBatch(rawQuestions, defaultType = 'mcq_single') {
  if (!Array.isArray(rawQuestions)) {
    throw new Error('Input must be an array of questions');
  }

  return rawQuestions.map((rawQ) => createQuestionDocument(rawQ, defaultType));
}

module.exports = {
  createQuestionDocument,
  createQuestionBatch,
  createMCQSingleQuestion,
  createMCQMultipleQuestion,
  createTrueFalseQuestion,
};
