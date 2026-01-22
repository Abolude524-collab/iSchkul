# 📥 Offline Download Buttons - Implementation Guide

## Overview

This guide shows you how to add **explicit "Save for Offline" buttons** to your Quiz and Flashcard pages. Users will see:
- ✅ Clear download buttons
- ✅ Download progress indicators
- ✅ "Offline Available" badges when saved
- ✅ Storage usage stats

---

## 🎯 What We Built

### Components Created
1. **`OfflineDownloadButton.tsx`** - Reusable download button with states
2. **`useOfflineDownload.ts`** - Custom hooks for quiz/flashcard downloads

### Features
- **Visual States**: Idle → Downloading → Downloaded → Error
- **Storage Management**: Check available space before download
- **Progress Tracking**: Show download percentage
- **User Feedback**: Clear success/error messages
- **Indicators**: Badges showing "Offline Available"

---

## 📂 Files Created

```
frontend/src/
├── components/
│   └── OfflineDownloadButton.tsx    # Download button component
├── hooks/
│   └── useOfflineDownload.ts         # Download logic hooks
└── pages/ (examples)
    ├── QuizDetailPage-EXAMPLE.tsx    # How to integrate in quiz page
    └── FlashcardSetPage-EXAMPLE.tsx  # How to integrate in flashcard page
```

---

## 🎨 Component Usage

### Basic Download Button

```tsx
import { OfflineDownloadButton } from '@/components/OfflineDownloadButton';

<OfflineDownloadButton
  type="quiz"
  itemId={quizId}
  itemData={quizData}
  onDownloadComplete={() => console.log('Downloaded!')}
/>
```

### Download Button States

```tsx
// Not downloaded yet
<button>📥 Save for Offline</button>

// Downloading (with progress)
<button disabled>⏳ Downloading... 45%</button>

// Already downloaded
<button>✅ Offline Available</button>

// Error state
<button>❌ Download Failed - Retry</button>
```

---

## 🔧 Integration Examples

### 1. Quiz Detail Page

```tsx
import { OfflineDownloadButton } from '@/components/OfflineDownloadButton';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';

function QuizDetailPage() {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const { isDownloaded, checkIfDownloaded } = useOfflineDownload();

  useEffect(() => {
    // Check if quiz is already downloaded
    checkIfDownloaded('quiz', quizId);
  }, [quizId]);

  return (
    <div className="quiz-detail">
      <div className="quiz-header">
        <h1>{quiz?.title}</h1>
        
        {/* Download Button */}
        <OfflineDownloadButton
          type="quiz"
          itemId={quizId}
          itemData={quiz}
          onDownloadComplete={() => {
            toast.success('Quiz saved for offline use!');
          }}
        />
      </div>

      {/* Show badge if offline available */}
      {isDownloaded && (
        <div className="badge badge-success">
          ✅ Offline Available
        </div>
      )}

      {/* Quiz content */}
      <QuizQuestions questions={quiz?.questions} />
    </div>
  );
}
```

### 2. Flashcard Set Page

```tsx
import { OfflineDownloadButton } from '@/components/OfflineDownloadButton';

function FlashcardSetPage() {
  const { setId } = useParams();
  const [flashcardSet, setFlashcardSet] = useState(null);
  const [cards, setCards] = useState([]);

  return (
    <div className="flashcard-set">
      <div className="set-header">
        <h1>{flashcardSet?.title}</h1>
        <p>{cards.length} cards</p>

        {/* Download Button */}
        <OfflineDownloadButton
          type="flashcard"
          itemId={setId}
          itemData={{
            set: flashcardSet,
            cards: cards
          }}
          onDownloadComplete={() => {
            toast.success('Flashcard set saved for offline!');
          }}
        />
      </div>

      <FlashcardViewer cards={cards} />
    </div>
  );
}
```

### 3. Quiz List Page (Bulk Download)

```tsx
function QuizListPage() {
  const [quizzes, setQuizzes] = useState([]);

  return (
    <div className="quiz-list">
      {quizzes.map(quiz => (
        <div key={quiz._id} className="quiz-card">
          <h3>{quiz.title}</h3>
          <p>{quiz.questions.length} questions</p>

          {/* Download button on each quiz card */}
          <OfflineDownloadButton
            type="quiz"
            itemId={quiz._id}
            itemData={quiz}
            size="small"
          />
        </div>
      ))}
    </div>
  );
}
```

---

## 🎭 Component Props

### OfflineDownloadButton Props

```typescript
interface OfflineDownloadButtonProps {
  type: 'quiz' | 'flashcard';           // Type of content
  itemId: string;                       // Quiz ID or Set ID
  itemData: any;                        // Full quiz/flashcard data
  onDownloadComplete?: () => void;      // Callback after download
  onDownloadError?: (error: Error) => void;  // Error callback
  size?: 'small' | 'medium' | 'large';  // Button size
  variant?: 'primary' | 'secondary';    // Button style
  showProgress?: boolean;               // Show progress bar
  className?: string;                   // Custom CSS classes
}
```

---

## 🎨 Styling Options

### Default Styles
The button comes with built-in styles, but you can customize:

```tsx
// Small button for cards
<OfflineDownloadButton
  type="quiz"
  itemId={id}
  itemData={data}
  size="small"
  className="my-custom-class"
/>

// Large button for detail pages
<OfflineDownloadButton
  type="quiz"
  itemId={id}
  itemData={data}
  size="large"
  variant="primary"
  showProgress={true}
/>
```

### Custom Styling

```css
/* Override button styles */
.offline-download-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 12px 24px;
  font-weight: 600;
}

.offline-download-btn.downloaded {
  background: #10b981;
}

.offline-download-btn.downloading {
  background: #f59e0b;
  cursor: wait;
}
```

---

## 🔍 Hook Usage

### useOfflineDownload Hook

```typescript
const {
  // Download quiz
  downloadQuiz,
  
  // Download flashcard set
  downloadFlashcardSet,
  
  // Check if already downloaded
  isDownloaded,
  checkIfDownloaded,
  
  // Download state
  isDownloading,
  progress,
  error,
  
  // Storage info
  storageUsed,
  storageAvailable
} = useOfflineDownload();
```

### Example: Manual Download

```tsx
function MyCustomButton() {
  const { downloadQuiz, isDownloading, progress } = useOfflineDownload();

  const handleDownload = async () => {
    try {
      await downloadQuiz(quizId, quizData);
      alert('Quiz saved for offline!');
    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  return (
    <button onClick={handleDownload} disabled={isDownloading}>
      {isDownloading ? `Downloading ${progress}%` : 'Save Quiz'}
    </button>
  );
}
```

---

## 📊 Storage Management

### Check Storage Before Download

```tsx
import { checkStorageAvailable } from '@/hooks/useOfflineDownload';

async function handleDownload() {
  const available = await checkStorageAvailable();
  
  if (available < 5 * 1024 * 1024) { // Less than 5MB
    alert('Low storage! Please free up space.');
    return;
  }
  
  // Proceed with download
  await downloadQuiz(quizId, quizData);
}
```

### Display Storage Stats

```tsx
function StorageInfo() {
  const { storageUsed, storageAvailable } = useOfflineDownload();

  return (
    <div className="storage-info">
      <p>Used: {(storageUsed / 1024 / 1024).toFixed(2)} MB</p>
      <p>Available: {(storageAvailable / 1024 / 1024).toFixed(2)} MB</p>
      <progress value={storageUsed} max={storageAvailable} />
    </div>
  );
}
```

---

## 🎯 User Experience Flow

### First-Time Download

```
1. User sees quiz detail page
2. Button shows: "📥 Save for Offline"
3. User clicks button
4. Button changes to: "⏳ Downloading... 0%"
5. Progress updates: "⏳ Downloading... 50%"
6. Download completes: "✅ Offline Available"
7. Badge appears: "Offline Available"
8. Quiz now accessible offline
```

### Already Downloaded

```
1. User sees quiz detail page
2. Button shows: "✅ Offline Available"
3. Badge visible: "Offline Available"
4. User can take quiz offline
5. Click button again = re-download (update)
```

### Download Error

```
1. User clicks download
2. Network error occurs
3. Button shows: "❌ Download Failed"
4. Error message displayed
5. Button shows: "🔄 Retry"
6. User can click to retry
```

---

## 🧪 Testing

### Test Offline Download

```bash
# 1. Start app
npm run dev

# 2. Go to quiz detail page
http://localhost:5173/quizzes/abc123

# 3. Click "Save for Offline"
# → Should see progress bar
# → Should change to "Offline Available"

# 4. Open DevTools
F12 → Application → IndexedDB → ischkul_offline → quizzes
# → Should see quiz stored

# 5. Go offline
Network tab → Offline checkbox

# 6. Try taking quiz
# → Should work without network!
```

### Test Storage Limits

```tsx
// Test with large quiz
const largeQuiz = {
  _id: 'test',
  title: 'Large Quiz',
  questions: Array(1000).fill({ /* question data */ })
};

await downloadQuiz('test', largeQuiz);
// Should handle large data gracefully
```

---

## 📱 Mobile Considerations

### Touch-Friendly Buttons

```tsx
// Larger buttons for mobile
<OfflineDownloadButton
  type="quiz"
  itemId={id}
  itemData={data}
  size="large"  // Easier to tap
  showProgress={true}  // Visual feedback
/>
```

### Storage Warnings

```tsx
// Warn on mobile before downloading
if (isMobile && quizSize > 10 * 1024 * 1024) {
  const confirmed = confirm('This quiz is 10MB. Download?');
  if (!confirmed) return;
}
```

---

## 🎨 Visual Examples

### Button States (Text Representation)

```
┌─────────────────────────┐
│ 📥 Save for Offline     │  ← Not downloaded
└─────────────────────────┘

┌─────────────────────────┐
│ ⏳ Downloading... 45%   │  ← Downloading
└─────────────────────────┘

┌─────────────────────────┐
│ ✅ Offline Available    │  ← Downloaded
└─────────────────────────┘

┌─────────────────────────┐
│ ❌ Failed - Retry       │  ← Error
└─────────────────────────┘
```

### With Badge

```
┌───────────────────────────────────┐
│  Quiz Title                       │
│  20 questions • 30 mins           │
│                                   │
│  ┌─────────────────┐              │
│  │ ✅ Offline      │              │
│  └─────────────────┘              │
│                                   │
│  [✅ Offline Available]           │
└───────────────────────────────────┘
```

---

## 🔧 Advanced Customization

### Custom Download Logic

```tsx
import { useOfflineDownload } from '@/hooks/useOfflineDownload';

function AdvancedDownloadButton() {
  const { downloadQuiz } = useOfflineDownload();
  const [isCustomDownloading, setIsCustomDownloading] = useState(false);

  const handleCustomDownload = async () => {
    setIsCustomDownloading(true);
    
    try {
      // Pre-download validation
      const isValid = await validateQuiz(quizData);
      if (!isValid) {
        throw new Error('Invalid quiz data');
      }

      // Download with custom options
      await downloadQuiz(quizId, {
        ...quizData,
        metadata: {
          downloadedAt: new Date(),
          version: '2.0'
        }
      });

      // Post-download actions
      await logDownloadEvent(quizId);
      showSuccessNotification();
      
    } catch (error) {
      showErrorNotification(error.message);
    } finally {
      setIsCustomDownloading(false);
    }
  };

  return (
    <button onClick={handleCustomDownload} disabled={isCustomDownloading}>
      {isCustomDownloading ? 'Saving...' : 'Save Offline'}
    </button>
  );
}
```

### Batch Download

```tsx
function BatchDownloadButton({ quizzes }) {
  const { downloadQuiz } = useOfflineDownload();
  const [progress, setProgress] = useState(0);

  const downloadAll = async () => {
    for (let i = 0; i < quizzes.length; i++) {
      await downloadQuiz(quizzes[i]._id, quizzes[i]);
      setProgress(((i + 1) / quizzes.length) * 100);
    }
  };

  return (
    <div>
      <button onClick={downloadAll}>
        Download All {quizzes.length} Quizzes
      </button>
      {progress > 0 && (
        <progress value={progress} max={100}>{progress}%</progress>
      )}
    </div>
  );
}
```

---

## 📋 Checklist

### Implementation Checklist
- [ ] Import `OfflineDownloadButton` component
- [ ] Import `useOfflineDownload` hook
- [ ] Add download button to quiz detail page
- [ ] Add download button to flashcard set page
- [ ] Add "Offline Available" badge
- [ ] Test download functionality
- [ ] Test offline access after download
- [ ] Test error handling
- [ ] Test storage limits
- [ ] Test on mobile devices

### User Experience Checklist
- [ ] Button clearly visible
- [ ] Download progress shown
- [ ] Success feedback displayed
- [ ] Error messages helpful
- [ ] Offline badge visible
- [ ] Works on slow connections
- [ ] Works on mobile
- [ ] Intuitive for users

---

## 🚨 Common Issues

### Issue: Download button not appearing
**Solution**: Check if `itemData` is loaded before rendering button

```tsx
{quiz && (
  <OfflineDownloadButton
    type="quiz"
    itemId={quizId}
    itemData={quiz}  // Must be defined
  />
)}
```

### Issue: "Storage quota exceeded"
**Solution**: Check storage before download

```tsx
const available = await checkStorageAvailable();
if (available < requiredSpace) {
  alert('Not enough storage. Please free up space.');
  return;
}
```

### Issue: Button stuck in "Downloading" state
**Solution**: Add timeout and error handling

```tsx
const downloadWithTimeout = async () => {
  const timeout = setTimeout(() => {
    throw new Error('Download timeout');
  }, 30000); // 30 seconds

  try {
    await downloadQuiz(id, data);
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);
    handleError(error);
  }
};
```

---

## 📚 Related Documentation

- `OFFLINE_PWA_IMPLEMENTATION.md` - Full PWA setup
- `OFFLINE_PWA_GUIDE.js` - Architecture details
- `OFFLINE_QUICK_REFERENCE.js` - Code examples

---

## 🎉 Summary

You now have **explicit download buttons** that:
- ✅ Clearly show "Save for Offline"
- ✅ Display download progress
- ✅ Show "Offline Available" when saved
- ✅ Handle errors gracefully
- ✅ Work on mobile and desktop
- ✅ Provide excellent UX

**Users will know exactly which quizzes/flashcards are available offline!** 📥✨
