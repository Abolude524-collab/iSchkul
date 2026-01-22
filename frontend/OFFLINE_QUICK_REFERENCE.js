#!/usr/bin/env node

/**
 * OFFLINE-FIRST PWA QUICK REFERENCE
 * For iSchkul Frontend Development
 * 
 * Copy-paste examples for common tasks
 */

// ============================================================================
// 1. CHECK IF USER IS ONLINE
// ============================================================================

import { useOfflineStatus } from '@/hooks/useOfflineSupport';

export function MyComponent() {
  const { isOnline } = useOfflineStatus();
  
  return (
    <div>
      {!isOnline && <div className="alert">⚠️ You're offline</div>}
      {isOnline && <div className="success">✓ Connected</div>}
    </div>
  );
}

// ============================================================================
// 2. TAKE A QUIZ OFFLINE (GET INSTANT SCORE)
// ============================================================================

import { useOfflineQuiz } from '@/hooks/useOfflineActions';

export function QuizComponent() {
  const { submitQuizAttempt, result, error } = useOfflineQuiz();
  
  const handleFinishQuiz = async () => {
    const userAnswers = {
      'q1': 0,      // Question ID -> selected answer index
      'q2': [0, 2], // Multiple choice: indices of selected options
      'q3': 1       // True/False
    };
    
    // WORKS OFFLINE! Instant score!
    const result = await submitQuizAttempt(
      quiz,           // Quiz object with questions
      userAnswers,    // User's answers
      timeTaken,      // Time in seconds
      userId          // User ID
    );
    
    if (result) {
      console.log(`Score: ${result.score}%`);
      console.log(`Correct: ${result.correctCount}/${result.totalCount}`);
      console.log(`Feedback: ${result.details[0].explanation}`);
      showResults(result);
    }
  };
  
  return (
    <>
      {/* Quiz UI */}
      <button onClick={handleFinishQuiz}>Submit Quiz</button>
      {result && <ResultsDisplay result={result} />}
      {error && <ErrorDisplay error={error} />}
    </>
  );
}

// ============================================================================
// 3. REVIEW FLASHCARDS OFFLINE
// ============================================================================

import { useOfflineFlashcards } from '@/hooks/useOfflineActions';

export function FlashcardComponent() {
  const { recordReview, isUpdating, error } = useOfflineFlashcards();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  const card = flashcards[currentCardIndex];
  
  const handleCorrect = async () => {
    // User got it right
    await recordReview(
      card._id,      // Flashcard ID
      userId,        // User ID
      true,          // isCorrect
      4              // difficulty (1-5, 5=hard)
    );
    nextCard();
  };
  
  const handleIncorrect = async () => {
    // User got it wrong
    await recordReview(
      card._id,
      userId,
      false,
      2
    );
    nextCard();
  };
  
  return (
    <>
      <div className="flashcard">
        <div className="front">{card.question}</div>
        <div className="back">{card.answer}</div>
      </div>
      
      <button onClick={handleCorrect} disabled={isUpdating}>
        ✓ Got It
      </button>
      <button onClick={handleIncorrect} disabled={isUpdating}>
        ✗ Again
      </button>
      
      {error && <ErrorDisplay error={error} />}
    </>
  );
}

// ============================================================================
// 4. SHOW SYNC STATUS
// ============================================================================

import SyncStatus from '@/components/SyncStatus';

export function Dashboard() {
  return (
    <>
      {/* Sync status button in corner */}
      <SyncStatus token={userToken} onSyncComplete={handleSyncDone} />
      
      {/* Rest of dashboard */}
    </>
  );
}

// ============================================================================
// 5. MANUAL SYNC TRIGGER
// ============================================================================

import { fullSync } from '@/services/syncManager';

async function manualSync(token: string) {
  const result = await fullSync(token);
  
  console.log(`Synced: ${result.synced}`);
  console.log(`Failed: ${result.failed}`);
  
  if (result.success) {
    console.log('✓ All items synced!');
  } else {
    console.log('⚠️ Some items failed, will retry');
  }
  
  return result;
}

// ============================================================================
// 6. CHECK OFFLINE STORAGE
// ============================================================================

import {
  getUnsyncedAttempts,
  getUnsyncedActions,
  getDatabaseStats
} from '@/services/indexedDB';

async function checkStorage() {
  // How many pending?
  const attempts = await getUnsyncedAttempts();
  const actions = await getUnsyncedActions();
  console.log(`Pending: ${attempts.length} attempts, ${actions.length} actions`);
  
  // Storage usage
  const stats = await getDatabaseStats();
  console.log('Database stats:', stats);
  
  // Browser storage quota
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const used = (estimate.usage / 1024 / 1024).toFixed(2);
    const quota = (estimate.quota / 1024 / 1024).toFixed(2);
    console.log(`Storage: ${used}MB / ${quota}MB`);
  }
}

// ============================================================================
// 7. SAVE QUIZ FOR OFFLINE
// ============================================================================

import { saveQuiz, getQuiz } from '@/services/indexedDB';

async function downloadQuizForOffline(quizId: string) {
  // Get quiz from API
  const response = await fetch(`/api/quizzes/${quizId}`);
  const quiz = await response.json();
  
  // Save to IndexedDB (persists!)
  await saveQuiz(quiz);
  console.log('✓ Quiz saved for offline!');
}

async function useOfflineQuiz(quizId: string) {
  const quiz = await getQuiz(quizId);
  
  if (!quiz) {
    console.log('Not cached - download first');
    return null;
  }
  
  return quiz;
}

// ============================================================================
// 8. SAVE FLASHCARD SET FOR OFFLINE
// ============================================================================

import { 
  saveFlashcardSet,
  saveFlashcards,
  getFlashcardSet,
  getFlashcardsBySet
} from '@/services/indexedDB';

async function downloadFlashcardsForOffline(setId: string) {
  // Get set and cards from API
  const setResponse = await fetch(`/api/flashcards/sets/${setId}`);
  const set = await setResponse.json();
  
  const cardsResponse = await fetch(`/api/flashcards/sets/${setId}/cards`);
  const cards = await cardsResponse.json();
  
  // Save to IndexedDB
  await saveFlashcardSet(set);
  await saveFlashcards(cards);
  console.log(`✓ Saved ${cards.length} flashcards!`);
}

async function useOfflineFlashcards(setId: string) {
  const set = await getFlashcardSet(setId);
  const cards = await getFlashcardsBySet(setId);
  
  if (!set || cards.length === 0) {
    console.log('Not cached - download first');
    return null;
  }
  
  return { set, cards };
}

// ============================================================================
// 9. AUTO-SYNC WHEN ONLINE
// ============================================================================

import { useSyncListener } from '@/hooks/useOfflineSupport';

export function AppComponent() {
  useSyncListener(async () => {
    console.log('🟢 Back online! Syncing...');
    const result = await fullSync(token);
    console.log(`✓ Synced ${result.synced} items`);
    
    // Refresh UI
    setQuizzes([...quizzes]); // Force re-render
  });
  
  return <div>App</div>;
}

// ============================================================================
// 10. SCORING UTILITIES
// ============================================================================

import {
  scoreQuiz,
  getGrade,
  getPerformanceFeedback,
  calculateXP,
  formatScore
} from '@/services/offlineScoringEngine';

function displayResults(quiz, userAnswers, timeTaken) {
  // Score the quiz
  const result = scoreQuiz(quiz.questions, userAnswers, timeTaken);
  
  // Get feedback
  const grade = getGrade(result.score);
  const feedback = getPerformanceFeedback(result.percentage);
  const xp = calculateXP(result, 'medium');
  
  console.log(`Score: ${formatScore(result)}`);
  console.log(`Grade: ${grade}`);
  console.log(`Feedback: ${feedback}`);
  console.log(`XP Earned: ${xp}`);
  
  // Show detailed results
  result.details.forEach((detail, i) => {
    console.log(`Q${i + 1}: ${detail.correct ? '✓' : '✗'}`);
    console.log(`  Your answer: ${detail.userAnswer}`);
    console.log(`  Correct: ${detail.correctAnswer}`);
    console.log(`  Explanation: ${detail.explanation}`);
  });
}

// ============================================================================
// 11. DISPLAY SYNC STATUS IN UI
// ============================================================================

import { useOfflineStatus } from '@/hooks/useOfflineSupport';
import { getUnsyncedActions } from '@/services/indexedDB';

export function SyncIndicator() {
  const { isOnline } = useOfflineStatus();
  const [pending, setPending] = useState(0);
  
  useEffect(() => {
    getUnsyncedActions().then(setPending);
  }, [isOnline]);
  
  if (!isOnline) {
    return (
      <div className="badge offline">
        🔴 Offline
      </div>
    );
  }
  
  if (pending.length > 0) {
    return (
      <div className="badge pending">
        ⏳ Syncing {pending.length}...
      </div>
    );
  }
  
  return (
    <div className="badge online">
      ✓ Synced
    </div>
  );
}

// ============================================================================
// 12. HANDLE OFFLINE ERRORS
// ============================================================================

export function SafeQuizSubmit() {
  const { submitQuizAttempt, error, isSubmitting } = useOfflineQuiz();
  
  const handleSubmit = async () => {
    try {
      const result = await submitQuizAttempt(quiz, answers, time, userId);
      
      if (!result) {
        // Error occurred
        if (error.includes('storage')) {
          alert('Storage full! Clear old attempts.');
        } else {
          alert(`Error: ${error}`);
        }
        return;
      }
      
      // Success!
      showResults(result);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Something went wrong. Try again.');
    }
  };
  
  return (
    <button onClick={handleSubmit} disabled={isSubmitting}>
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </button>
  );
}

// ============================================================================
// 13. MIGRATE ONLINE QUIZ TO OFFLINE
// ============================================================================

import { saveQuiz } from '@/services/indexedDB';

// When user downloads quiz from main app
export async function downloadQuiz(quizId) {
  try {
    // Fetch from API
    const response = await axios.get(`/api/quizzes/${quizId}`);
    const quiz = response.data;
    
    // Save for offline
    await saveQuiz(quiz);
    
    // Show success
    toast.success('✓ Quiz saved for offline!');
  } catch (error) {
    toast.error('Failed to save quiz');
  }
}

// ============================================================================
// 14. CHECK SERVICE WORKER STATUS
// ============================================================================

export function ServiceWorkerStatus() {
  const { swReady, updateAvailable, updateApp } = useServiceWorker();
  
  if (!swReady) {
    return <div>Initializing offline support...</div>;
  }
  
  if (updateAvailable) {
    return (
      <div className="alert">
        <p>A new version is available!</p>
        <button onClick={updateApp}>Update Now</button>
      </div>
    );
  }
  
  return <div className="success">✓ Offline support ready</div>;
}

// ============================================================================
// 15. BATCH OPERATIONS
// ============================================================================

// Save multiple quizzes at once
async function saveQuizzesForOffline(quizzes) {
  for (const quiz of quizzes) {
    await saveQuiz(quiz);
  }
  console.log(`✓ Saved ${quizzes.length} quizzes`);
}

// Get all quizzes by user
import { getQuizzesByUser } from '@/services/indexedDB';

async function loadUserQuizzes(userId) {
  const quizzes = await getQuizzesByUser(userId);
  return quizzes;
}

console.log('✅ PWA Offline System Ready!');
console.log('📖 See OFFLINE_PWA_GUIDE.js for full documentation');
console.log('🚀 Copy examples above into your components');
