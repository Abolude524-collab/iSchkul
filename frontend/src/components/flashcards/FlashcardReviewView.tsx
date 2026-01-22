import React from 'react';
import { ArrowLeft, ChevronRight, Brain, Target, Star, Zap } from 'lucide-react';
import { Flashcard } from '../../types/flashcards';

interface Props {
  dueCards: Flashcard[];
  currentCardIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onReview: (quality: number) => void;
  onNextCard: () => void;
  onPrevCard: () => void;
}

const FlashcardReviewView: React.FC<Props> = ({ dueCards, currentCardIndex, isFlipped, onFlip, onReview, onNextCard, onPrevCard }) => {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (currentCardIndex > 0) onPrevCard();
      } else if (e.key === 'ArrowRight') {
        onNextCard();
      } else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        onFlip();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentCardIndex, onFlip, onNextCard, onPrevCard]);

  const atFirst = currentCardIndex <= 0;
  const atLast = currentCardIndex >= dueCards.length - 1;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Review Session</h2>
          <span className="text-sm text-gray-500">{currentCardIndex + 1} of {dueCards.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 sm:h-3 rounded-full transition-all duration-300" style={{ width: `${((currentCardIndex + 1) / Math.max(1, dueCards.length)) * 100}%` }} />
        </div>
      </div>

      {dueCards.length > 0 && (
        <div className="max-w-2xl mx-auto perspective-1000">
          <div
            className={`relative w-full h-[350px] sm:h-[400px] transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''
              }`}
            onClick={onFlip}
          >
            {/* Front Side */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center justify-center p-6 sm:p-8 text-center group overflow-hidden">
              <div className="absolute top-4 left-4 bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Question
              </div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Brain className="text-white w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="max-h-[200px] sm:max-h-[220px] overflow-y-auto custom-scrollbar w-full px-2">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 leading-relaxed">
                  {dueCards[currentCardIndex].front}
                </p>
              </div>
              <div className="mt-4 sm:mt-8 text-sm text-gray-400 font-medium animate-pulse">
                Click to reveal answer
              </div>
            </div>

            {/* Back Side */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-6 sm:p-8 text-center text-white overflow-hidden">
              {/* Decorative Circles */}
              <div className="absolute -top-10 -right-10 w-32 h-32 sm:w-40 sm:h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 sm:w-40 sm:h-40 bg-pink-500/20 rounded-full blur-2xl" />

              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Answer
              </div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                <Target className="text-white w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="max-h-[200px] sm:max-h-[220px] overflow-y-auto custom-scrollbar w-full px-2">
                <p className="text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed">
                  {dueCards[currentCardIndex].back}
                </p>
              </div>
              <div className="mt-4 sm:mt-8 text-sm text-indigo-100 font-medium">
                Click to flip back
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); if (!atFirst) onPrevCard(); }}
                disabled={atFirst}
                className={`p-2 rounded-lg transition-all ${atFirst ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100 active:scale-95'
                  }`}
                title="Previous card"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNextCard(); }}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                title="Next card"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {!isFlipped ? (
              <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                Press Space to flip
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-500">Rate your understanding</span>
            )}
          </div>

          {isFlipped && (
            <div className="mt-4 p-6 glass rounded-2xl border border-white/50 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => onReview(1)}
                  className="group flex flex-col items-center gap-2 p-3 bg-white hover:bg-red-50 text-red-600 rounded-xl border border-red-100 hover:border-red-200 transition-all hover:shadow-md"
                >
                  <Star size={20} className="group-hover:fill-red-600" />
                  <span className="text-xs font-bold uppercase tracking-tighter">Again</span>
                </button>
                <button
                  onClick={() => onReview(2)}
                  className="group flex flex-col items-center gap-2 p-3 bg-white hover:bg-orange-50 text-orange-600 rounded-xl border border-orange-100 hover:border-orange-200 transition-all hover:shadow-md"
                >
                  <Star size={20} className="group-hover:fill-orange-600" />
                  <span className="text-xs font-bold uppercase tracking-tighter">Hard</span>
                </button>
                <button
                  onClick={() => onReview(3)}
                  className="group flex flex-col items-center gap-2 p-3 bg-white hover:bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:border-blue-200 transition-all hover:shadow-md"
                >
                  <Star size={20} className="group-hover:fill-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-tighter">Good</span>
                </button>
                <button
                  onClick={() => onReview(4)}
                  className="group flex flex-col items-center gap-2 p-3 bg-white hover:bg-green-50 text-green-600 rounded-xl border border-green-100 hover:border-green-200 transition-all hover:shadow-md"
                >
                  <Star size={20} className="group-hover:fill-green-600" />
                  <span className="text-xs font-bold uppercase tracking-tighter">Easy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlashcardReviewView;
