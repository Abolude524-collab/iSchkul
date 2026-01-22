import { useCallback, useState } from 'react';
import {
  saveQuizAttempt,
  getQuizAttempt,
  addToSyncQueue,
  saveFlashcardProgress
} from '../services/indexedDB';
import {
  scoreQuiz,
  ScoringResult,
  calculateXP,
  UserAnswers
} from '../services/offlineScoringEngine';

export const useOfflineQuiz = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoringResult | null>(null);

  /**
   * Submit quiz attempt (works offline)
   */
  const submitQuizAttempt = useCallback(
    async (
      quiz: any,
      answers: UserAnswers,
      timeTaken: number,
      userId: string
    ): Promise<ScoringResult | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        // Score locally
        const scoringResult = scoreQuiz(quiz.questions, answers, timeTaken);

        // Save attempt to IndexedDB
        const attemptId = await saveQuizAttempt({
          quizId: quiz._id,
          userId,
          answers,
          score: scoringResult.score,
          percentage: scoringResult.percentage,
          correctCount: scoringResult.correctCount,
          totalCount: scoringResult.totalCount,
          details: scoringResult.details,
          timeTaken,
          xpEarned: calculateXP(scoringResult, quiz.difficulty || 'medium')
        });

        // Add to sync queue (will sync when online)
        await addToSyncQueue({
          type: 'quiz_attempt',
          data: {
            quizId: quiz._id,
            userId,
            answers,
            score: scoringResult.score,
            percentage: scoringResult.percentage,
            correctCount: scoringResult.correctCount,
            totalCount: scoringResult.totalCount,
            timeTaken,
            submittedAt: new Date().toISOString()
          }
        });

        setResult(scoringResult);
        return scoringResult;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * Get saved attempt
   */
  const getAttempt = useCallback(async (attemptId: number) => {
    try {
      const attempt = await getQuizAttempt(attemptId);
      return attempt;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    submitQuizAttempt,
    getAttempt,
    result,
    isSubmitting,
    error
  };
};

export const useOfflineFlashcards = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Record flashcard review
   */
  const recordReview = useCallback(
    async (
      flashcardId: string,
      userId: string,
      isCorrect: boolean,
      difficulty: number
    ): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);

      try {
        // Save progress locally
        await saveFlashcardProgress({
          flashcardId,
          userId,
          reviewCount: 1,
          correctCount: isCorrect ? 1 : 0,
          lastReview: new Date().toISOString(),
          difficulty
        });

        // Queue for sync
        await addToSyncQueue({
          type: 'flashcard_review',
          data: {
            flashcardId,
            userId,
            isCorrect,
            difficulty,
            reviewedAt: new Date().toISOString()
          }
        });

        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  return {
    recordReview,
    isUpdating,
    error
  };
};
