# QuestionRenderer Integration Guide

## How to Use the New QuestionRenderer Component

This guide shows how to integrate the new `QuestionRenderer.tsx` component into existing quiz pages.

---

## 🔄 Migration from Old Code

### BEFORE (Current QuizPage.tsx - Lines 1817)

```tsx
// Current implementation (hardcoded MCQ_SINGLE)
<div className="space-y-3 md:space-y-4 mb-8">
  {selectedQuiz?.questions?.[currentQuestion]?.options.map((option, index) => (
    <button
      key={index}
      onClick={() => handleAnswer(index)}
      className={`w-full p-4 md:p-5 text-left rounded-xl border-2 transition-all ${
        answers[currentQuestion] === index
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 bg-white'
      }`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full ...`}>
          {/* Radio button circle */}
        </div>
        <span className="text-gray-900 text-base md:text-lg">{option}</span>
      </div>
    </button>
  ))}
</div>
```

### AFTER (Using QuestionRenderer)

```tsx
import { QuestionRenderer } from '../components/QuestionRenderer';

// In your JSX:
<QuestionRenderer
  question={selectedQuiz?.questions?.[currentQuestion]}
  answer={answers[currentQuestion]}
  onAnswer={(answer) => handleAnswer(answer)}
  disabled={submitted}
  showExplanation={submitted}
  submitted={submitted}
/>
```

---

## 📥 Step-by-Step Integration

### Step 1: Import Component
```tsx
// At the top of QuizPage.tsx
import { QuestionRenderer } from '../components/QuestionRenderer';
```

### Step 2: Update State (if needed)
```tsx
// The answers state needs to handle mixed types now:
// OLD: answers[i] = number (for mcq_single)
// NEW: answers[i] = number | number[] | boolean (for any type)

// This works without change because answer can be any type:
const [answers, setAnswers] = useState<(number | number[] | boolean)[]>([]);
```

### Step 3: Update handleAnswer Function
```tsx
// OLD (hardcoded to number index):
const handleAnswer = (index: number) => {
  const newAnswers = [...answers];
  newAnswers[currentQuestion] = index;
  setAnswers(newAnswers);
};

// NEW (handles any answer type):
const handleAnswer = (answer: number | number[] | boolean) => {
  const newAnswers = [...answers];
  newAnswers[currentQuestion] = answer;
  setAnswers(newAnswers);
};
```

### Step 4: Replace Rendering Code
```tsx
// Replace the entire options.map() section with:
<QuestionRenderer
  question={selectedQuiz?.questions?.[currentQuestion]}
  answer={answers[currentQuestion] ?? null}
  onAnswer={handleAnswer}
  disabled={submitted}
  showExplanation={submitted}
  submitted={submitted}
/>
```

---

## 💡 Example: Full Integration

```tsx
import React, { useState } from 'react';
import { QuestionRenderer } from '../components/QuestionRenderer';

interface Question {
  _id: string;
  text: string;
  type?: 'mcq_single' | 'mcq_multiple' | 'true_false';
  options: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctAnswerBoolean?: boolean;
  explanation?: string;
}

export const QuizTakingComponent: React.FC = () => {
  const [quiz, setQuiz] = useState<{ questions: Question[] } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | number[] | boolean)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (answer: number | number[] | boolean) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    // Submit to backend
    const response = await fetch(`/api/quizzes/${quiz._id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, timeSpent: 0 }),
    });
    const result = await response.json();
    setSubmitted(true);
  };

  if (!quiz) return <div>Loading...</div>;

  const question = quiz.questions[currentQuestion];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{quiz.questions[currentQuestion]?.text}</h2>

      {/* Use QuestionRenderer instead of manual option rendering */}
      <QuestionRenderer
        question={question}
        answer={answers[currentQuestion] ?? null}
        onAnswer={handleAnswer}
        disabled={submitted}
        showExplanation={submitted}
        submitted={submitted}
      />

      {/* Navigation buttons */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={handlePrevious}
          disabled={currentQuestion === 0 || submitted}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Previous
        </button>

        {currentQuestion === quiz.questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitted}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Submit
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 🎨 Styling Customization

The component uses Tailwind CSS. To customize:

### Change Color Scheme for MCQ_SINGLE
```tsx
// In QuestionRenderer.tsx, find the mcq_single section:
// Change 'blue' to your preferred color:
// 'blue-500' → 'purple-500'
// 'blue-50' → 'purple-50'
```

### Change Color Scheme for MCQ_MULTIPLE
```tsx
// Find the mcq_multiple section:
// Change 'purple' to your preferred color:
// 'purple-500' → 'green-500'
```

### Add Custom Classes
```tsx
// Wrap QuestionRenderer with custom styling:
<div className="your-custom-class">
  <QuestionRenderer {...props} />
</div>
```

---

## 🧪 Testing the Component

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionRenderer } from '../components/QuestionRenderer';

describe('QuestionRenderer', () => {
  it('renders MCQ_SINGLE with radio buttons', () => {
    const question = {
      _id: '1',
      text: 'Test question',
      type: 'mcq_single',
      options: ['A', 'B', 'C'],
      correctAnswer: 1,
    };

    render(
      <QuestionRenderer
        question={question}
        answer={null}
        onAnswer={() => {}}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('calls onAnswer when option selected', () => {
    const onAnswer = jest.fn();
    const question = {
      _id: '1',
      text: 'Test',
      type: 'mcq_single',
      options: ['A', 'B'],
      correctAnswer: 0,
    };

    render(
      <QuestionRenderer
        question={question}
        answer={null}
        onAnswer={onAnswer}
      />
    );

    fireEvent.click(screen.getByText('A'));
    expect(onAnswer).toHaveBeenCalledWith(0);
  });

  it('renders MCQ_MULTIPLE with checkboxes', () => {
    const question = {
      _id: '2',
      text: 'Select all',
      type: 'mcq_multiple',
      options: ['A', 'B', 'C'],
      correctAnswers: [0, 2],
    };

    render(
      <QuestionRenderer
        question={question}
        answer={[]}
        onAnswer={() => {}}
      />
    );

    expect(screen.getByText('✓ Select all correct answers')).toBeInTheDocument();
  });

  it('renders TRUE_FALSE with toggle buttons', () => {
    const question = {
      _id: '3',
      text: 'Is this true?',
      type: 'true_false',
      correctAnswerBoolean: true,
      options: ['True', 'False'],
    };

    render(
      <QuestionRenderer
        question={question}
        answer={null}
        onAnswer={() => {}}
      />
    );

    expect(screen.getByText('TRUE')).toBeInTheDocument();
    expect(screen.getByText('FALSE')).toBeInTheDocument();
  });
});
```

---

## ⚡ Performance Tips

1. **Memoize if needed**:
```tsx
import React from 'react';

export const QuestionRendererMemo = React.memo(QuestionRenderer);
// Use QuestionRendererMemo to prevent re-renders
```

2. **Optimize for large quizzes**:
```tsx
// Preload next question
useEffect(() => {
  if (currentQuestion < questions.length - 1) {
    // Prefetch next question's images, etc.
  }
}, [currentQuestion]);
```

---

## 🐛 Troubleshooting

### Issue: Component not rendering
**Solution**: Ensure `question` prop is not null
```tsx
<QuestionRenderer
  question={question || { text: 'Loading...', options: [] }}
  {...props}
/>
```

### Issue: Answer not updating
**Solution**: Ensure `onAnswer` callback updates state correctly
```tsx
const handleAnswer = (answer) => {
  console.log('Answer changed to:', answer);
  // Verify this runs
  setAnswers([...answers.slice(0, currentQuestion), answer]);
};
```

### Issue: Wrong styling
**Solution**: Check `submitted` prop
```tsx
<QuestionRenderer
  {...props}
  submitted={submitted}  // Must be true to show results
/>
```

---

## 📚 Advanced Usage

### Custom Explanation Component
```tsx
// Create wrapper for custom styling
<div className="custom-explanation-wrapper">
  <QuestionRenderer
    {...props}
    showExplanation={submitted}
  />
</div>

// Style in CSS:
.custom-explanation-wrapper .explanation {
  background-color: #custom;
  border-left: 4px solid #custom;
}
```

### Accessibility Support
```tsx
// Component already includes:
// - Semantic HTML (button, proper labels)
// - Color not only indicator
// - Disabled state support
// - Keyboard navigation (native button behavior)

// Add ARIA labels if needed:
<div aria-label="Question answering interface">
  <QuestionRenderer {...props} />
</div>
```

---

## 📊 Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `question` | Question | Required | Question object with text, type, options |
| `answer` | number \| number[] \| boolean \| null | Required | Current answer(s) |
| `onAnswer` | Function | Required | Callback: `(answer) => void` |
| `disabled` | boolean | false | Disable interactions |
| `showExplanation` | boolean | false | Display explanation text |
| `submitted` | boolean | false | Show correct answers visually |

---

**Status**: ✅ Ready to integrate  
**Framework**: React 18 + TypeScript + Tailwind CSS  
**Dependencies**: lucide-react (for icons)
