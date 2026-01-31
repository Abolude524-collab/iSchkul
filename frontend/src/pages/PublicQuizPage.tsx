import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { getAPIEndpoint } from '../services/api';
import { Loader, AlertCircle, CheckCircle, Calculator, Play } from 'lucide-react';

interface Question {
  _id?: string;
  id?: string;
  text: string;
  type: 'mcq_single' | 'mcq_multiple' | 'true_false';
  options: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctAnswerBoolean?: boolean;
  explanation?: string;
  imageUrl?: string;
}

interface Quiz {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  difficulty: string;
  questions: Question[];
  timeLimit?: number;
  isPublic?: boolean;
  createdBy?: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt?: string;
}

import { GuestInfoModal } from '../components/GuestInfoModal';
import { useAuthStore } from '../services/store';

const PublicQuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [testStarted, setTestStarted] = useState(false);

  // Guest info state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    fetchQuiz();
  }, [id]);

  useEffect(() => {
    if (timeRemaining > 0 && !submitted) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && !submitted) {
      submitQuiz();
    }
  }, [timeRemaining, submitted]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(getAPIEndpoint(`/quizzes/public/${id}`));

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Quiz not found');
        } else if (response.status === 403) {
          throw new Error('This quiz is private');
        }
        throw new Error('Failed to load quiz');
      }

      const data = await response.json();
      const quizData = data.quiz;

      if (!quizData.isPublic) {
        throw new Error('This quiz is private');
      }

      setQuiz(quizData);
      setAnswers(new Array(quizData.questions.length).fill(-1));
      setTimeRemaining(quizData.timeLimit || 1800);
      setStartTime(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    const currentQ = quiz?.questions[currentQuestion];
    if (!currentQ) return;

    const newAnswers = [...answers];
    const currentAnswer = newAnswers[currentQuestion];

    if (currentQ.type === 'mcq_multiple') {
      // Initialize if null/undefined
      const selected = Array.isArray(currentAnswer) ? [...currentAnswer] : [];

      const index = selected.indexOf(answerIndex);
      if (index === -1) {
        selected.push(answerIndex);
      } else {
        selected.splice(index, 1);
      }
      // Sort for consistent comparison but order doesn't strictly matter for storage
      newAnswers[currentQuestion] = selected.sort((a, b) => a - b);
    } else {
      // Single choice and True/False (treated as single selection of options)
      newAnswers[currentQuestion] = answerIndex;
    }

    setAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (!quiz) return;

    // Calculate score locally first for immediate feedback
    let correctCount = 0;
    answers.forEach((answer, index) => {
      const question = quiz.questions[index];

      if (question.type === 'mcq_multiple') {
        const correct = question.correctAnswers || [];
        if (Array.isArray(answer) &&
          answer.length === correct.length &&
          answer.every((val: number) => correct.includes(val))) {
          correctCount++;
        }
      } else if (question.type === 'true_false') {
        if (question.correctAnswer !== undefined) {
          if (answer === question.correctAnswer) correctCount++;
        } else if (question.correctAnswerBoolean !== undefined) {
          // Map boolean to index based on option text
          // Assume options contain "True" and "False"
          // normalize options to lower case for check
          const trueIndex = question.options.findIndex(opt => opt.toLowerCase() === 'true');
          const falseIndex = question.options.findIndex(opt => opt.toLowerCase() === 'false');

          if (question.correctAnswerBoolean === true && answer === trueIndex) correctCount++;
          if (question.correctAnswerBoolean === false && answer === falseIndex) correctCount++;
        }
      } else {
        // mcq_single
        if (answer === question.correctAnswer) {
          correctCount++;
        }
      }
    });

    try {
      setLoading(true);

      const timeSpent = startTime ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000) : 0;

      // Prepare payload
      const payload: any = {
        answers,
        timeSpent,
      };

      // Add guest details if not logged in
      if (!user) {
        payload.guestName = guestName;
        payload.guestEmail = guestEmail;
      }

      // Choose endpoint based on auth status
      // If user is logged in, use standard submit. If guest, use public submit.
      const endpoint = user
        ? `/quizzes/${id}/submit`
        : `/quizzes/public/${id}/submit`;

      const headers: any = {
        'Content-Type': 'application/json'
      };

      const token = localStorage.getItem('authToken');
      if (token && user) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getAPIEndpoint(endpoint), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const data = await response.json();

      // Update local state with server results
      setScore(data.result.score);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = () => {
    if (!quiz) return 0;
    return Math.round((score / quiz.questions.length) * 100);
  };

  const startTest = () => {
    // If not logged in and no guest info, show modal
    if (!user && !guestName) {
      setShowGuestModal(true);
      return;
    }

    setTestStarted(true);
    setTimeRemaining(quiz?.timeLimit || 1800);
    setStartTime(new Date());
    setAnswers(new Array(quiz?.questions.length || 0).fill(-1));
    setCurrentQuestion(0);
  };

  const handleGuestInfoSubmit = (name: string, email: string) => {
    setGuestName(name);
    setGuestEmail(email);
    setShowGuestModal(false);

    // Auto start test after entering details
    setTestStarted(true);
    setTimeRemaining(quiz?.timeLimit || 1800);
    setStartTime(new Date());
    setAnswers(new Array(quiz?.questions.length || 0).fill(-1));
    setCurrentQuestion(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">Quiz Unavailable</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  if (!testStarted && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto py-12 px-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-gray-600 text-lg">{quiz.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">{quiz.questions.length}</div>
                <div className="text-sm text-blue-700 font-medium">Questions</div>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">{Math.ceil((quiz.timeLimit || 1800) / 60)}</div>
                <div className="text-sm text-green-700 font-medium">Minutes</div>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1 capitalize">{quiz.difficulty}</div>
                <div className="text-sm text-purple-700 font-medium">Difficulty</div>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">{quiz.subject || 'General'}</div>
                <div className="text-sm text-orange-700 font-medium">Subject</div>
              </div>
            </div>

            {quiz.createdBy && (
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Created By</h3>
                <p className="text-gray-900 font-medium">{quiz.createdBy.name}</p>
                <p className="text-sm text-gray-600">@{quiz.createdBy.username}</p>
              </div>
            )}

            {quiz.createdAt && (
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Created On</h3>
                <p className="text-gray-900 font-medium">{new Date(quiz.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg mb-8">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">Instructions</h3>
              <ul className="text-sm text-yellow-800 space-y-2">
                <li>• Answer all {quiz.questions.length} questions</li>
                <li>• You have {Math.ceil((quiz.timeLimit || 1800) / 60)} minutes to complete the test</li>
                <li>• Your progress is auto-saved</li>
                <li>• You cannot go back after submitting</li>
              </ul>
            </div>

            <button
              onClick={startTest}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-lg"
            >
              <Play size={20} />
              Start Test
            </button>
          </div>
        </div>

        {showGuestModal && (
          <GuestInfoModal
            onSubmit={handleGuestInfoSubmit}
            onCancel={() => setShowGuestModal(false)}
          />
        )}
      </div>
    );
  }

  if (submitted) {
    const percentage = calculatePercentage();
    // removed getGrade call to remove grade entirely

    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Completed!</h2>
              <p className="text-gray-600">Here are your results</p>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-1">{score}</div>
                <div className="text-sm text-blue-700">Correct Answers</div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Score</span>
                <span className="font-semibold">{percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {quiz.questions.map((question, index) => {
                const userAnswer = answers[index];
                const isMultiple = question.type === 'mcq_multiple';

                // Normalize correct answers for comparison
                let correctIndices: number[] = [];
                if (isMultiple) {
                  correctIndices = question.correctAnswers || [];
                } else if (question.type === 'true_false') {
                  // Calculate correct index for T/F result view
                  if (question.correctAnswer !== undefined) {
                    correctIndices = [question.correctAnswer];
                  } else if (question.correctAnswerBoolean !== undefined) {
                    const trueIndex = question.options.findIndex(opt => opt.toLowerCase() === 'true');
                    const falseIndex = question.options.findIndex(opt => opt.toLowerCase() === 'false');

                    if (question.correctAnswerBoolean === true && trueIndex !== -1) correctIndices = [trueIndex];
                    if (question.correctAnswerBoolean === false && falseIndex !== -1) correctIndices = [falseIndex];
                  }
                } else {
                  // Single
                  if (question.correctAnswer !== undefined) {
                    correctIndices = [question.correctAnswer];
                  }
                }

                // Normalize user answers
                const userIndices = isMultiple
                  ? (Array.isArray(userAnswer) ? userAnswer : [])
                  : (userAnswer !== -1 ? [userAnswer] : []);

                // Check correctness
                // const isCorrect = ... (calculated via style below)

                return (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{index + 1}. {question.text}</h4>
                    <div className="space-y-1">
                      {question.options.map((option, optionIndex) => {
                        const isSelected = userIndices.includes(optionIndex);
                        const isOptionCorrect = correctIndices.includes(optionIndex);

                        return (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded text-sm ${isOptionCorrect
                              ? 'bg-green-100 text-green-800'
                              : isSelected && !isOptionCorrect
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-50'
                              }`}
                          >
                            {option}
                            {isOptionCorrect && (
                              <span className="ml-2 text-green-600">✓ Correct</span>
                            )}
                            {isSelected && !isOptionCorrect && (
                              <span className="ml-2 text-red-600">✗ Your answer</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {question.explanation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-800">
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all"
              >
                Retake Quiz
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{quiz.title}</h2>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-gray-700">
                Time: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Calculator size={16} />
                {showCalculator ? 'Hide Calculator' : 'Show Calculator'}
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {quiz.questions[currentQuestion].text}
            </h3>
            {quiz.questions[currentQuestion].type === 'mcq_multiple' && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
                <CheckCircle size={14} />
                <span>Select all correct answers</span>
              </div>
            )}
          </div>

          <div className="space-y-3 mb-8">
            {quiz.questions[currentQuestion].options.map((option, index) => {
              const question = quiz.questions[currentQuestion];
              const isMultiple = question.type === 'mcq_multiple';
              const currentAnswer = answers[currentQuestion];

              const isSelected = isMultiple
                ? Array.isArray(currentAnswer) && currentAnswer.includes(index)
                : currentAnswer === index;

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 flex items-center justify-center border-2 ${isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                        } ${isMultiple ? 'rounded-md' : 'rounded-full'}`}
                    >
                      {isSelected && (
                        isMultiple ? (
                          <CheckCircle size={14} className="text-white" />
                        ) : (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )
                      )}
                    </div>
                    <span className="text-gray-900">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                disabled={answers[currentQuestion] === -1}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={answers[currentQuestion] === -1}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>

        {showCalculator && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold mb-4">Calculator</h4>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="text-right text-2xl font-mono">{calcDisplay}</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    // Calculator logic here
                    if (btn === '=') {
                      try {
                        setCalcDisplay(eval(calcDisplay).toString());
                      } catch {
                        setCalcDisplay('Error');
                      }
                    } else if (['+', '-', '*', '/'].includes(btn)) {
                      setCalcDisplay(calcDisplay + btn);
                    } else {
                      setCalcDisplay(calcDisplay === '0' ? btn : calcDisplay + btn);
                    }
                  }}
                  className="p-3 bg-gray-200 hover:bg-gray-300 rounded text-center font-semibold"
                >
                  {btn}
                </button>
              ))}
              <button
                onClick={() => setCalcDisplay('0')}
                className="col-span-2 p-3 bg-red-500 hover:bg-red-600 text-white rounded font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {showGuestModal && (
        <GuestInfoModal
          onSubmit={handleGuestInfoSubmit}
          onCancel={() => setShowGuestModal(false)}
        />
      )}
    </div>
  );
};

export { PublicQuizPage };