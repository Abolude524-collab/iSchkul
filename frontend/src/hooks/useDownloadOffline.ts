import { useState, useCallback } from 'react';
import { saveQuiz, saveFlashcardSet, saveFlashcard } from '@/services/indexedDB';
import api from '@/services/api';

/**
 * Hook for downloading quizzes to offline storage (IndexedDB)
 * Handles fetching full quiz data and caching locally
 */
export const useDownloadQuizOffline = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadQuiz = useCallback(async (quizId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch full quiz data from server
      const response = await api.get(`/quizzes/${quizId}`);
      const quiz = response.data.data || response.data;

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Cache quiz locally
      await saveQuiz({
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions, // All questions with answers
        type: quiz.type || 'multi-type',
        difficulty: quiz.difficulty,
        duration: quiz.duration,
        source: quiz.source,
        subject: quiz.subject,
        downlloadedAt: new Date().toISOString(),
        isOffline: true, // Mark as offline copy
      });

      console.log(`✓ Quiz "${quiz.title}" saved for offline`);
      return quiz;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        'Failed to download quiz';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { downloadQuiz, loading, error };
};

/**
 * Hook for downloading flashcard sets to offline storage (IndexedDB)
 * Fetches set metadata and all cards, caches locally
 */
export const useDownloadFlashcardSetOffline = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFlashcardSet = useCallback(async (setId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch flashcard set metadata
      const setResponse = await api.get(
        `/flashcards/sets/${setId}`
      );
      const flashcardSet = setResponse.data.data || setResponse.data;

      if (!flashcardSet) {
        throw new Error('Flashcard set not found');
      }

      // Fetch all cards in the set
      const cardsResponse = await api.get(
        `/flashcards/sets/${setId}/cards`
      );
      const cards = cardsResponse.data.data || cardsResponse.data || [];

      // Save set metadata
      await saveFlashcardSet({
        _id: flashcardSet._id,
        title: flashcardSet.title,
        description: flashcardSet.description,
        cardCount: cards.length,
        owner: flashcardSet.owner,
        tags: flashcardSet.tags,
        isPublic: flashcardSet.isPublic,
        downloadedAt: new Date().toISOString(),
        isOffline: true,
      });

      // Save individual cards
      for (const card of cards) {
        await saveFlashcard({
          _id: card._id,
          setId: flashcardSet._id,
          question: card.question,
          answer: card.answer,
          examples: card.examples,
          hints: card.hints,
          imageUrl: card.imageUrl,
          difficulty: card.difficulty,
          tags: card.tags,
        });
      }

      console.log(
        `✓ Flashcard set "${flashcardSet.title}" (${cards.length} cards) saved for offline`
      );
      return { set: flashcardSet, cards };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        'Failed to download flashcard set';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { downloadFlashcardSet, loading, error };
};

/**
 * Combined hook for downloading any item type
 */
export const useDownloadItemOffline = () => {
  const { downloadQuiz } = useDownloadQuizOffline();
  const { downloadFlashcardSet } = useDownloadFlashcardSetOffline();

  const downloadItem = useCallback(
    async (itemId: string, itemType: 'quiz' | 'flashcardSet') => {
      if (itemType === 'quiz') {
        return await downloadQuiz(itemId);
      } else if (itemType === 'flashcardSet') {
        return await downloadFlashcardSet(itemId);
      }
      throw new Error('Unknown item type');
    },
    [downloadQuiz, downloadFlashcardSet]
  );

  return { downloadItem };
};
