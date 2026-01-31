# XP System Analysis - Test Creation & Submission

## Current Status: ✅ SUBMISSION XP AWARDED | ❌ CREATION XP MISSING

---

## 1. Test/Quiz Submission XP Logic ✅

### Backend Implementation (`backend1/routes/quizzes.js`)

**File**: [backend1/routes/quizzes.js](backend1/routes/quizzes.js#L279-L390)

#### Endpoint: `POST /api/quizzes/:id/submit`
```javascript
// Lines 346-381
const xpAmount = percentage >= 80 ? 20 : percentage >= 60 ? 15 : 10;
console.log('[submitQuiz] Awarding XP:', xpAmount);

// Method 1: Try using app.locals.awardXp if available
if (req.app && req.app.locals && typeof req.app.locals.awardXp === 'function') {
  const xpResult = await req.app.locals.awardXp(
    String(req.user._id), 
    'QUIZ_COMPLETE', 
    xpAmount, 
    { quizId, quizTitle, quizScore, description }
  );
}

// Method 2: Fallback - direct XP logging + User update
const xpLog = await XpLog.create({
  user_id: req.user._id,
  xp_earned: xpAmount,
  activity_type: 'QUIZ_COMPLETE',
  metadata: {
    quizId: quiz._id.toString(),
    quizTitle: quiz.title,
    quizScore: score,
    description: `Quiz completed with ${percentage}% score`
  }
});

// Update user XP
await User.findByIdAndUpdate(
  req.user._id,
  { $inc: { xp: xpAmount, total_xp: xpAmount } },
  { new: true }
);
```

#### XP Reward Formula
| Score | XP Awarded |
|-------|-----------|
| 80%+ | 20 XP |
| 60-79% | 15 XP |
| <60% | 10 XP |

#### Models Used
- `XpLog` - Activity tracking with schema:
  - `user_id` (ObjectId)
  - `xp_earned` (number)
  - `activity_type` (string: 'QUIZ_COMPLETE')
  - `metadata` (object with quizId, quizTitle, quizScore, description)

- `User` - Updated with `$inc { xp, total_xp }`

---

## 2. Test/Quiz **Creation** XP Logic ❌

### Backend Implementation (`backend1/routes/quizzes.js`)

**File**: [backend1/routes/quizzes.js](backend1/routes/quizzes.js#L11-L56)

#### Endpoint: `POST /api/quizzes/create`
```javascript
// Lines 11-56
router.post('/create', auth, async (req, res) => {
  try {
    const { title, subject, questions, timeLimit, difficulty, isPublic = true } = req.body;

    // Create questions
    const questionDocs = await Question.insertMany(
      questions.map(q => ({
        text: q.question || q.text,
        type: q.type || 'mcq_single',
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctAnswers: q.correctAnswers || [],
        correctAnswerBoolean: q.correctAnswerBoolean,
        explanation: q.explanation || '',
        imageUrl: q.imageUrl || null,
        difficulty: difficulty || 'medium'
      }))
    );

    // Create quiz
    const quiz = new Quiz({
      title,
      subject: subject || 'General',
      questions: questionDocs.map(q => q._id),
      timeLimit: timeLimit || 1800,
      difficulty: difficulty || 'medium',
      isPublic,
      createdBy: req.user._id,
      createdAt: new Date(),
    });

    await quiz.save();

    // ❌ NO XP REWARD HERE!
    res.status(201).json({ quiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});
```

### **Issue**: No XP is awarded when users create a quiz!

---

## 3. Frontend Implementation

### Quiz Creation (`frontend/src/pages/QuizPage.tsx`)

**File**: [frontend/src/pages/QuizPage.tsx](frontend/src/pages/QuizPage.tsx#L696-L725)

```typescript
// Lines 696-725
const createQuiz = async () => {
  if (!createForm.title.trim() || !questions.length) {
    setError('Title and at least one question are required');
    return;
  }

  try {
    setLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await fetch(getAPIEndpoint('/quizzes/create'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...createForm,
        timeLimit: createForm.timeLimit * 60,
        questions,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setQuizzes([data.quiz, ...quizzes]);
      setView('dashboard');
      resetCreateForm();
      // ❌ No XP notification to user
    }
  }
};
```

### Quiz Submission (`frontend/src/pages/QuizPage.tsx`)

**File**: [frontend/src/pages/QuizPage.tsx](frontend/src/pages/QuizPage.tsx#L810-L870)

```typescript
// Lines 810-870
const submitQuiz = async () => {
  try {
    setLoading(true);
    const calculatedScore = calculateScore();
    const timeSpent = Math.round((Date.now() - quizStartTime!) / 1000);

    const token = localStorage.getItem('authToken');
    const response = await fetch(
      getAPIEndpoint(`/quizzes/${selectedQuiz._id}/submit`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: selectedQuiz.questions.map((q, idx) => ({
            questionId: q._id || q.id,
            selectedAnswer: userAnswers[idx]
          })),
          timeSpent,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      setQuizResult({...});
      setSubmitted(true);
      setView('results');
      // ✅ XP awarded on backend, but frontend doesn't notify user
    }
  }
};
```

---

## 4. API Layer

### API Service (`frontend/src/services/api.ts`)

**File**: [frontend/src/services/api.ts](frontend/src/services/api.ts#L77-L83)

```typescript
export const quizAPI = {
  generateQuiz: (text: string, numQuestions: number, createdBy: string, groupId?: string) =>
    apiClient.post('/generate/quiz', { text, numQuestions, createdBy, groupId }),
  getQuiz: (quizId: string) =>
    apiClient.get(`/quizzes/${quizId}`),
  submitQuiz: (quizId: string, answers: any[], userId: string) =>
    apiClient.post(`/quizzes/${quizId}/submit`, { answers, userId }),
}
```

---

## 5. Missing XP Awards

### What's NOT Awarding XP

| Activity | Status | Backend | Frontend |
|----------|--------|---------|----------|
| Create Quiz (manually) | ❌ MISSING | No code | No notification |
| Create Quiz (AI-generated) | ❌ MISSING | No code | No notification |
| Submit Quiz | ✅ IMPLEMENTED | Line 346-381 | Doesn't notify |
| Sync offline quiz | ✅ IMPLEMENTED | Line 259-277 | N/A (mobile) |

---

## 6. Recommended Implementation

### Fix: Add XP Award to Quiz Creation

**File**: `backend1/routes/quizzes.js` - Modify `POST /api/quizzes/create` endpoint

```javascript
// After quiz.save() and before res.status(201).json()

// Award XP for quiz creation (based on number of questions)
const xpAmount = Math.min(Math.floor(questions.length * 2), 50); // 2 XP per question, max 50

try {
  // Create XP log entry
  await XpLog.create({
    user_id: req.user._id,
    xp_earned: xpAmount,
    activity_type: 'QUIZ_CREATED',
    metadata: {
      quizId: quiz._id.toString(),
      quizTitle: quiz.title,
      questionCount: questions.length,
      description: `Created quiz with ${questions.length} questions`
    }
  });

  // Update user XP
  await User.findByIdAndUpdate(
    req.user._id,
    { $inc: { xp: xpAmount, total_xp: xpAmount } },
    { new: true }
  );

  console.log('[createQuiz] XP awarded:', xpAmount, 'for', questions.length, 'questions');
} catch (xpError) {
  console.error('[createQuiz] XP award error:', xpError.message);
  // Don't fail the entire request if XP fails
}

res.status(201).json({ quiz, xpAwarded: xpAmount });
```

### Update Response to Include XP Info

```javascript
res.status(201).json({ 
  quiz,
  xpAwarded: xpAmount,
  message: `Quiz created! You earned ${xpAmount} XP` 
});
```

### Frontend: Show XP Notification

**File**: `frontend/src/pages/QuizPage.tsx` - Modify `createQuiz()` function

```typescript
if (response.ok) {
  const data = await response.json();
  setQuizzes([data.quiz, ...quizzes]);
  setView('dashboard');
  resetCreateForm();
  
  // ✅ Show XP reward to user
  if (data.xpAwarded) {
    alert(`✅ Quiz created! You earned ${data.xpAwarded} XP`);
    // Or use a toast notification for better UX
  }
}
```

---

## 7. XP Activity Types Summary

**Current Activity Types in XpLog**:
- `QUIZ_COMPLETE` ✅ - Implemented in submit endpoint
- `QUIZ_CREATED` ❌ - Needs implementation
- `DAILY_LOGIN` - Other features
- `STUDY_STREAK` - Other features
- etc.

**Suggested XP Awards**:
| Activity | XP Amount |
|----------|-----------|
| Create quiz (1 question) | 2 XP |
| Create quiz (5 questions) | 10 XP |
| Create quiz (10 questions) | 20 XP (max) |
| Submit quiz (80%+) | 20 XP ✅ |
| Submit quiz (60-79%) | 15 XP ✅ |
| Submit quiz (<60%) | 10 XP ✅ |

---

## 8. Database Models Used

### XpLog Schema
```javascript
{
  user_id: ObjectId,           // User who earned XP
  xp_earned: Number,           // Amount of XP
  activity_type: String,       // 'QUIZ_COMPLETE', 'QUIZ_CREATED', etc.
  metadata: {
    quizId?: String,
    quizTitle?: String,
    quizScore?: Number,
    questionCount?: Number,
    description: String
  },
  createdAt: Date              // Timestamp
}
```

### User Schema (XP Fields)
```javascript
{
  xp: Number,                  // Current XP (may reset weekly)
  total_xp: Number,            // Lifetime total XP
  level: Number,               // Calculated: floor(sqrt(total_xp / 100))
  // ... other fields
}
```

---

## 9. Testing the Fix

### Test Quiz Creation XP Award
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Create quiz (should award XP)
curl -X POST http://localhost:5000/api/quizzes/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Quiz",
    "subject": "Math",
    "difficulty": "medium",
    "questions": [
      {"question": "Q1?", "options": ["A", "B"], "correctAnswer": 0, "type": "mcq_single"},
      {"question": "Q2?", "options": ["A", "B"], "correctAnswer": 1, "type": "mcq_single"}
    ]
  }'

# Check XP was awarded
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer TOKEN"

# Should show increased xp and total_xp
```

### Test Quiz Submission XP Award (Already Works)
```bash
curl -X POST http://localhost:5000/api/quizzes/{quizId}/submit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [{"questionId": "q1", "selectedAnswer": 0}],
    "timeSpent": 300
  }'

# Check response includes XP
```

---

## 10. Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Quiz submission XP | ✅ WORKING | Awards 10-20 XP based on score |
| Quiz creation XP | ❌ MISSING | Need to implement in backend |
| Frontend notification | ⚠️ PARTIAL | Submission works on backend, no user feedback |
| API endpoints | ✅ WORKING | All endpoints functional |
| XpLog model | ✅ WORKING | Properly tracks activity |
| User XP fields | ✅ WORKING | Both xp and total_xp updated |

**Action Items**:
1. ✅ Implement XP award in `POST /api/quizzes/create` endpoint
2. ✅ Add `xpAwarded` to response
3. ✅ Update frontend to notify user of XP gain
4. ✅ Add `QUIZ_CREATED` activity type logging
5. ✅ Test end-to-end XP flow

