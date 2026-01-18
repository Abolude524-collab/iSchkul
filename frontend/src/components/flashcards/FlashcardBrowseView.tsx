import React from 'react';
import { BookOpen, Clock, TrendingUp, Sparkles, Plus, Zap, Edit, Trash2, FileText } from 'lucide-react';
import { Flashcard, FlashcardSet } from '../../types/flashcards';

interface Props {
  flashcards: Flashcard[];
  dueCards: Flashcard[];
  currentSet: FlashcardSet | null;
  onStartReview: () => void;
  onGenerate: () => void;
  onAddCard: () => void;
  showAddCard: boolean;
  newCard: { front: string; back: string; difficulty: string; tags: string };
  setNewCard: (card: { front: string; back: string; difficulty: string; tags: string }) => void;
  onAddCardSubmit: (e: React.FormEvent) => void;
  mode: 'manual' | 'generated';
  onExportSet?: () => void;
  onDownloadCard?: (cardId: string) => void;
}

const FlashcardBrowseView: React.FC<Props> = React.memo(({ flashcards, dueCards, currentSet, onStartReview, onGenerate, onAddCard, showAddCard, newCard, setNewCard, onAddCardSubmit, mode, onExportSet, onDownloadCard }) => {
  const masteryPercentage = React.useMemo(() => {
    if (flashcards.length === 0) return 0;
    const totalRate = flashcards.reduce((sum, card) => sum + card.successRate, 0);
    return ((totalRate / flashcards.length) * 100).toFixed(0);
  }, [flashcards]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <BookOpen size={24} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Cards</h3>
          </div>
          <p className="text-3xl font-black text-gray-900">{flashcards.length}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
              <Clock size={24} className="text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Due Today</h3>
          </div>
          <p className="text-3xl font-black text-gray-900">{dueCards.length}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} className="text-green-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Mastery</h3>
          </div>
          <p className="text-3xl font-black text-gray-900">
            {masteryPercentage}%
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {mode === 'generated' && (
          <button onClick={onGenerate} className="px-6 py-3 bg-gray-900 text-white rounded-2xl hover:bg-blue-600 transition-all flex items-center gap-2 font-bold shadow-lg shadow-gray-200 active:scale-95">
            <Sparkles size={18} /> Generate More
          </button>
        )}
        {mode === 'manual' && (
          <button onClick={onAddCard} className="px-6 py-3 bg-gray-900 text-white rounded-2xl hover:bg-blue-600 transition-all flex items-center gap-2 font-bold shadow-lg shadow-gray-200 active:scale-95">
            <Plus size={18} /> Add New Card
          </button>
        )}
        {dueCards.length > 0 && (
          <button onClick={onStartReview} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl hover:shadow-xl transition-all flex items-center gap-2 font-bold active:scale-95">
            <Zap size={18} /> Study Due Cards ({dueCards.length})
          </button>
        )}
        {onExportSet && currentSet && (
          <button onClick={onExportSet} className="px-6 py-3 border border-gray-200 bg-white text-gray-700 rounded-2xl hover:bg-gray-50 transition-all flex items-center gap-2 font-bold active:scale-95">
            <BookOpen size={18} /> Export PDF
          </button>
        )}
      </div>

      {flashcards.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              {currentSet ? currentSet.title : 'Collection Cards'}
            </h3>
            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {flashcards.length} CARDS
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {flashcards.map((card, index) => (
              <div
                key={card._id}
                className="group bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-2">Prompt</span>
                      <p className="text-gray-900 font-bold leading-relaxed">{card.front}</p>
                    </div>
                    <div className="md:border-l md:pl-6 border-gray-100">
                      <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest block mb-2">Response</span>
                      <p className="text-gray-600 leading-relaxed italic">{card.back}</p>
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-between items-end gap-4 border-t md:border-t-0 md:border-l border-gray-50 pt-4 md:pt-0 md:pl-6">
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${card.difficulty === 'easy' ? 'bg-green-50 text-green-600 shadow-sm shadow-green-100' :
                        card.difficulty === 'medium' ? 'bg-yellow-50 text-yellow-600 shadow-sm shadow-yellow-100' :
                          'bg-red-50 text-red-600 shadow-sm shadow-red-100'
                        }`}>
                        {card.difficulty}
                      </span>
                      <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                        {(card.successRate * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {onDownloadCard && currentSet && (
                        <button
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                          title="Download Card"
                          onClick={() => onDownloadCard(card._id)}
                        >
                          <FileText size={18} />
                        </button>
                      )}
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit Card"><Edit size={18} /></button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete Card"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 sm:p-20 rounded-[3rem] shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <BookOpen size={48} className="text-gray-200" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-4">Your deck is empty</h3>
          <p className="text-gray-500 mb-10 max-w-sm mx-auto leading-relaxed">
            {mode === 'manual'
              ? 'Start by adding your first flashcard manually. You can also upload a CSV.'
              : 'Our AI is ready to help! Upload your notes to generate a set of flashcards.'}
          </p>
          {mode === 'manual' ? (
            <button onClick={onAddCard} className="px-10 py-4 bg-gray-900 text-white rounded-2xl hover:bg-blue-600 transition-all font-bold shadow-xl shadow-gray-100 active:scale-95">
              Create First Card
            </button>
          ) : (
            <button onClick={onGenerate} className="px-10 py-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all font-bold shadow-xl shadow-purple-100 active:scale-95">
              Start Generating
            </button>
          )}
        </div>
      )}

      {showAddCard && (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Add New Card</h3>
          <form onSubmit={onAddCardSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Front (Question)</label>
              <textarea value={newCard.front} onChange={(e) => setNewCard({ ...newCard, front: e.target.value })} placeholder="Enter the question or prompt..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base" rows={3} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Back (Answer)</label>
              <textarea value={newCard.back} onChange={(e) => setNewCard({ ...newCard, back: e.target.value })} placeholder="Enter the answer or explanation..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base" rows={3} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Difficulty</label>
                <select value={newCard.difficulty} onChange={(e) => setNewCard({ ...newCard, difficulty: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Tags (optional)</label>
                <input type="text" value={newCard.tags} onChange={(e) => setNewCard({ ...newCard, tags: e.target.value })} placeholder="comma-separated tags" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base">Add Card</button>
              <button type="button" onClick={onAddCard} className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});

export default FlashcardBrowseView;
