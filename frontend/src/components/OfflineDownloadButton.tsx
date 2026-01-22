import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { saveQuiz, saveFlashcardSet, saveFlashcards, openDB, STORES } from '../services/indexedDB';
import { useAuthStore } from '../services/store';
import { getAPIEndpoint, flashcardAPI } from '../services/api';

interface OfflineDownloadButtonProps {
  type: 'quiz' | 'flashcard';
  itemId: string;
  itemData: any;
  size?: 'small' | 'medium' | 'large';
  onDownloadComplete?: () => void;
}

/**
 * Button component for downloading quizzes/flashcard sets for offline use
 * Shows clear status: Available Offline, Download, or Downloading
 * Integrates with IndexedDB for persistent storage
 */
export const OfflineDownloadButton: React.FC<OfflineDownloadButtonProps> = ({
  type,
  itemId,
  itemData,
  size = 'small',
  onDownloadComplete,
}) => {
  const { user } = useAuthStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if already saved offline on mount
  useEffect(() => {
    checkOfflineAvailability();
  }, [itemId, type]);

  const checkOfflineAvailability = async () => {
    try {
      const db = await openDB();
      const storeName = type === 'quiz' ? STORES.QUIZZES : STORES.FLASHCARD_SETS;

      if (!db.objectStoreNames.contains(storeName)) {
        setIsOfflineAvailable(false);
        return;
      }

      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(itemId);

      getRequest.onsuccess = () => {
        setIsOfflineAvailable(!!getRequest.result);
      };
    } catch (err) {
      console.error('Error checking offline availability:', err);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    const userId = user?._id || user?.id;

    try {
      if (type === 'quiz') {
        // IMPORTANT: The dashboard list usually doesn't have the questions.
        // We must fetch the FULL quiz data before saving for offline.
        let fullQuizData = itemData;
        
        if (!itemData.questions || itemData.questions.length === 0) {
          console.log(`Fetching full quiz data for: ${itemId}`);
          const token = localStorage.getItem('authToken');
          const response = await fetch(getAPIEndpoint(`/quizzes/${itemId}`), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch full quiz content from server');
          }
          
          const data = await response.json();
          fullQuizData = data.quiz;
        }

        await saveQuiz(fullQuizData, userId);
      } else if (type === 'flashcard') {
        // For flashcards, if itemData is just the set, fetch cards
        let set = itemData.set || itemData;
        let cards = itemData.cards;
        
        if (!cards || cards.length === 0) {
          console.log(`Fetching flashcards for set: ${itemId}`);
          const response = await flashcardAPI.getUserCards(200, itemId);
          cards = response.data.flashcards;
          
          // If itemData was just the set, we need to restructure it
          if (!itemData.set) {
            set = itemData;
          }
        }
        
        if (set) {
          await saveFlashcardSet(set, userId);
        }
        if (cards && cards.length > 0) {
          await saveFlashcards(cards);
        }
      }

      setIsOfflineAvailable(true);
      setShowSuccess(true);
      onDownloadComplete?.();

      // Show success for 3 seconds then hide
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save offline');
      console.error('Offline download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Already offline available
  if (isOfflineAvailable && !showSuccess) {
    const sizeClass = size === 'large' ? 'px-4 py-2' : size === 'medium' ? 'px-3 py-2' : 'px-2 py-1.5';
    return (
      <button
        disabled
        className={`flex items-center gap-2 ${sizeClass} bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg`}
        title="Already saved for offline"
      >
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className={`font-medium text-green-700 dark:text-green-300 ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}`}>
          ✓ Offline
        </span>
      </button>
    );
  }

  // Downloading
  if (isDownloading) {
    const sizeClass = size === 'large' ? 'px-4 py-2' : size === 'medium' ? 'px-3 py-2' : 'px-2 py-1.5';
    return (
      <div className={`flex items-center gap-2 ${sizeClass} bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg`}>
        <Loader className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
        <span className={`font-medium text-blue-700 dark:text-blue-300 ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}`}>
          ⏳ Saving...
        </span>
      </div>
    );
  }

  // Success feedback
  if (showSuccess) {
    const sizeClass = size === 'large' ? 'px-4 py-2' : size === 'medium' ? 'px-3 py-2' : 'px-2 py-1.5';
    return (
      <div className={`flex items-center gap-2 ${sizeClass} bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg animate-pulse`}>
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className={`font-medium text-green-700 dark:text-green-300 ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}`}>
          ✓ Saved!
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    const sizeClass = size === 'large' ? 'px-4 py-2' : size === 'medium' ? 'px-3 py-2' : 'px-2 py-1.5';
    return (
      <button
        onClick={handleDownload}
        className={`flex items-center gap-2 ${sizeClass} bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors`}
        title={error}
      >
        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
        <span className={`font-medium text-red-700 dark:text-red-300 ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}`}>
          🔄 Retry
        </span>
      </button>
    );
  }

  // Normal state - show download button
  const sizeClass = size === 'large' ? 'px-4 py-2' : size === 'medium' ? 'px-3 py-2' : 'px-2 py-1.5';
  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className={`flex items-center gap-2 ${sizeClass} bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Save for offline use"
    >
      <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      <span className={`font-medium text-indigo-700 dark:text-indigo-300 ${size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'}`}>
        📥 Save
      </span>
    </button>
  );
};
