import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { gamificationAPI } from '../services/api';
import { Loader, AlertCircle, CheckCircle, XCircle, Brain, Calculator, Plus, BookOpen, Trophy, Clock, Edit, Trash2, Play } from 'lucide-react';

interface Question {
  _id?: string;
  id?: string;
  question: string;
  text?: string;
  options: string[];
  correctAnswer: number;
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
  totalAttempts?: number;
  averageScore?: number;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number;
  detailedResults: any[];
  passed: boolean;
}

type QuizView = 'dashboard' | 'create' | 'custom-create' | 'edit' | 'generated' | 'taking' | 'results';

export const QuizPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Main state
  const [view, setView] = useState<QuizView>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quiz data
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null); // For AI-generated quizzes
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Quiz creation/editing
  const [createForm, setCreateForm] = useState({
    title: '',
    subject: '',
    description: '',
    difficulty: 'medium',
    timeLimit: 30, // minutes
    isPublic: true,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Quiz taking
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Calculator
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPreviousValue, setCalcPreviousValue] = useState<number | null>(null);
  const [calcOperation, setCalcOperation] = useState<string | null>(null);
  const [calcWaitingForOperand, setCalcWaitingForOperand] = useState(false);

  // Legacy AI generation (keeping for backward compatibility)
  const [formData, setFormData] = useState({
    topic: '',
    subject: '',
    difficulty: 'medium',
    numQuestions: '5',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (view === 'taking' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, timeRemaining]);

  // Start timer when quiz begins
  const startQuiz = () => {
    const estimatedMinutes = Math.ceil(quiz!.questions.length * 1.5);
    setTimeRemaining(estimatedMinutes * 60); // Convert to seconds
    setShowCalculator(false); // Hide calculator initially
    setCalcDisplay('0'); // Reset calculator
    setCalcPreviousValue(null);
    setCalcOperation(null);
    setCalcWaitingForOperand(false);
    setView('taking');
  };

  const generateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent multiple submissions
    if (!formData.topic.trim() && !uploadedFile) {
      setError('Please provide a topic or upload a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      let response;

      if (uploadedFile) {
        // Convert file to base64 and send as JSON
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]; // Remove data:mimetype prefix
          const fileData = {
            filename: uploadedFile.name,
            mimetype: uploadedFile.type,
            data: base64
          };

          response = await fetch(
            `${import.meta.env.VITE_API_URL}/generate/quiz`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                text: formData.topic,
                subject: formData.subject,
                numQuestions: parseInt(formData.numQuestions),
                createdBy: user?.id || user?._id,
                file: fileData,
              }),
            }
          );

          if (!response.ok) throw new Error('Failed to generate quiz');
          const data = await response.json();
          setQuiz(data.quiz);
          setView('generated');
          setAnswers(new Array(data.quiz.questions.length).fill(-1));
          setUploadedFile(null);
        };
        reader.readAsDataURL(uploadedFile);
        return;
      } else {
        // Send text only
        response = await fetch(
          `${import.meta.env.VITE_API_URL}/generate/quiz`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: formData.topic,
              subject: formData.subject,
              numQuestions: parseInt(formData.numQuestions),
              createdBy: user?.id || user?._id,
            }),
          }
        );
      }

      if (!response.ok) throw new Error('Failed to generate quiz');
      const data = await response.json();
      setQuiz(data.quiz);
      setView('generated');
      setAnswers(new Array(data.quiz.questions.length).fill(-1));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (answers.includes(-1)) {
      setError('Please answer all questions before submitting');
      return;
    }

    if (!quiz) return;

    let correctCount = 0;
    quiz.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    const percentage = (correctCount / quiz.questions.length) * 100;
    setScore(percentage);
    setSubmitted(true);

    // Save quiz result
    try {
      const token = localStorage.getItem('authToken');
      const submitResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/quiz/${quiz._id}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers,
            score: percentage,
            timeSpent: 0,
          }),
        }
      );

      if (submitResponse.ok) {
        const submitData = await submitResponse.json();
        setAttemptNumber(submitData.attemptNumber || 1);

        // Award XP for quiz completion
        try {
          await gamificationAPI.awardXP({
            activityType: 'QUIZ_COMPLETE',
            xpAmount: 10,
            description: `Completed quiz: ${quiz.title} (${Math.round(percentage)}% score)`
          });
        } catch (xpError) {
          console.error('Failed to award XP:', xpError);
        }
      }
    } catch (err: any) {
      console.error('Failed to save quiz result:', err.message);
    }
  };

  const handleAutoSubmit = async () => {
    if (!quiz) return;

    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (answer === quiz.questions[index].correctAnswer) {
        correctCount++;
      }
    });

    const percentage = (correctCount / quiz.questions.length) * 100;
    setScore(percentage);
    setSubmitted(true);

    // Save quiz result
    try {
      const token = localStorage.getItem('authToken');
      const submitResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/quiz/${quiz._id}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers,
            score: percentage,
            timeSpent: 0,
          }),
        }
      );

      if (submitResponse.ok) {
        const submitData = await submitResponse.json();
        setAttemptNumber(submitData.attemptNumber || 1);

        // Award XP for quiz completion
        try {
          await gamificationAPI.awardXP({
            activityType: 'QUIZ_COMPLETE',
            xpAmount: 10,
            description: `Completed quiz: ${quiz.title} (${Math.round(percentage)}% score)`
          });
        } catch (xpError) {
          console.error('Failed to award XP:', xpError);
        }
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  };

  // Calculator functions
  const calcInputNumber = (num: string) => {
    if (calcWaitingForOperand) {
      setCalcDisplay(num);
      setCalcWaitingForOperand(false);
    } else {
      setCalcDisplay(calcDisplay === '0' ? num : calcDisplay + num);
    }
  };

  const calcInputOperation = (nextOperation: string) => {
    const inputValue = parseFloat(calcDisplay);

    if (calcPreviousValue === null) {
      setCalcPreviousValue(inputValue);
    } else if (calcOperation) {
      const currentValue = calcPreviousValue || 0;
      const newValue = calcCalculate(currentValue, inputValue, calcOperation);

      setCalcDisplay(`${parseFloat(newValue.toFixed(7))}`);
      setCalcPreviousValue(newValue);
    }

    setCalcWaitingForOperand(true);
    setCalcOperation(nextOperation);
  };

  const calcCalculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const calcPerformCalculation = () => {
    const inputValue = parseFloat(calcDisplay);

    if (calcPreviousValue !== null && calcOperation) {
      const newValue = calcCalculate(calcPreviousValue, inputValue, calcOperation);
      setCalcDisplay(`${parseFloat(newValue.toFixed(7))}`);
      setCalcPreviousValue(null);
      setCalcOperation(null);
      setCalcWaitingForOperand(true);
    }
  };

  const calcClear = () => {
    setCalcDisplay('0');
    setCalcPreviousValue(null);
    setCalcOperation(null);
    setCalcWaitingForOperand(false);
  };

  const calcInputDecimal = () => {
    if (calcWaitingForOperand) {
      setCalcDisplay('0.');
      setCalcWaitingForOperand(false);
    } else if (calcDisplay.indexOf('.') === -1) {
      setCalcDisplay(calcDisplay + '.');
    }
  };

  // Quiz Management Functions
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data.quizzes);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createQuiz = async () => {
    if (!createForm.title.trim() || !questions.length) {
      setError('Title and at least one question are required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/quizzes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          timeLimit: createForm.timeLimit * 60, // Convert to seconds
          questions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuizzes([data.quiz, ...quizzes]);
        setView('dashboard');
        resetCreateForm();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to create quiz');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startQuizTaking = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setAnswers(new Array(quiz.questions.length).fill(-1));
    setCurrentQuestion(0);
    setSubmitted(false);
    setScore(0);
    setTimeRemaining(quiz.timeLimit || 1800);
    setStartTime(new Date());
    setShowCalculator(false);
    setCalcDisplay('0');
    setCalcPreviousValue(null);
    setCalcOperation(null);
    setCalcWaitingForOperand(false);
    setView('taking');
  };

  const submitQuiz = async () => {
    if (!selectedQuiz) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const timeSpent = startTime ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000) : 0;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/quizzes/${selectedQuiz._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers,
          timeSpent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuizResult(data.result);
        setSubmitted(true);
        setView('results');
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to submit quiz');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setQuizzes(quizzes.filter(quiz => quiz._id !== quizId));
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to delete quiz');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
    };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionIndex(questions.length);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    if (currentQuestionIndex >= index && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      subject: '',
      description: '',
      difficulty: 'medium',
      timeLimit: 30,
      isPublic: true,
    });
    setQuestions([]);
    setCurrentQuestionIndex(0);
  };

  const updateQuiz = async () => {
    if (!selectedQuiz || !createForm.title.trim() || !questions.length) {
      setError('Title and at least one question are required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/quizzes/${selectedQuiz._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          timeLimit: createForm.timeLimit * 60, // Convert to seconds
          questions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuizzes(quizzes.map(quiz => quiz._id === selectedQuiz._id ? data.quiz : quiz));
        setSelectedQuiz(null);
        setView('dashboard');
        resetCreateForm();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to update quiz');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'dashboard') {
      fetchQuizzes();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'edit' && selectedQuiz) {
      setCreateForm({
        title: selectedQuiz.title,
        subject: selectedQuiz.subject,
        description: selectedQuiz.description || '',
        difficulty: selectedQuiz.difficulty,
        timeLimit: selectedQuiz.timeLimit ? Math.floor(selectedQuiz.timeLimit / 60) : 30,
        isPublic: selectedQuiz.isPublic ?? true,
      });
      setQuestions(selectedQuiz.questions);
    }
  }, [view, selectedQuiz]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Quiz Center</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {view === 'dashboard' ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-bold text-gray-900">Quiz Dashboard</h1>
              <div className="flex gap-4">
                <button
                  onClick={() => setView('create')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Brain size={20} />
                  AI Generate Quiz
                </button>
                <button
                  onClick={() => setView('custom-create')}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Create Custom Quiz
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader size={32} className="animate-spin text-blue-600" />
              </div>
            ) : quizzes.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={64} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No quizzes yet</h3>
                <p className="text-gray-600 mb-6">Create your first quiz to get started!</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setView('create')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <Brain size={20} />
                    AI Generate Quiz
                  </button>
                  <button
                    onClick={() => setView('custom-create')}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Create Custom Quiz
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <div key={quiz._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{quiz.title}</h3>
                        <p className="text-sm text-gray-600">{quiz.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startQuizTaking(quiz)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Take Quiz"
                        >
                          <Play size={16} />
                        </button>
                        {quiz.createdBy?._id === user?.id && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedQuiz(quiz);
                                setView('edit');
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Quiz"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
                                  deleteQuiz(quiz._id);
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Quiz"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium">{quiz.questions.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Difficulty:</span>
                        <span className="font-medium capitalize">{quiz.difficulty}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Time Limit:</span>
                        <span className="font-medium">{quiz.timeLimit ? `${Math.floor(quiz.timeLimit / 60)} min` : 'No limit'}</span>
                      </div>
                      {quiz.averageScore !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Avg Score:</span>
                          <span className="font-medium">{quiz.averageScore.toFixed(1)}%</span>
                        </div>
                      )}
                      {quiz.totalAttempts !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Attempts:</span>
                          <span className="font-medium">{quiz.totalAttempts}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startQuizTaking(quiz)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <Play size={16} />
                        Take Quiz
                      </button>
                    </div>

                    {quiz.createdBy && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Created by {quiz.createdBy.name} • {new Date(quiz.createdAt || '').toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === 'custom-create' ? (
          <div className="max-w-4xl">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Custom Quiz</h2>
                <button
                  onClick={() => setView('dashboard')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Quiz Settings */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Quiz Title *
                    </label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      placeholder="Enter quiz title"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={createForm.subject}
                      onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                      placeholder="e.g., Mathematics, History"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={createForm.difficulty}
                      onChange={(e) => setCreateForm({ ...createForm, difficulty: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="veryhard">Very Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      value={createForm.timeLimit}
                      onChange={(e) => setCreateForm({ ...createForm, timeLimit: parseInt(e.target.value) || 30 })}
                      min="1"
                      max="180"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Brief description of the quiz"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={createForm.isPublic}
                      onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                      Make quiz public (visible to other users)
                    </label>
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Questions ({questions.length})</h3>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No questions added yet. Click "Add Question" to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                          <button
                            onClick={() => removeQuestion(index)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Remove question"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              Question Text *
                            </label>
                            <textarea
                              value={question.question}
                              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                              placeholder="Enter your question"
                              rows={2}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              Options *
                            </label>
                            <div className="space-y-2">
                              {question.options.map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={question.correctAnswer === optIndex}
                                    onChange={() => updateQuestion(index, 'correctAnswer', optIndex)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                  />
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...question.options];
                                      newOptions[optIndex] = e.target.value;
                                      updateQuestion(index, 'options', newOptions);
                                    }}
                                    placeholder={`Option ${optIndex + 1}`}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              Explanation (Optional)
                            </label>
                            <textarea
                              value={question.explanation || ''}
                              onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                              placeholder="Explain why this is the correct answer"
                              rows={2}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={createQuiz}
                  disabled={loading || !createForm.title.trim() || !createForm.subject.trim() || questions.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Creating Quiz...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Create Quiz
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    resetCreateForm();
                    setView('dashboard');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : view === 'edit' && selectedQuiz ? (
          <div className="max-w-4xl">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Quiz</h2>
                <button
                  onClick={() => {
                    setSelectedQuiz(null);
                    setView('dashboard');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Quiz Settings */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Quiz Title *
                    </label>
                    <input
                      type="text"
                      value={createForm.title || selectedQuiz.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      placeholder="Enter quiz title"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={createForm.subject || selectedQuiz.subject}
                      onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                      placeholder="e.g., Mathematics, History"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={createForm.difficulty || selectedQuiz.difficulty}
                      onChange={(e) => setCreateForm({ ...createForm, difficulty: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="veryhard">Very Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      value={createForm.timeLimit || (selectedQuiz.timeLimit ? Math.floor(selectedQuiz.timeLimit / 60) : 30)}
                      onChange={(e) => setCreateForm({ ...createForm, timeLimit: parseInt(e.target.value) || 30 })}
                      min="1"
                      max="180"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={createForm.description || selectedQuiz.description || ''}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Brief description of the quiz"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={createForm.isPublic ?? selectedQuiz.isPublic ?? true}
                      onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                      Make quiz public (visible to other users)
                    </label>
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Questions ({questions.length || selectedQuiz.questions.length})</h3>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {(questions.length > 0 ? questions : selectedQuiz.questions).map((question, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                        <button
                          onClick={() => removeQuestion(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Question Text *
                          </label>
                          <textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                            placeholder="Enter your question"
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Options *
                          </label>
                          <div className="space-y-2">
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${index}`}
                                  checked={question.correctAnswer === optIndex}
                                  onChange={() => updateQuestion(index, 'correctAnswer', optIndex)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...question.options];
                                    newOptions[optIndex] = e.target.value;
                                    updateQuestion(index, 'options', newOptions);
                                  }}
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Explanation (Optional)
                          </label>
                          <textarea
                            value={question.explanation || ''}
                            onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                            placeholder="Explain why this is the correct answer"
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={updateQuiz}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Updating Quiz...
                    </>
                  ) : (
                    <>
                      <Edit size={20} />
                      Update Quiz
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedQuiz(null);
                    setView('dashboard');
                    resetCreateForm();
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : view === 'create' ? (
          <div className="max-w-2xl">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create a Quiz</h2>

              <form onSubmit={generateQuiz} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Topic or Subject
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g., Photosynthesis, World War 2, Calculus"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Subject Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Biology, History, Mathematics"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Upload File (PDF or DOCX)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                            className="sr-only"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        PDF or DOCX up to 10MB
                      </p>
                      {uploadedFile && (
                        <p className="text-sm text-green-600 font-medium">
                          Selected: {uploadedFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="veryhard">Very Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Number of Questions
                    </label>
                    <select
                      value={formData.numQuestions}
                      onChange={(e) => setFormData({ ...formData, numQuestions: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !formData.topic}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Generating Quiz...
                    </>
                  ) : (
                    'Generate Quiz'
                  )}
                </button>
              </form>
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">💡 How it Works</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Enter any topic or upload PDF/DOCX files</li>
                <li>• Our AI generates custom questions from your content</li>
                <li>• Get instant feedback and explanations</li>
                <li>• Retake quizzes to improve your score</li>
                <li>• Earn XP and track your progress</li>
              </ul>
            </div>
          </div>
        ) : view === 'generated' ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="text-center mb-8">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Generated Successfully!</h2>
                <p className="text-gray-600">Your AI-generated quiz is ready. Review the details below and click "Start Test" when you're ready.</p>
              </div>

              {quiz && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{quiz.title}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Questions:</span>
                        <span className="ml-2 text-gray-900">{quiz.questions.length}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Difficulty:</span>
                        <span className="ml-2 text-gray-900 capitalize">{quiz.difficulty}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Topics:</span>
                        <span className="ml-2 text-gray-900">{quiz.topics.join(', ') || 'General'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Estimated Time:</span>
                        <span className="ml-2 text-gray-900">{Math.ceil(quiz.questions.length * 1.5)} minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">📋 Quiz Preview</h4>
                    <div className="space-y-2">
                      {quiz.questions.slice(0, 3).map((question, index) => (
                        <div key={index} className="text-sm text-blue-800">
                          <span className="font-medium">{index + 1}.</span> {question.question?.substring(0, 60) || 'Question text unavailable'}...
                        </div>
                      ))}
                      {quiz.questions.length > 3 && (
                        <div className="text-sm text-blue-700 font-medium">
                          ...and {quiz.questions.length - 3} more questions
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={startQuiz}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Brain size={20} />
                      Start Test
                    </button>
                    <button
                      onClick={() => {
                        setView('create');
                        setQuiz(null);
                      }}
                      className="px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                    >
                      Generate Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : submitted ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center mb-8">
                {score >= 80 ? (
                  <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                ) : score >= 60 ? (
                  <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
                ) : (
                  <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                )}
                <h2 className="text-3xl font-bold text-gray-900 mt-4">Quiz Complete!</h2>
                <p className="text-gray-600 mt-2">Attempt #{attemptNumber} - You scored</p>
              </div>

              <div className="text-center mb-8">
                <p className="text-6xl font-bold text-blue-600">{score.toFixed(0)}%</p>
                <p className="text-gray-600 mt-2">
                  {Math.round((score / 100) * (selectedQuiz?.questions.length || 0))} of {selectedQuiz?.questions.length} correct
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {selectedQuiz?.questions.map((question, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-2">{question.question}</p>
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <div
                          key={optIndex}
                          className={`p-2 rounded ${
                            optIndex === question.correctAnswer
                              ? 'bg-green-100 border border-green-500'
                              : optIndex === answers[index]
                              ? 'bg-red-100 border border-red-500'
                              : 'bg-gray-100'
                          }`}
                        >
                          {optIndex === question.correctAnswer && answers[index] === optIndex && (
                            <CheckCircle size={16} className="inline mr-2 text-green-600" />
                          )}
                          {optIndex === answers[index] && optIndex !== question.correctAnswer && (
                            <XCircle size={16} className="inline mr-2 text-red-600" />
                          )}
                          <span className="text-sm">{option}</span>
                        </div>
                      ))}
                    </div>
                    {question.explanation && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                        <p className="text-xs font-semibold text-blue-900">Explanation:</p>
                        <p className="text-xs text-blue-800">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    // Retake the same quiz
                    const estimatedMinutes = Math.ceil(quiz!.questions.length * 1.5);
                    setTimeRemaining(estimatedMinutes * 60);
                    setShowCalculator(false); // Hide calculator initially
                    setCalcDisplay('0'); // Reset calculator
                    setCalcPreviousValue(null);
                    setCalcOperation(null);
                    setCalcWaitingForOperand(false);
                    setView('taking');
                    setCurrentQuestion(0);
                    setAnswers(new Array(selectedQuiz?.questions.length || 0).fill(-1));
                    setSubmitted(false);
                    setScore(0);
                    // Don't reset attempt number for retakes
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                >
                  Retake Quiz
                </button>
                <button
                  onClick={() => {
                    setView('create');
                    setQuiz(null);
                    setSubmitted(false);
                    setAttemptNumber(1);
                    setFormData({ topic: '', subject: '', difficulty: 'medium', numQuestions: '5' });
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                >
                  Create Another Quiz
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Taking Quiz */
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedQuiz?.title}</h2>
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
                  <button
                    onClick={() => {
                      setView('dashboard');
                      setSelectedQuiz(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Exit Quiz
                  </button>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentQuestion + 1) / (selectedQuiz?.questions.length || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Question {currentQuestion + 1} of {selectedQuiz?.questions.length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {selectedQuiz?.questions[currentQuestion].question}
              </h3>

              <div className="space-y-3 mb-8">
                {selectedQuiz?.questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      answers[currentQuestion] === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          answers[currentQuestion] === index
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {answers[currentQuestion] === index && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <span className="text-gray-900">{option}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>

                {currentQuestion === (selectedQuiz?.questions.length || 0) - 1 ? (
                  <button
                    onClick={handleSubmit}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    Next
                  </button>
                )}
              </div>

              {/* Question Indicators */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-3">Questions:</p>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {selectedQuiz?.questions.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestion(index)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        index === currentQuestion
                          ? 'bg-blue-600 text-white'
                          : answers[index] !== -1
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculator */}
              {showCalculator && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      {/* Calculator Display */}
                      <div className="bg-gray-100 rounded p-3 mb-4">
                        <div className="text-right text-xl font-mono font-bold text-gray-900 overflow-hidden">
                          {calcDisplay}
                        </div>
                      </div>

                      {/* Calculator Buttons */}
                      <div className="grid grid-cols-4 gap-2">
                        {/* Row 1 */}
                        <button
                          onClick={calcClear}
                          className="col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => calcInputOperation('/')}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          ÷
                        </button>
                        <button
                          onClick={() => calcInputOperation('*')}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          ×
                        </button>

                        {/* Row 2 */}
                        <button
                          onClick={() => calcInputNumber('7')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          7
                        </button>
                        <button
                          onClick={() => calcInputNumber('8')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          8
                        </button>
                        <button
                          onClick={() => calcInputNumber('9')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          9
                        </button>
                        <button
                          onClick={() => calcInputOperation('-')}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          −
                        </button>

                        {/* Row 3 */}
                        <button
                          onClick={() => calcInputNumber('4')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          4
                        </button>
                        <button
                          onClick={() => calcInputNumber('5')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          5
                        </button>
                        <button
                          onClick={() => calcInputNumber('6')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          6
                        </button>
                        <button
                          onClick={() => calcInputOperation('+')}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          +
                        </button>

                        {/* Row 4 */}
                        <button
                          onClick={() => calcInputNumber('1')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          1
                        </button>
                        <button
                          onClick={() => calcInputNumber('2')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          2
                        </button>
                        <button
                          onClick={() => calcInputNumber('3')}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          3
                        </button>
                        <button
                          onClick={calcPerformCalculation}
                          className="row-span-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          =
                        </button>

                        {/* Row 5 */}
                        <button
                          onClick={() => calcInputNumber('0')}
                          className="col-span-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          0
                        </button>
                        <button
                          onClick={calcInputDecimal}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-2 rounded text-sm transition-colors"
                        >
                          .
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};
