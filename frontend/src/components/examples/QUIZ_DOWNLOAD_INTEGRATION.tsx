/**
 * INTEGRATION EXAMPLE: Quiz Page with Offline Download Button
 * 
 * Add the OfflineDownloadButton component to your quiz display page
 * This shows users an explicit button to download quizzes for offline use
 */

// ===== ADD TO YOUR QUIZ COMPONENT =====

import OfflineDownloadButton from '@/components/OfflineDownloadButton';
import { useDownloadQuizOffline } from '@/hooks/useDownloadOffline';

/**
 * Example integration in QuizPage or Quiz list component
 */
const QuizListItem = ({ quiz }) => {
  const { downloadQuiz, loading, error } = useDownloadQuizOffline();

  return (
    <div className="border rounded-lg p-4 mb-4">
      {/* Quiz Title & Description */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {quiz.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {quiz.description}
          </p>
        </div>

        {/* Quiz Metadata */}
        <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{quiz.questions?.length || 0} Questions</span>
          <span>•</span>
          <span>{quiz.difficulty || 'Medium'}</span>
        </div>
      </div>

      {/* Quiz Actions Row */}
      <div className="flex gap-3 items-center">
        {/* DOWNLOAD FOR OFFLINE BUTTON - NEW */}
        <OfflineDownloadButton
          itemId={quiz._id}
          itemType="quiz"
          itemTitle={quiz.title}
          onDownload={downloadQuiz}
        />

        {/* Take Quiz Button */}
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Take Quiz
        </button>

        {/* Preview Button */}
        <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          Preview
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

// ===== ALTERNATIVE: Add to Quiz Detail Page =====

const QuizDetailPage = ({ quizId }) => {
  const [quiz, setQuiz] = useState(null);
  const { downloadQuiz } = useDownloadQuizOffline();

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{quiz?.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {quiz?.description}
          </p>
        </div>

        {/* Download Button - Prominent Position */}
        <OfflineDownloadButton
          itemId={quizId}
          itemType="quiz"
          itemTitle={quiz?.title || 'Quiz'}
          onDownload={downloadQuiz}
        />
      </div>

      {/* Quiz Content */}
      <div className="space-y-4">
        {/* Quiz questions rendered here */}
      </div>
    </div>
  );
};

// ===== QUIZ LIST PAGE WITH DOWNLOAD FOR ALL =====

const AllQuizzesPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const { downloadQuiz } = useDownloadQuizOffline();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Available Quizzes</h1>

      {/* Filter/Sort Bar */}
      <div className="flex gap-4 mb-6">
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
          Download All for Offline
        </button>
        <select className="px-4 py-2 border rounded-lg">
          <option>All Subjects</option>
        </select>
      </div>

      {/* Quiz Grid - Each with Download Button */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quizzes.map((quiz) => (
          <div
            key={quiz._id}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            {/* Card Header */}
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {quiz.title}
            </h3>

            {/* Card Metadata */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <p>{quiz.questions?.length} Questions</p>
              <p>{quiz.difficulty}</p>
            </div>

            {/* Download Button - Card Action */}
            <div className="mb-3">
              <OfflineDownloadButton
                itemId={quiz._id}
                itemType="quiz"
                itemTitle={quiz.title}
                onDownload={downloadQuiz}
              />
            </div>

            {/* Card Actions */}
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                Take
              </button>
              <button className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded">
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== QUIZ ATTEMPT PAGE - SHOW ALREADY DOWNLOADED =====

const QuizAttemptPage = ({ quizId }) => {
  const [quiz, setQuiz] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { downloadQuiz } = useDownloadQuizOffline();

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

  return (
    <div className="p-6">
      {/* Status Badge */}
      {isOffline && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
          <span className="text-2xl">📴</span>
          <span className="font-medium text-amber-800 dark:text-amber-200">
            You're offline - Make sure this quiz is downloaded below before starting
          </span>
        </div>
      )}

      {/* Quiz Info with Download Button */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{quiz?.title}</h1>
          <p className="text-gray-600 mt-1">{quiz?.questions?.length} questions</p>
        </div>

        {/* Prominent Download Button */}
        <OfflineDownloadButton
          itemId={quizId}
          itemType="quiz"
          itemTitle={quiz?.title || 'Quiz'}
          onDownload={downloadQuiz}
        />
      </div>

      {/* Quiz Questions */}
      <div className="space-y-4">
        {/* Questions rendered here */}
      </div>
    </div>
  );
};

export {
  QuizListItem,
  QuizDetailPage,
  AllQuizzesPage,
  QuizAttemptPage,
};
