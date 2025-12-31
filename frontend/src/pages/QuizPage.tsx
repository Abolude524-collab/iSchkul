import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { gamificationAPI } from '../services/api';
import { Loader, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface Quiz {
  _id: string;
  title: string;
  description: string;
  difficulty: string;
  topics: string[];
  questions: Question[];
}

export const QuizPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'create' | 'taking'>('create');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
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

  const generateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
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
            `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/generate/quiz`,
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
          setView('taking');
          setAnswers(new Array(data.quiz.questions.length).fill(-1));
          setUploadedFile(null);
        };
        reader.readAsDataURL(uploadedFile);
        return;
      } else {
        // Send text only
        response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/generate/quiz`,
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
      setView('taking');
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
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/quiz/${quiz._id}/submit`,
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">AI Quiz Generator</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {view === 'create' ? (
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
                  {Math.round((score / 100) * (quiz?.questions.length || 0))} of {quiz?.questions.length} correct
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {quiz?.questions.map((question, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-2">{question.text}</p>
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
                    setView('taking');
                    setCurrentQuestion(0);
                    setAnswers(new Array(quiz?.questions.length || 0).fill(-1));
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
                <h2 className="text-2xl font-bold text-gray-900">{quiz?.title}</h2>
                <button
                  onClick={() => {
                    setView('create');
                    setQuiz(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Exit Quiz
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentQuestion + 1) / (quiz?.questions.length || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Question {currentQuestion + 1} of {quiz?.questions.length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {quiz?.questions[currentQuestion].text}
              </h3>

              <div className="space-y-3 mb-8">
                {quiz?.questions[currentQuestion].options.map((option, index) => (
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

                {currentQuestion === (quiz?.questions.length || 0) - 1 ? (
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
                  {quiz?.questions.map((_, index) => (
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
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};
