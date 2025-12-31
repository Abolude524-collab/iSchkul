import React, { useState, useEffect } from 'react';
import { flashcardSetsAPI } from '../services/api';

interface FlashcardPreviewProps {
  shareCode: string;
}

const FlashcardPreview: React.FC<FlashcardPreviewProps> = ({ shareCode }) => {
  const [flashcardSet, setFlashcardSet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const response = await flashcardSetsAPI.getShared(shareCode);
        setFlashcardSet(response.data);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [shareCode]);

  if (loading) {
    return (
      <div className="inline-block mx-2 my-1 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  if (error || !flashcardSet) {
    return (
      <div className="inline-block mx-2 my-1 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-xs text-red-600">Flashcard set not found</p>
      </div>
    );
  }

  return (
    <a
      href={`/shared-flashcards?shareCode=${shareCode}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block mx-2 my-1 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">📚</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {flashcardSet.title}
          </h4>
          <p className="text-xs text-gray-600 truncate">
            {flashcardSet.description || 'Flashcard set'}
          </p>
          <p className="text-xs text-gray-500">
            {flashcardSet.cardCount} cards • {flashcardSet.viewCount || 0} views
          </p>
        </div>
      </div>
    </a>
  );
};

export default FlashcardPreview;