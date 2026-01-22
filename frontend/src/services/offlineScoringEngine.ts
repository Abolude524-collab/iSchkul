/**
 * Client-side quiz scoring engine
 * Calculates scores instantly without server (for offline support)
 */

export interface QuizQuestion {
  _id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  type: 'mcq_single' | 'mcq_multiple' | 'true_false';
  explanation?: string;
}

export interface UserAnswers {
  [questionId: string]: number | number[]; // Single answer or array for multiple choice
}

export interface ScoringResult {
  score: number;
  percentage: number;
  correctCount: number;
  totalCount: number;
  details: {
    questionId: string;
    correct: boolean;
    userAnswer: any;
    correctAnswer: any;
    explanation: string;
  }[];
  timeTaken: number;
}

/**
 * Score a single question
 */
const scoreQuestion = (
  question: QuizQuestion,
  userAnswer: any
): { correct: boolean; explanation: string } => {
  const { type, correctAnswer, options } = question;

  switch (type) {
    case 'mcq_single':
      // Single choice - exact match
      const singleCorrect = userAnswer === correctAnswer;
      return {
        correct: singleCorrect,
        explanation: question.explanation || 'No explanation available'
      };

    case 'mcq_multiple':
      // Multiple choice - user must select all correct answers
      const userAnswerArray = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      const correctAnswerArray = Array.isArray(correctAnswer)
        ? correctAnswer
        : [correctAnswer];

      // Sort both arrays for comparison
      const userSorted = userAnswerArray.sort((a, b) => a - b);
      const correctSorted = correctAnswerArray.sort((a, b) => a - b);

      const multipleCorrect =
        userSorted.length === correctSorted.length &&
        userSorted.every((val, idx) => val === correctSorted[idx]);

      return {
        correct: multipleCorrect,
        explanation: question.explanation || 'No explanation available'
      };

    case 'true_false':
      // True/False - 0 = False, 1 = True
      const tfCorrect =
        (userAnswer === 0 && correctAnswer === 0) ||
        (userAnswer === 1 && correctAnswer === 1);
      return {
        correct: tfCorrect,
        explanation: question.explanation || 'No explanation available'
      };

    default:
      return { correct: false, explanation: 'Unknown question type' };
  }
};

/**
 * Score entire quiz
 */
export const scoreQuiz = (
  questions: QuizQuestion[],
  userAnswers: UserAnswers,
  timeTaken: number
): ScoringResult => {
  const details = questions.map((question) => {
    const userAnswer = userAnswers[question._id];
    const { correct, explanation } = scoreQuestion(question, userAnswer);

    return {
      questionId: question._id,
      correct,
      userAnswer,
      correctAnswer: question.correctAnswer,
      explanation
    };
  });

  const correctCount = details.filter(d => d.correct).length;
  const totalCount = questions.length;
  const percentage = (correctCount / totalCount) * 100;
  const score = Math.round((correctCount / totalCount) * 100);

  return {
    score,
    percentage,
    correctCount,
    totalCount,
    details,
    timeTaken
  };
};

/**
 * Calculate letter grade from score
 */
export const getGrade = (score: number): string => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

/**
 * Get performance feedback
 */
export const getPerformanceFeedback = (percentage: number): string => {
  if (percentage >= 90) return 'Excellent! You have mastered this topic.';
  if (percentage >= 80) return 'Great job! You understand most concepts.';
  if (percentage >= 70) return 'Good effort! Review the questions you missed.';
  if (percentage >= 60) return 'You got the basics. Study harder for better results.';
  return 'Keep practicing! Focus on areas where you struggled.';
};

/**
 * Format score for display
 */
export const formatScore = (result: ScoringResult): string => {
  return `${result.score}% (${result.correctCount}/${result.totalCount})`;
};

/**
 * Calculate XP earned (can be customized)
 */
export const calculateXP = (
  result: ScoringResult,
  difficulty: 'easy' | 'medium' | 'hard' | 'veryhard' = 'medium',
  timeBonusMultiplier = 1
): number => {
  const baseXP = {
    easy: 5,
    medium: 10,
    hard: 15,
    veryhard: 20
  };

  const scoreMultiplier = result.percentage / 100;
  const basePoints = baseXP[difficulty] * scoreMultiplier;

  // Time bonus: faster completion = more XP
  const timeBonus = Math.max(0, (300 - result.timeTaken) / 300) * 5 * timeBonusMultiplier;

  return Math.round(basePoints + timeBonus);
};

/**
 * Generate summary report for offline attempt
 */
export const generateOfflineSummary = (
  quizTitle: string,
  result: ScoringResult,
  timestamp: string
): string => {
  return `
Quiz: ${quizTitle}
Completed: ${new Date(timestamp).toLocaleString()}
Score: ${result.score}% (${result.correctCount}/${result.totalCount})
Grade: ${getGrade(result.score)}
Time: ${Math.round(result.timeTaken / 60)}m ${result.timeTaken % 60}s
Feedback: ${getPerformanceFeedback(result.percentage)}
  `.trim();
};
