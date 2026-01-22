/**
 * INTEGRATION EXAMPLE: Flashcard Page with Offline Download Button
 * 
 * Add the OfflineDownloadButton component to your flashcard display
 * Shows users an explicit button to download flashcard sets for offline use
 */

// ===== ADD TO YOUR FLASHCARD COMPONENT =====

import OfflineDownloadButton from '@/components/OfflineDownloadButton';
import { useDownloadFlashcardSetOffline } from '@/hooks/useDownloadOffline';

/**
 * Example integration in flashcard list/grid component
 */
const FlashcardSetCard = ({ set, onSelectSet }) => {
  const { downloadFlashcardSet } = useDownloadFlashcardSetOffline();

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      {/* Set Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {set.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {set.cardCount || 0} cards
        </p>
      </div>

      {/* Set Description */}
      {set.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {set.description}
        </p>
      )}

      {/* Tags */}
      {set.tags && set.tags.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {set.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions Row */}
      <div className="flex gap-2">
        {/* DOWNLOAD FOR OFFLINE BUTTON - NEW */}
        <OfflineDownloadButton
          itemId={set._id}
          itemType="flashcardSet"
          itemTitle={set.title}
          onDownload={downloadFlashcardSet}
        />

        {/* Study Button */}
        <button
          onClick={() => onSelectSet(set)}
          className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Study
        </button>
      </div>
    </div>
  );
};

// ===== ALTERNATIVE: Add to Flashcard Detail Page =====

const FlashcardSetDetailPage = ({ setId }) => {
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState([]);
  const { downloadFlashcardSet } = useDownloadFlashcardSetOffline();

  return (
    <div className="p-6">
      {/* Header with Download Button */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{set?.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {set?.description}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {cards.length} cards • Owner: {set?.owner?.name}
          </p>
        </div>

        {/* Prominent Download Button */}
        <OfflineDownloadButton
          itemId={setId}
          itemType="flashcardSet"
          itemTitle={set?.title || 'Flashcard Set'}
          onDownload={downloadFlashcardSet}
        />
      </div>

      {/* Cards Display */}
      <div className="space-y-3">
        {cards.map((card) => (
          <div key={card._id} className="border rounded-lg p-4">
            <p className="font-semibold text-gray-900 dark:text-white">
              {card.question}
            </p>
            <details className="mt-2">
              <summary className="text-indigo-600 dark:text-indigo-400 cursor-pointer">
                Reveal Answer
              </summary>
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                {card.answer}
              </p>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== FLASHCARD SETS LIST PAGE =====

const AllFlashcardSetsPage = () => {
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const { downloadFlashcardSet } = useDownloadFlashcardSetOffline();

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Flashcard Sets</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Download sets for offline study or start studying online
        </p>
      </div>

      {/* Filter/Sort Bar */}
      <div className="flex gap-4 mb-6">
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          📥 Download All for Offline
        </button>
        <select className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
          <option>All Subjects</option>
          <option>Math</option>
          <option>Science</option>
          <option>History</option>
        </select>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map((set) => (
          <FlashcardSetCard
            key={set._id}
            set={set}
            onSelectSet={setSelectedSet}
          />
        ))}
      </div>

      {/* Modal/Detail View for Selected Set */}
      {selectedSet && (
        <FlashcardStudyModal
          set={selectedSet}
          onClose={() => setSelectedSet(null)}
        />
      )}
    </div>
  );
};

// ===== FLASHCARD STUDY PAGE - SHOW OFFLINE STATUS =====

const FlashcardStudyPage = ({ setId }) => {
  const [set, setSet] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { downloadFlashcardSet } = useDownloadFlashcardSetOffline();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentCard = cards[currentCardIndex];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Status Badge */}
      {isOffline && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
          <span className="text-2xl">📴</span>
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Offline Mode
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Download this set to study without internet
            </p>
          </div>
        </div>
      )}

      {/* Header with Download */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{set?.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {cards.length} cards • Card {currentCardIndex + 1} of {cards.length}
          </p>
        </div>

        {/* Download Button - Top Right */}
        <OfflineDownloadButton
          itemId={setId}
          itemType="flashcardSet"
          itemTitle={set?.title || 'Flashcard Set'}
          onDownload={downloadFlashcardSet}
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{
              width: `${((currentCardIndex + 1) / cards.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Flashcard */}
      {currentCard && (
        <div className="mb-6">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="h-64 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-8 flex items-center justify-center cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="text-center text-white">
              <p className="text-sm font-medium mb-2 opacity-75">
                {isFlipped ? 'Answer' : 'Question'}
              </p>
              <p className="text-2xl font-semibold">
                {isFlipped ? currentCard.answer : currentCard.question}
              </p>
              <p className="text-xs mt-4 opacity-50">
                Click to {isFlipped ? 'hide' : 'reveal'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
          disabled={currentCardIndex === 0}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          ← Previous
        </button>

        <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          ✓ Correct
        </button>

        <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          ✗ Needs Review
        </button>

        <button
          onClick={() =>
            setCurrentCardIndex(Math.min(cards.length - 1, currentCardIndex + 1))
          }
          disabled={currentCardIndex === cards.length - 1}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export {
  FlashcardSetCard,
  FlashcardSetDetailPage,
  AllFlashcardSetsPage,
  FlashcardStudyPage,
};
