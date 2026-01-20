import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { gamificationAPI, getAPIEndpoint } from '../services/api';
import { Loader, AlertCircle, CheckCircle, XCircle, Brain, Calculator, Plus, BookOpen, Trophy, Clock, Edit, Trash2, Play, Share2, History, TrendingUp, BarChart2, ChevronLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { QuizSettingsForm } from '../components/QuizSettingsForm';
import { QuestionListEditor } from '../components/QuestionListEditor';
import { Question as QuizQuestion, QuizCreateForm } from '../types/quiz';

type Question = QuizQuestion;

interface Quiz {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  difficulty: string;
  questions?: Question[];
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

interface HistoryEntry {
  _id: string;
  quizId: string;
  title: string;
  subject: string;
  difficulty: string;
  score: number;
  percentage: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt: string;
}

type QuizView = 'dashboard' | 'create' | 'custom-create' | 'edit' | 'generated' | 'taking' | 'results' | 'history';

export const QuizPage: React.FC = () => {
  const { user, refreshUserStats } = useAuthStore();
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Quiz creation/editing
  const [createForm, setCreateForm] = useState<QuizCreateForm>({
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
    timeLimit: 30, // minutes
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [generateMode, setGenerateMode] = useState<'topic' | 'paste'>('topic');

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
    if (quiz) {
      setSelectedQuiz(quiz);
      setAnswers(new Array(quiz.questions?.length || 0).fill(-1));
      setCurrentQuestion(0);
    }

    const count = quiz?.questions?.length || 0;
    const estimatedMinutes = Math.max(1, Math.ceil(count * 1.5));
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
    if (generateMode === 'paste' && !pastedText.trim()) {
      setError('Please paste some text');
      return;
    }

    if (generateMode === 'topic' && !formData.topic.trim() && !uploadedFile) {
      setError('Please provide a topic or upload a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      let response;

      if (generateMode === 'paste') {
        // Generate from pasted text
        response = await fetch(
          `getAPIEndpoint('/generate/quiz`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: pastedText,
              subject: formData.subject,
              numQuestions: parseInt(formData.numQuestions),
              difficulty: formData.difficulty,
              timeLimit: formData.timeLimit * 60, // Convert to seconds
              createdBy: (user as any)?.id || (user as any)?._id,
            }),
          }
        );
      } else if (uploadedFile) {
        // Convert file to base64 and send as JSON
        const fileData = await new Promise<{ filename: string; mimetype: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = (result && result.includes(',')) ? result.split(',')[1] : (result as string);
            resolve({ filename: uploadedFile.name, mimetype: uploadedFile.type, data: base64 || '' });
          };
          reader.readAsDataURL(uploadedFile);
        });

        response = await fetch(
          `getAPIEndpoint('/generate/quiz`,
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
              difficulty: formData.difficulty,
              timeLimit: formData.timeLimit * 60, // Convert to seconds
              createdBy: (user as any)?.id || (user as any)?._id,
              file: fileData,
            }),
          }
        );
      } else {
        // Topic-only submission
        response = await fetch(
          `getAPIEndpoint('/generate/quiz`,
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
              difficulty: formData.difficulty,
              timeLimit: formData.timeLimit * 60, // Convert to seconds
              createdBy: (user as any)?.id || (user as any)?._id,
            }),
          }
        );
      }

      if (!response || !response.ok) {
        const errText = response ? await response.text() : 'No response';
        throw new Error(`Failed to generate quiz: ${errText}`);
      }

      const data = await response.json();
      const returnedQuiz = data.quiz || data.data?.quiz || data;

      const normalizedQuestions: Question[] = (returnedQuiz?.questions || []).map((q: any, idx: number) => {
        const text = q.text || q.stem || q.question || `Question ${idx + 1}`;
        let options: string[] = [];
        if (Array.isArray(q.options)) {
          options = q.options.map((o: any) => (typeof o === 'string' ? o : (o?.text ?? '')));
        } else if (q.options && typeof q.options === 'object') {
          // map A/B/C/D object to array order
          const order = ['A', 'B', 'C', 'D'];
          options = order.map(k => q.options[k] || q.options[k.toLowerCase()] || '');
        }
        let correctAnswer = 0;
        if (typeof q.correctAnswer === 'number') correctAnswer = q.correctAnswer;
        else if (typeof q.answer === 'string') {
          const idxMap = { a: 0, b: 1, c: 2, d: 3 } as any;
          correctAnswer = idxMap[q.answer.toLowerCase()] ?? 0;
        } else if (typeof q.answer === 'number') correctAnswer = q.answer;

        const explanation = q.explanation || q.reason || '';
        return { text, options, correctAnswer, explanation } as Question;
      });

      const newQuiz: Quiz = {
        _id: returnedQuiz?._id || data.quizId || 'generated',
        title: returnedQuiz?.title || `Auto-generated Quiz (${normalizedQuestions.length} questions)`,
        subject: returnedQuiz?.subject || formData.subject || 'General',
        description: returnedQuiz?.description || '',
        difficulty: returnedQuiz?.difficulty || formData.difficulty || 'medium',
        questions: normalizedQuestions,
        timeLimit: returnedQuiz?.timeLimit,
        isPublic: returnedQuiz?.isPublic ?? false,
      };

      setQuiz(newQuiz);
      setAnswers(new Array(normalizedQuestions.length).fill(-1));
      setView('generated');
    } catch (err: any) {
      setError(err.message || 'Failed to generate quiz');
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

    const qs = quiz?.questions || [];
    let correctCount = 0;
    qs.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    const percentage = qs.length ? (correctCount / qs.length) * 100 : 0;
    setScore(percentage);
    setSubmitted(true);

    // Save quiz result
    try {
      const token = localStorage.getItem('authToken');
      const submitResponse = await fetch(
        `getAPIEndpoint('/quizzes/${quiz._id}/submit`,
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
          await gamificationAPI.awardXP('QUIZ_COMPLETE');
          // Refresh user stats in auth store
          await refreshUserStats();
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

    const qs = quiz?.questions || [];
    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (qs[index] && answer === qs[index].correctAnswer) {
        correctCount++;
      }
    });

    const percentage = qs.length ? (correctCount / qs.length) * 100 : 0;
    setScore(percentage);
    setSubmitted(true);

    // Save quiz result
    try {
      const token = localStorage.getItem('authToken');
      const submitResponse = await fetch(
        `getAPIEndpoint('/quizzes/${quiz._id}/submit`,
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
          await gamificationAPI.awardXP('QUIZ_COMPLETE');
          // Refresh user stats in auth store
          await refreshUserStats();
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
      const response = await fetch(`getAPIEndpoint('/quizzes`, {
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
      const response = await fetch(`getAPIEndpoint('/quizzes/create`, {
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
        setPastedText('');
        setGenerateMode('topic');
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

  const startQuizTaking = async (quiz: Quiz) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/quizzes/${quiz._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quiz');
      }

      const data = await response.json();
      const fullQuiz = data.quiz;

      setSelectedQuiz(fullQuiz);
      setAnswers(new Array(fullQuiz.questions.length).fill(-1));
      setCurrentQuestion(0);
      setSubmitted(false);
      setScore(0);
      setTimeRemaining(fullQuiz.timeLimit || 1800);
      setStartTime(new Date());
      setShowCalculator(false);
      setCalcDisplay('0');
      setCalcPreviousValue(null);
      setCalcOperation(null);
      setCalcWaitingForOperand(false);
      setView('taking');
    } catch (error) {
      console.error('Error starting quiz:', error);
      alert('Failed to start quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!selectedQuiz) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const timeSpent = startTime ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000) : 0;

      console.log('📝 [submitQuiz] Starting submission');
      console.log('📝 [submitQuiz] Quiz ID:', selectedQuiz._id);
      console.log('📝 [submitQuiz] Answers count:', answers.length);
      console.log('📝 [submitQuiz] Answers:', answers);
      console.log('📝 [submitQuiz] Time spent:', timeSpent);

      const response = await fetch(`getAPIEndpoint('/quizzes/${selectedQuiz._id}/submit`, {
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

      console.log('📝 [submitQuiz] Response status:', response.status);
      const data = await response.json();
      console.log('📝 [submitQuiz] Response data:', data);

      if (response.ok) {
        console.log('✅ [submitQuiz] Quiz submitted successfully');
        setQuizResult(data.result);
        setSubmitted(true);
        setView('results');

        // Award XP for completing quiz
        try {
          await gamificationAPI.awardXP('QUIZ_COMPLETE');
          // Refresh user stats in auth store
          await refreshUserStats();
        } catch (xpError) {
          console.error('Failed to award XP for quiz completion:', xpError);
        }
      } else {
        const err = data;
        console.error('❌ [submitQuiz] Failed to submit:', err);
        setError(err.error || 'Failed to submit quiz');
      }
    } catch (err: any) {
      console.error('❌ [submitQuiz] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/quizzes/${quizId}`, {
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
      text: '',
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
      const response = await fetch(`getAPIEndpoint('/quizzes/${selectedQuiz._id}`, {
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

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/quizzes/user/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history);
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
    } else if (view === 'history') {
      fetchHistory();
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
      setQuestions(selectedQuiz.questions || []);
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
                  onClick={() => setView('history')}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 hover:shadow-md transition-all flex items-center gap-2"
                >
                  <History size={20} />
                  View History
                </button>
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
                        <span className="text-gray-600">Subject:</span>
                        <span className="font-medium">{quiz.subject}</span>
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
                      {quiz.isPublic && (
                        <button
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/quiz/${quiz._id}`;
                            navigator.clipboard.writeText(shareUrl);
                            alert('Quiz link copied to clipboard!');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all text-sm flex items-center justify-center gap-2"
                          title="Copy shareable link"
                        >
                          <Share2 size={16} />
                        </button>
                      )}
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
          <div className="max-w-4xl mx-auto">
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
              <QuizSettingsForm form={createForm} onChange={setCreateForm} />

              {/* Questions */}
              <QuestionListEditor questions={questions} onChange={setQuestions} />

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
          <div className="max-w-4xl mx-auto">
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
              <QuestionListEditor questions={questions} onChange={setQuestions} />

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
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create a Quiz</h2>

              <form onSubmit={generateQuiz} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Topic or Subject
                  </label>
                  <div className="flex gap-2 mb-6">
                    <button
                      type="button"
                      onClick={() => setGenerateMode('topic')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${generateMode === 'topic'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      Topic or File
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerateMode('paste')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${generateMode === 'paste'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {generateMode === 'topic' ? (
                    <div className="space-y-6">
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
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Paste Your Text
                      </label>
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="Paste your lecture notes, article, textbook content, or any material to generate questions..."
                        rows={8}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {pastedText.length} characters • Recommended: 500-5000 characters
                      </p>
                    </div>
                  )}

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

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.timeLimit}
                      onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 30 })}
                      min={1}
                      max={180}
                      placeholder="30"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    <p className="text-xs text-gray-500 mt-1">Set the time limit for completing this quiz (1-180 minutes)</p>
                  </div>
                  {/* Close the form's field wrapper */}
                </div>

                <button
                  type="submit"
                  disabled={loading || (generateMode === 'paste' ? !pastedText.trim() : !formData.topic.trim())}
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
        ) : view === 'generated' && quiz ? (
          /* Quiz Preview/Start Screen */
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center mb-8">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900">Quiz Generated Successfully!</h2>
                <p className="text-gray-600 mt-2">Your custom quiz is ready to take</p>
              </div>

              <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{quiz.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Subject:</span>
                    <span className="ml-2 font-medium text-gray-900">{quiz.subject}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Difficulty:</span>
                    <span className="ml-2 font-medium text-gray-900 capitalize">{quiz.difficulty}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Questions:</span>
                    <span className="ml-2 font-medium text-gray-900">{quiz.questions?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Time Limit:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {quiz.timeLimit ? `${Math.floor(quiz.timeLimit / 60)} minutes` : 'No limit'}
                    </span>
                  </div>
                </div>
                {quiz.description && (
                  <p className="mt-4 text-gray-700">{quiz.description}</p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <h4 className="font-semibold text-gray-900">Instructions:</h4>
                <ul className="text-gray-700 text-sm space-y-1 list-disc list-inside">
                  <li>Answer all {quiz.questions?.length || 0} questions</li>
                  <li>You can navigate between questions using Previous/Next buttons</li>
                  {quiz.timeLimit && <li>Time limit: {Math.floor(quiz.timeLimit / 60)} minutes</li>}
                  <li>Submit your quiz when you're ready</li>
                  <li>You'll receive instant feedback with explanations</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    // Start the quiz
                    setSelectedQuiz(quiz);
                    const estimatedMinutes = quiz.timeLimit ? Math.floor(quiz.timeLimit / 60) : Math.max(1, Math.ceil((quiz.questions?.length || 0) * 1.5));
                    setTimeRemaining(estimatedMinutes * 60);
                    setShowCalculator(false);
                    setCalcDisplay('0');
                    setCalcPreviousValue(null);
                    setCalcOperation(null);
                    setCalcWaitingForOperand(false);
                    setView('taking');
                    setCurrentQuestion(0);
                    setAnswers(new Array(quiz.questions?.length || 0).fill(-1));
                    setSubmitted(false);
                    setScore(0);
                  }}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Play size={24} />
                  Start Quiz
                </button>
                <button
                  onClick={() => {
                    setView('create');
                    setQuiz(null);
                  }}
                  className="px-6 py-4 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Generate Another
                </button>
                <button
                  onClick={() => {
                    setView('dashboard');
                    setQuiz(null);
                  }}
                  className="px-6 py-4 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : view === 'history' ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <button
                  onClick={() => setView('dashboard')}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium mb-2"
                >
                  <ChevronLeft size={20} />
                  Back to Dashboard
                </button>
                <h2 className="text-3xl font-bold text-gray-900">Test History</h2>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader size={32} className="animate-spin text-blue-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <History size={64} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No history yet</h3>
                <p className="text-gray-600 mb-6">Take your first quiz to see your performance history!</p>
                <button
                  onClick={() => setView('dashboard')}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all"
                >
                  Go to Quizzes
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Performance Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="text-blue-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-900">Performance Trend</h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...history].reverse()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="completedAt"
                          tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          stroke="#94a3b8"
                          fontSize={12}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                          formatter={(value: number) => [`${value}%`, 'Score']}
                        />
                        <Area
                          type="monotone"
                          dataKey="percentage"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorScore)"
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* History List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <BarChart2 className="text-purple-600" size={24} />
                    <h3 className="text-lg font-semibold text-gray-900">Recent Attempts</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-600 text-sm font-medium">
                        <tr>
                          <th className="px-6 py-4">Quiz Details</th>
                          <th className="px-6 py-4">Result</th>
                          <th className="px-6 py-4 hidden md:table-cell">Questions</th>
                          <th className="px-6 py-4 hidden md:table-cell">Duration</th>
                          <th className="px-6 py-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.map((entry) => (
                          <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-900">{entry.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                  {entry.subject}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.difficulty === 'easy' ? 'bg-green-50 text-green-700' :
                                    entry.difficulty === 'hard' || entry.difficulty === 'veryhard' ? 'bg-red-50 text-red-700' :
                                      'bg-yellow-50 text-yellow-700'
                                  }`}>
                                  {entry.difficulty}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(entry.completedAt).toLocaleString()}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className={`text-xl font-bold ${entry.percentage >= 80 ? 'text-green-600' :
                                    entry.percentage >= 60 ? 'text-yellow-600' :
                                      'text-red-600'
                                  }`}>
                                  {entry.percentage.toFixed(0)}%
                                </span>
                                <span className="text-xs text-gray-500">
                                  {entry.score}/{entry.totalQuestions}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <span className="text-gray-700 font-medium">{entry.totalQuestions}</span>
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="flex items-center gap-1 text-gray-600">
                                <Clock size={14} />
                                <span>{Math.floor(entry.timeSpent / 60)}m {entry.timeSpent % 60}s</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async () => {
                                  // Find the quiz to retake
                                  const quizToFetch = quizzes.find(q => q._id === entry.quizId);
                                  if (quizToFetch) {
                                    startQuizTaking(quizToFetch);
                                  } else {
                                    // If not in current limited list, fetch it
                                    try {
                                      const token = localStorage.getItem('authToken');
                                      const resp = await fetch(`getAPIEndpoint('/quizzes/${entry.quizId}`, {
                                        headers: { Authorization: `Bearer ${token}` },
                                      });
                                      if (resp.ok) {
                                        const data = await resp.json();
                                        startQuizTaking(data.quiz);
                                      }
                                    } catch (e) {
                                      alert("Failed to fetch quiz for retake.");
                                    }
                                  }
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                                title="Retake Quiz"
                              >
                                <Play size={18} />
                                <span className="text-sm font-semibold md:inline hidden">Retake</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
                  {Math.round((score / 100) * ((selectedQuiz?.questions?.length || 0)))} of {selectedQuiz?.questions?.length || 0} correct
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {selectedQuiz?.questions?.map((question, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-2">{question.text}</p>
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <div
                          key={optIndex}
                          className={`p-2 rounded ${optIndex === question.correctAnswer
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
                    const estimatedMinutes = Math.max(1, Math.ceil((quiz?.questions?.length || 0) * 1.5));
                    setTimeRemaining(estimatedMinutes * 60);
                    setShowCalculator(false); // Hide calculator initially
                    setCalcDisplay('0'); // Reset calculator
                    setCalcPreviousValue(null);
                    setCalcOperation(null);
                    setCalcWaitingForOperand(false);
                    setView('taking');
                    setCurrentQuestion(0);
                    setAnswers(new Array(selectedQuiz?.questions?.length || 0).fill(-1));
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
                    setFormData({ topic: '', subject: '', difficulty: 'medium', numQuestions: '5', timeLimit: 30 });
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                >
                  Create Another Quiz
                </button>
                <button
                  onClick={() => setView('history')}
                  className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <History size={20} />
                  History
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
                  style={{ width: `${((currentQuestion + 1) / ((selectedQuiz?.questions?.length || 1))) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Question {currentQuestion + 1} of {selectedQuiz?.questions?.length || 0}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {selectedQuiz?.questions?.[currentQuestion]?.text}
              </h3>

              <div className="space-y-3 mb-8">
                {selectedQuiz?.questions?.[currentQuestion]?.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${answers[currentQuestion] === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[currentQuestion] === index
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

                {currentQuestion === ((selectedQuiz?.questions?.length || 0) - 1) ? (
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
                  {selectedQuiz?.questions?.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestion(index)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${index === currentQuestion
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
