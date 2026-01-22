import axios from 'axios';
import {
  getUnsyncedAttempts,
  getUnsyncedActions,
  markAttemptSynced,
  markActionSynced,
  deleteSyncAction
} from './indexedDB';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Sync all offline quiz attempts
 */
export const syncQuizAttempts = async (token: string): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: []
  };

  try {
    const attempts = await getUnsyncedAttempts();

    for (const attempt of attempts) {
      try {
        // Send attempt to server
        await axios.post(
          `${API_URL}/quizzes/attempts`,
          {
            quizId: attempt.quizId,
            userId: attempt.userId,
            answers: attempt.answers,
            score: attempt.score,
            timeSpent: attempt.timeSpent,
            completedAt: attempt.completedAt
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        // Mark as synced locally
        await markAttemptSynced(attempt.id);
        result.synced++;
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Attempt ${attempt.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Failed to sync attempts: ${error.message}`);
  }

  return result;
};

/**
 * Sync all offline actions (flashcard reviews, progress updates)
 */
export const syncOfflineActions = async (token: string): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: []
  };

  try {
    const actions = await getUnsyncedActions();

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'quiz_attempt':
            await axios.post(
              `${API_URL}/quizzes/attempts`,
              action.data,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            break;

          case 'flashcard_review':
            await axios.post(
              `${API_URL}/flashcards/review`,
              action.data,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            break;

          case 'progress_update':
            await axios.post(
              `${API_URL}/progress/update`,
              action.data,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            break;
        }

        // Delete from sync queue after successful sync
        await deleteSyncAction(action.id);
        result.synced++;
      } catch (error: any) {
        // Retry later if error
        if (action.retries < 3) {
          // Update retry count in queue
          console.warn(`Action ${action.id} sync failed, will retry later`);
        }
        result.failed++;
        result.errors.push(`Action ${action.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Failed to sync actions: ${error.message}`);
  }

  return result;
};

/**
 * Full sync - attempts + actions
 */
export const fullSync = async (token: string): Promise<SyncResult> => {
  const results = await Promise.all([
    syncQuizAttempts(token),
    syncOfflineActions(token)
  ]);

  return {
    success: results.every(r => r.success),
    synced: results.reduce((sum, r) => sum + r.synced, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
    errors: results.flatMap(r => r.errors)
  };
};

/**
 * Request background sync from service worker
 */
export const requestBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-offline-data');
      console.log('Background sync registered');
    } catch (error) {
      console.warn('Background sync not available:', error);
    }
  }
};

/**
 * Batch sync with retry logic
 */
export const syncWithRetry = async (
  token: string,
  maxRetries = 3,
  retryDelay = 1000
): Promise<SyncResult> => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fullSync(token);
      if (result.success || result.synced > 0) {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
      }
    }
  }

  return {
    success: false,
    synced: 0,
    failed: 0,
    errors: [`Max retries exceeded: ${lastError?.message || 'Unknown error'}`]
  };
};
