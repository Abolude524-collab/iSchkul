import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Timer, Brain, X, CheckCircle, AlertCircle } from 'lucide-react';
import { CoReaderLayout } from '../layouts/CoReaderLayout';
import { PDFCanvas } from '../components/reader/PDFCanvas';
import { DocxViewer } from '../components/reader/DocxViewer';
import { ChatInterface } from '../components/reader/ChatInterface';
import { usePomodoro } from '../hooks/usePomodoro';

// Types
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: { pageNumber: number; snippet: string }[];
    timestamp: Date;
}

interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

interface QuizData {
    questions: QuizQuestion[];
}

export const CoReaderPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activePage, setActivePage] = useState<number>(1);
    const [fileUrl, setFileUrl] = useState<string>('');
    const [isLoadingDocument, setIsLoadingDocument] = useState(true);
    const [documentError, setDocumentError] = useState<string>('');
    const [fileType, setFileType] = useState<'pdf' | 'docx'>('pdf');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hi there! I'm your AI Co-Reader.\n\nI see you're reading a document. Context tracking is active.`,
            timestamp: new Date()
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    // Fetch document metadata and set up proxy URL
    useEffect(() => {
        if (id) {
            const loadDocument = async () => {
                try {
                    setIsLoadingDocument(true);
                    const token = localStorage.getItem('authToken');
                    
                    // Debug logging
                    console.log('📄 Loading document:', id);
                    console.log('🔑 Token exists:', !!token);
                    console.log('🔑 Token length:', token?.length || 0);
                    console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'MISSING');
                    console.log('🔑 Token starts with "eyJ":', token?.startsWith('eyJ'));
                    
                    // Fetch document metadata to verify it exists
                    const response = await fetch(`http://localhost:5000/api/documents/${id}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    console.log('📡 Response status:', response.status);
                    console.log('📡 Response headers:', {
                        contentType: response.headers.get('content-type'),
                        contentLength: response.headers.get('content-length')
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('❌ API Error Response:', errorText);
                        setDocumentError(`Document not found or you do not have access (${response.status})`);
                        return;
                    }
                    
                    const data = await response.json();
                    console.log('✅ Document metadata received:', data);
                    
                    // Determine file type from metadata
                    const contentType = data.metadata?.contentType || '';
                    const isDocx = contentType.includes('wordprocessingml.document');
                    setFileType(isDocx ? 'docx' : 'pdf');
                    console.log('📋 File type:', isDocx ? 'DOCX' : 'PDF');
                    
                    // Use the backend proxy URL to avoid CORS issues
                    const proxyUrl = `http://localhost:5000/api/documents/${id}/content`;
                    console.log('📍 Setting proxy URL:', proxyUrl);
                    setFileUrl(proxyUrl);
                } catch (error: any) {
                    console.error('🔴 Failed to load document:', {
                        message: error.message,
                        stack: error.stack,
                        error
                    });
                    setDocumentError('Failed to load document: ' + error.message);
                } finally {
                    setIsLoadingDocument(false);
                }
            };
            
            loadDocument();
        } else {
            // Fallback to demo PDF if no ID provided
            console.log('ℹ️ No document ID provided, using demo PDF');
            setFileUrl('http://localhost:5000/api/documents/demo/content');
            setIsLoadingDocument(false);
        }
    }, [id]);

    // Pomodoro & Quiz State
    const { timeLeft, isActive, isBreak, setIsBreak, startTimer, pauseTimer, resetTimer } = usePomodoro();
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);

    // Effect to update context when page changes
    useEffect(() => {
        console.log(`User is now focused on Page ${activePage}`);
    }, [activePage]);

    // Fetch quiz when break starts
    useEffect(() => {
        if (isBreak) {
            fetchQuiz();
        }
    }, [isBreak]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const fetchQuiz = async () => {
        setQuizLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/co-reader/pomodoro-quiz`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    documentId: id,
                    pagesRead: [activePage, Math.max(1, activePage - 1), Math.max(1, activePage - 2)], // Send recent pages
                    difficulty: 'medium'
                })
            });
            const data = await response.json();
            if (data.questions) {
                setQuiz(data);
                setCurrentQuestionIdx(0);
                setSelectedOption(null);
                setShowExplanation(false);
            }
        } catch (error) {
            console.error('Quiz fetch error', error);
        } finally {
            setQuizLoading(false);
        }
    };

    const handleToggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handlePageChange = (page: number) => {
        setActivePage(page);
    };

    const handleSendMessage = async (text: string) => {
        // Add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsTyping(true);

        // Open sidebar if closed
        if (!isSidebarOpen) setIsSidebarOpen(true);

        try {
            // Create empty assistant message
            const aiMsgId = (Date.now() + 1).toString();
            const aiMsg: Message = {
                id: aiMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMsg]);

            // Call Backend API
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/co-reader/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    documentId: id,
                    message: text,
                    context: {
                        currentPage: activePage,
                        previousMessages: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to get response');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader available');

            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            if (data.content) {
                                accumulatedContent += data.content;
                                setMessages((prev) =>
                                    prev.map(m => m.id === aiMsgId ? { ...m, content: accumulatedContent } : m)
                                );
                            }
                        } catch (e) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'Sorry, I encountered an error connecting to the AI service. Please try again.',
                    timestamp: new Date()
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCitationClick = (pageNumber: number) => {
        const pageElement = document.querySelector(`[data-page-number="${pageNumber}"]`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleAnswerSelect = (option: string) => {
        if (selectedOption) return; // Prevent changing answer
        setSelectedOption(option);
        setShowExplanation(true);
    };

    const handleNextQuestion = () => {
        if (!quiz) return;
        if (currentQuestionIdx < quiz.questions.length - 1) {
            setCurrentQuestionIdx(prev => prev + 1);
            setSelectedOption(null);
            setShowExplanation(false);
        } else {
            // Quiz finished
            setIsBreak(false);
            setQuiz(null);
            resetTimer(); // Or start break timer? Usually strict pomodoro goes back to work or long break.
        }
    };

    return (
        <CoReaderLayout
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            sidebar={
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onCitationClick={handleCitationClick}
                    isTyping={isTyping}
                />
            }
        >
            <>
                {/* Floating Timer */}
                <div className="fixed top-4 right-8 z-40 bg-white/90 backdrop-blur shadow-lg rounded-full px-4 py-2 flex items-center gap-3 border border-gray-200">
                    <Timer size={20} className={isActive ? 'text-green-600 animate-pulse' : 'text-gray-500'} />
                    <span className="font-mono font-medium text-lg text-gray-800">{formatTime(timeLeft)}</span>
                    <button
                        onClick={isActive ? pauseTimer : startTimer}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${isActive
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                    >
                        {isActive ? 'PAUSE' : 'START'}
                    </button>
                    <button
                        onClick={resetTimer}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                {isLoadingDocument ? (
                    <div className="flex flex-col items-center justify-center h-96">
                        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-500">Loading document...</p>
                    </div>
                ) : documentError ? (
                    <div className="flex flex-col items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200">
                        <AlertCircle className="text-red-500 mb-2" size={32} />
                        <p className="text-red-700 font-semibold">{documentError}</p>
                    </div>
                ) : fileType === 'docx' ? (
                    <DocxViewer
                        documentId={id || ''}
                        onPageChange={handlePageChange}
                    />
                ) : (
                    <PDFCanvas
                        fileUrl={fileUrl}
                        onPageChange={handlePageChange}
                    />
                )}

                {/* Brain Break Modal */}
                {isBreak && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 m-4 relative animate-in fade-in zoom-in duration-300">
                            <button
                                onClick={() => setIsBreak(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>

                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-600 rounded-full mb-4">
                                    <Brain size={32} />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-800">Brain Break!</h2>
                                <p className="text-gray-600 mt-2">Time to test your retention from the last 25 minutes.</p>
                            </div>

                            {quizLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                                    <p className="text-gray-500">Generating personalized quiz...</p>
                                </div>
                            ) : quiz && quiz.questions.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center text-sm text-gray-500 font-medium">
                                        <span>Question {currentQuestionIdx + 1} of {quiz.questions.length}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded">Difficulty: Medium</span>
                                    </div>

                                    <h3 className="text-xl font-semibold text-gray-900">
                                        {quiz.questions[currentQuestionIdx].question}
                                    </h3>

                                    <div className="space-y-3">
                                        {quiz.questions[currentQuestionIdx].options.map((option, idx) => {
                                            const isSelected = selectedOption === option;
                                            const isCorrect = option === quiz.questions[currentQuestionIdx].correctAnswer; // Assuming exact match string 
                                            // Or if correctAnswer is usage "A", convert options idx to "A"/"B"..
                                            // The backend logic returning "A" vs string value needs alignment.
                                            // Let's assume options are strings and correctAnswer is the STRING value for simplicity here.

                                            let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all relative ";
                                            if (showExplanation) {
                                                if (option === quiz.questions[currentQuestionIdx].correctAnswer) {
                                                    btnClass += "border-green-500 bg-green-50 text-green-700";
                                                } else if (isSelected) {
                                                    btnClass += "border-red-500 bg-red-50 text-red-700";
                                                } else {
                                                    btnClass += "border-gray-100 bg-gray-50 opacity-60";
                                                }
                                            } else {
                                                btnClass += "border-gray-200 hover:border-purple-300 hover:bg-purple-50";
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAnswerSelect(option)}
                                                    disabled={showExplanation}
                                                    className={btnClass}
                                                >
                                                    <span className="font-semibold mr-3">{String.fromCharCode(65 + idx)}.</span>
                                                    {option}
                                                    {showExplanation && option === quiz.questions[currentQuestionIdx].correctAnswer && (
                                                        <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600" size={20} />
                                                    )}
                                                    {showExplanation && isSelected && option !== quiz.questions[currentQuestionIdx].correctAnswer && (
                                                        <AlertCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-red-600" size={20} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {showExplanation && (
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 animate-in fade-in slide-in-from-top-2">
                                            <p className="font-semibold mb-1">Explanation:</p>
                                            <p>{quiz.questions[currentQuestionIdx].explanation}</p>
                                        </div>
                                    )}

                                    {showExplanation && (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                                        >
                                            {currentQuestionIdx < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-red-500">
                                    <p>Failed to load quiz. Please try again later.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </>
        </CoReaderLayout>
    );
};
