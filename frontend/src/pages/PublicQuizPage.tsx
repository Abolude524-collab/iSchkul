import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Loader, AlertCircle, CheckCircle, Calculator, Play } from 'lucide-react';

interface Question {
  _id?: string;
  id?: string;
  text: string;
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
}

const PublicQuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPreviousValue, setCalcPreviousValue] = useState<number | null>(null);
  const [calcOperation, setCalcOperation] = useState<string | null>(null);
  const [calcWaitingForOperand, setCalcWaitingForOperand] = useState(false);
  const [testStarted, setTestStarted] = useState(false);

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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/quizzes/public/${id}`);

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
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (!quiz) return;

    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (answer === quiz.questions[index].correctAnswer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setSubmitted(true);
  };

  const calculatePercentage = () => {
    if (!quiz) return 0;
    return Math.round((score / quiz.questions.length) * 100);
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A', color: 'text-green-600' };
    if (percentage >= 80) return { grade: 'B', color: 'text-blue-600' };
    if (percentage >= 70) return { grade: 'C', color: 'text-yellow-600' };
    if (percentage >= 60) return { grade: 'D', color: 'text-orange-600' };
    return { grade: 'F', color: 'text-red-600' };
  };

  const startTest = () => {
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
        <Footer />
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
        <Footer />
      </div>
    );
  }

  if (!quiz) return null;

  if (!testStarted && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto py-12 px-4">
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
                <div className="text-2xl font-bold text-orange-600 mb-1">{quiz.subject}</div>
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
        <Footer />
      </div>
    );
  }

  if (submitted) {
    const percentage = calculatePercentage();
    const { grade, color } = getGrade(percentage);

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

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-1">{score}</div>
                <div className="text-sm text-blue-700">Correct Answers</div>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <div className={`text-3xl font-bold mb-1 ${color}`}>{grade}</div>
                <div className="text-sm text-green-700">Grade</div>
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
                const isCorrect = userAnswer === question.correctAnswer;
                return (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{index + 1}. {question.text}</h4>
                    <div className="space-y-1">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`p-2 rounded text-sm ${
                            optionIndex === question.correctAnswer
                              ? 'bg-green-100 text-green-800'
                              : optionIndex === userAnswer && !isCorrect
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-50'
                          }`}
                        >
                          {option}
                          {optionIndex === question.correctAnswer && (
                            <span className="ml-2 text-green-600">✓ Correct</span>
                          )}
                          {optionIndex === userAnswer && !isCorrect && (
                            <span className="ml-2 text-red-600">✗ Your answer</span>
                          )}
                        </div>
                      ))}
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto py-8 px-4">
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
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            {quiz.questions[currentQuestion].text}
          </h3>

          <div className="space-y-3 mb-8">
            {quiz.questions[currentQuestion].options.map((option, index) => (
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
      <Footer />
    </div>
  );
};

export { PublicQuizPage };