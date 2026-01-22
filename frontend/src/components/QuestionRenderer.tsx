import React from 'react';

interface QuestionOption {
  text?: string;
  [key: string]: any;
}

interface Question {
  _id: string;
  text: string;
  type?: 'mcq_single' | 'mcq_multiple' | 'true_false';
  options: (string | QuestionOption)[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctAnswerBoolean?: boolean;
  explanation?: string;
  imageUrl?: string | null;
  difficulty?: string;
}

interface QuestionRendererProps {
  question: Question;
  answer: number | number[] | boolean | null;
  onAnswer: (answer: number | number[] | boolean) => void;
  disabled?: boolean;
  showExplanation?: boolean;
  submitted?: boolean;
}

/**
 * Universal Question Renderer Component
 * Supports multiple question types: mcq_single, mcq_multiple, true_false
 * Maintains backward compatibility with existing MCQ_SINGLE questions
 */
export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  answer,
  onAnswer,
  disabled = false,
  showExplanation = false,
  submitted = false,
}) => {
  const questionType = question.type || 'mcq_single';

  // Helper to normalize option text
  const getOptionText = (option: string | QuestionOption): string => {
    if (typeof option === 'string') return option;
    return option.text || String(option);
  };

  // ============ MCQ_SINGLE - Radio Button (Single Answer) ============
  if (questionType === 'mcq_single') {
    const currentAnswer = typeof answer === 'number' ? answer : null;

    return (
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-3 md:space-y-4 mb-8">
          {question.options?.map((option, index) => {
            const optionText = getOptionText(option);
            const isSelected = currentAnswer === index;
            const isCorrect = submitted && index === question.correctAnswer;
            const isIncorrectSelected = submitted && isSelected && index !== question.correctAnswer;

            return (
              <button
                key={index}
                onClick={() => onAnswer(index)}
                disabled={disabled}
                className={`w-full p-4 md:p-5 text-left rounded-xl border-2 transition-all ${
                  submitted
                    ? isCorrect
                      ? 'border-green-500 bg-green-50'
                      : isIncorrectSelected
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white'
                    : isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div
                    className={`w-6 h-6 md:w-7 md:h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      submitted
                        ? isCorrect
                          ? 'border-green-500 bg-green-500'
                          : isIncorrectSelected
                          ? 'border-red-500 bg-red-500'
                          : isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                        : isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {submitted ? (
                      isCorrect ? (
                        <CheckCircle size={16} className="text-white" />
                      ) : isIncorrectSelected ? (
                        <XCircle size={16} className="text-white" />
                      ) : isSelected ? (
                        <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
                      ) : null
                    ) : isSelected ? (
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
                    ) : null}
                  </div>
                  <span className="text-gray-900 text-base md:text-lg">{optionText}</span>
                </div>
              </button>
            );
          })}
        </div>

        {showExplanation && question.explanation && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-sm font-semibold text-blue-900 mb-1">Explanation:</p>
            <p className="text-blue-800 text-sm">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  // ============ MCQ_MULTIPLE - Checkboxes (Multiple Answers) ============
  if (questionType === 'mcq_multiple') {
    const currentAnswers = Array.isArray(answer) ? answer : [];
    const correctAnswers = question.correctAnswers || [];

    return (
      <div className="space-y-3 md:space-y-4">
        <p className="text-sm font-semibold text-amber-600 bg-amber-50 p-3 rounded-lg">
          ✓ Select all correct answers
        </p>

        <div className="space-y-3 md:space-y-4 mb-8">
          {question.options?.map((option, index) => {
            const optionText = getOptionText(option);
            const isSelected = currentAnswers.includes(index);
            const isCorrect = correctAnswers.includes(index);
            const isIncorrectSelected = submitted && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => {
                  if (!disabled) {
                    if (isSelected) {
                      onAnswer(currentAnswers.filter((i) => i !== index));
                    } else {
                      onAnswer([...currentAnswers, index]);
                    }
                  }
                }}
                disabled={disabled}
                className={`w-full p-4 md:p-5 text-left rounded-xl border-2 transition-all ${
                  submitted
                    ? isCorrect
                      ? 'border-green-500 bg-green-50'
                      : isIncorrectSelected
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white'
                    : isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div
                    className={`w-6 h-6 md:w-7 md:h-7 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      submitted
                        ? isCorrect
                          ? 'border-green-500 bg-green-500'
                          : isIncorrectSelected
                          ? 'border-red-500 bg-red-500'
                          : isSelected
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300'
                        : isSelected
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {submitted ? (
                      isCorrect ? (
                        <CheckCircle size={16} className="text-white" />
                      ) : isIncorrectSelected ? (
                        <XCircle size={16} className="text-white" />
                      ) : isSelected ? (
                        <CheckCircle size={16} className="text-white" />
                      ) : null
                    ) : isSelected ? (
                      <CheckCircle size={16} className="text-white" />
                    ) : null}
                  </div>
                  <span className="text-gray-900 text-base md:text-lg">{optionText}</span>
                </div>
              </button>
            );
          })}
        </div>

        {submitted && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-sm font-semibold text-blue-900 mb-2">Correct answers:</p>
            <div className="text-blue-800 text-sm space-y-1">
              {correctAnswers.map((idx) => (
                <p key={idx}>✓ {getOptionText(question.options[idx])}</p>
              ))}
            </div>
          </div>
        )}

        {showExplanation && question.explanation && (
          <div className="mt-3 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded">
            <p className="text-sm font-semibold text-indigo-900 mb-1">Explanation:</p>
            <p className="text-indigo-800 text-sm">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  // ============ TRUE_FALSE - Toggle (Boolean Answer) ============
  if (questionType === 'true_false') {
    const currentAnswer = typeof answer === 'boolean' ? answer : null;
    const correctAnswer = question.correctAnswerBoolean;

    return (
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-4 mb-8">
          <button
            onClick={() => onAnswer(true)}
            disabled={disabled}
            className={`w-full p-6 md:p-8 text-center rounded-xl border-2 transition-all font-bold text-lg md:text-2xl ${
              submitted
                ? correctAnswer === true
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : currentAnswer === true
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-white text-gray-900'
                : currentAnswer === true
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-300 hover:border-green-400 bg-white text-gray-900'
            }`}
          >
            {submitted && correctAnswer === true && <span>✓ </span>}
            {submitted && currentAnswer === true && correctAnswer !== true && <span>✗ </span>}
            TRUE
          </button>

          <button
            onClick={() => onAnswer(false)}
            disabled={disabled}
            className={`w-full p-6 md:p-8 text-center rounded-xl border-2 transition-all font-bold text-lg md:text-2xl ${
              submitted
                ? correctAnswer === false
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : currentAnswer === false
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-white text-gray-900'
                : currentAnswer === false
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-300 hover:border-red-400 bg-white text-gray-900'
            }`}
          >
            {submitted && correctAnswer === false && <span>✓ </span>}
            {submitted && currentAnswer === false && correctAnswer !== false && <span>✗ </span>}
            FALSE
          </button>
        </div>

        {showExplanation && question.explanation && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-sm font-semibold text-blue-900 mb-1">Explanation:</p>
            <p className="text-blue-800 text-sm">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback for unknown type (should not happen)
  return (
    <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-red-700">
      <p>Unknown question type: {questionType}</p>
    </div>
  );
};

// Icons needed for this component
import { CheckCircle, XCircle } from 'lucide-react';

export default QuestionRenderer;
