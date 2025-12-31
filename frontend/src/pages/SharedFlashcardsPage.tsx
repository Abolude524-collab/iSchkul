import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { flashcardSetsAPI } from '../services/api';
import { useAuthStore } from '../services/store';
import { Loader, ArrowLeft, ArrowRight, RotateCcw, Heart, Share2, UserPlus, LogIn } from 'lucide-react';

interface Flashcard {
  _id: string;
  front: string;
  back: string;
  difficulty: string;
  tags: string[];
}

interface FlashcardSet {
  _id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  cardCount: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  flashcards: Flashcard[];
}

export const SharedFlashcardsPage: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);

  useEffect(() => {
    if (!shareCode) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }
    loadSharedSet();
  }, [shareCode]);

  const loadSharedSet = async () => {
    try {
      setLoading(true);
      const response = await flashcardSetsAPI.getPublicSet(shareCode!);
      setFlashcardSet(response.data.flashcardSet);

      // Show join prompt after a short delay for non-registered users
      if (!user) {
        setTimeout(() => setShowJoinPrompt(true), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCardFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    if (!flashcardSet) return;
    setCurrentCardIndex((prev) => (prev + 1) % flashcardSet.flashcards.length);
    setIsFlipped(false);
  };

  const handlePrevCard = () => {
    if (!flashcardSet) return;
    setCurrentCardIndex((prev) => (prev - 1 + flashcardSet.flashcards.length) % flashcardSet.flashcards.length);
    setIsFlipped(false);
  };

  const handleJoinNow = () => {
    navigate('/signup');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading flashcards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Flashcard Set Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!flashcardSet) return null;

  const currentCard = flashcardSet.flashcards[currentCardIndex];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{flashcardSet.title}</h1>
            {flashcardSet.subject && (
              <p className="text-blue-600 font-medium">{flashcardSet.subject}</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{flashcardSet.cardCount} cards</span>
            <span>{flashcardSet.viewCount} views</span>
          </div>
        </div>
      </div>

      <div className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
        {/* Description */}
        {flashcardSet.description && (
          <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <p className="text-gray-700">{flashcardSet.description}</p>
            {flashcardSet.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {flashcardSet.tags.map((tag, index) => (
                  <span key={index} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flashcard Viewer */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{currentCardIndex + 1} of {flashcardSet.flashcards.length}</span>
            </div>
          </div>

          <div className="flex items-center justify-center mb-6">
            <div
              className="w-full max-w-lg h-80 cursor-pointer perspective-1000"
              onClick={handleCardFlip}
            >
              <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front of card */}
                <div className="absolute inset-0 w-full h-full backface-hidden">
                  <div className="w-full h-full bg-white rounded-xl shadow-lg border border-gray-200 p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-lg text-gray-900 whitespace-pre-wrap">
                        {currentCard.front}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      Click to reveal answer
                    </div>
                  </div>
                </div>

                {/* Back of card */}
                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                  <div className="w-full h-full bg-blue-50 rounded-xl shadow-lg border border-blue-200 p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-lg text-gray-900 whitespace-pre-wrap">
                        {currentCard.back}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-blue-600">
                      Answer
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrevCard}
              className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={flashcardSet.flashcards.length <= 1}
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>

            <button
              onClick={handleCardFlip}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={18} />
              {isFlipped ? 'Show Question' : 'Show Answer'}
            </button>

            <button
              onClick={handleNextCard}
              className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={flashcardSet.flashcards.length <= 1}
            >
              <ArrowRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Join Prompt for Non-Registered Users */}
        {showJoinPrompt && !user && (
          <div className="fixed bottom-6 right-6 max-w-sm">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Heart className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-1">Enjoying these flashcards?</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Join our platform to create your own sets, track progress, and study with spaced repetition!
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleJoinNow}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <UserPlus size={16} />
                      Join Now
                    </button>
                    <button
                      onClick={handleLogin}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <LogIn size={16} />
                      Login
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowJoinPrompt(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Shared via IschKul - Study smarter together</p>
        </div>
      </div>
    </div>
  );
};