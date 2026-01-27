import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Timer, Brain, X, CheckCircle, AlertCircle } from 'lucide-react';
import { CoReaderLayout } from '../layouts/CoReaderLayout';
import { PDFCanvas } from '../components/reader/PDFCanvas';
import { DocxViewer } from '../components/reader/DocxViewer';
import { ChatInterface } from '../components/reader/ChatInterface';
import { usePomodoro } from '../hooks/usePomodoro';
import { getAPIEndpoint } from '../services/api';
import { saveDocument, getDocumentContent } from '../services/indexedDB';

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
                    
                    // 1. Try local cache first
                    console.log('📦 Checking offline cache for:', id);
                    const cachedBlob = await getDocumentContent(id);
                    if (cachedBlob) {
                        console.log('✅ Found in offline cache');
                        const localUrl = URL.createObjectURL(cachedBlob);
                        setFileUrl(localUrl);
                        // We might still want metadata to know if it's DOCX or PDF
                    }

                    // 2. If online, fetch metadata and content if needed
                    if (navigator.onLine) {
                        console.log('🌐 Online: Syncing document data...');
                        const response = await fetch(getAPIEndpoint(`/documents/${id}`), {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            const docMetadata = data.metadata || data.data?.metadata || data.document || data;
                            
                            // Determine file type
                            const contentType = docMetadata.contentType || '';
                            const isDocx = contentType.includes('wordprocessingml.document') || docMetadata.filename?.endsWith('.docx');
                            setFileType(isDocx ? 'docx' : 'pdf');

                            // If not cached, or we want the pure content proxy
                            if (!cachedBlob) {
                                console.log('📥 Document not cached, downloading for offline access...');
                                const contentResponse = await fetch(getAPIEndpoint(`/documents/${id}/content`), {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                
                                if (contentResponse.ok) {
                                    const blob = await contentResponse.blob();
                                    await saveDocument(docMetadata, blob);
                                    const localUrl = URL.createObjectURL(blob);
                                    setFileUrl(localUrl);
                                    console.log('💾 Document saved to offline storage');
                                } else {
                                    // Fallback to proxy URL if download fails but metadata succeeded
                                    setFileUrl(getAPIEndpoint(`/documents/${id}/content`));
                                }
                            }
                        } else if (!cachedBlob) {
                            setDocumentError(`Document not found or access denied (${response.status})`);
                        }
                    } else if (!cachedBlob) {
                        setDocumentError('You are offline and this document is not cached for offline viewing.');
                    }
                } catch (error: any) {
                    console.error('🔴 Error loading document:', error);
                    if (!cachedBlob) {
                        setDocumentError('Failed to load document: ' + error.message);
                    }
                } finally {
                    setIsLoadingDocument(false);
                }
            };
            
            loadDocument();
        } else {
            setFileUrl(getAPIEndpoint('/documents/demo/content'));
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
            const response = await fetch(getAPIEndpoint('/co-reader/pomodoro-quiz'), {
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
            const response = await fetch(getAPIEndpoint('/co-reader/chat'), {
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
                <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-40 bg-white/90 backdrop-blur shadow-lg rounded-full px-2 py-1.5 sm:px-4 sm:py-2 flex items-center gap-1.5 sm:gap-3 border border-gray-200">
                    <Timer size={16} className={`sm:w-5 sm:h-5 ${isActive ? 'text-green-600 animate-pulse' : 'text-gray-500'}`} />
                    <span className="font-mono font-medium text-sm sm:text-lg text-gray-800">{formatTime(timeLeft)}</span>
                    <button
                        onClick={isActive ? pauseTimer : startTimer}
                        className={`text-[10px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-medium transition-colors ${isActive
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
                        <X size={14} className="sm:w-4 sm:h-4" />
                    </button>
                </div>

                {isLoadingDocument ? (
                    <div className="flex flex-col items-center justify-center h-96 px-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm sm:text-base text-gray-500">Loading document...</p>
                    </div>
                ) : documentError ? (
                    <div className="flex flex-col items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200 m-2 sm:m-0 px-4">
                        <AlertCircle className="text-red-500 mb-2" size={24} />
                        <p className="text-sm sm:text-base text-red-700 font-semibold text-center">{documentError}</p>
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
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl p-4 sm:p-6 md:p-8 relative animate-in fade-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
                            <button
                                onClick={() => setIsBreak(false)}
                                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 z-10"
                            >
                                <X size={20} className="sm:w-6 sm:h-6" />
                            </button>

                            <div className="text-center mb-6 sm:mb-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 text-purple-600 rounded-full mb-3 sm:mb-4">
                                    <Brain size={24} className="sm:w-8 sm:h-8" />
                                </div>
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Brain Break!</h2>
                                <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2 px-2">Time to test your retention from the last 25 minutes.</p>
                            </div>

                            {quizLoading ? (
                                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3 sm:mb-4"></div>
                                    <p className="text-sm sm:text-base text-gray-500">Generating personalized quiz...</p>
                                </div>
                            ) : quiz && quiz.questions.length > 0 ? (
                                <div className="space-y-4 sm:space-y-6">
                                    <div className="flex flex-wrap justify-between items-center gap-2 text-xs sm:text-sm text-gray-500 font-medium">
                                        <span>Question {currentQuestionIdx + 1} of {quiz.questions.length}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">Difficulty: Medium</span>
                                    </div>

                                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
                                        {quiz.questions[currentQuestionIdx].question}
                                    </h3>

                                    <div className="space-y-2 sm:space-y-3">
                                        {quiz.questions[currentQuestionIdx].options.map((option, idx) => {
                                            const isSelected = selectedOption === option;
                                            const isCorrect = option === quiz.questions[currentQuestionIdx].correctAnswer; // Assuming exact match string 
                                            // Or if correctAnswer is usage "A", convert options idx to "A"/"B"..
                                            // The backend logic returning "A" vs string value needs alignment.
                                            // Let's assume options are strings and correctAnswer is the STRING value for simplicity here.

                                            let btnClass = "w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 text-left text-sm sm:text-base transition-all relative ";
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
                                                    <span className="font-semibold mr-2 sm:mr-3 text-sm sm:text-base">{String.fromCharCode(65 + idx)}.</span>
                                                    <span className="pr-8">{option}</span>
                                                    {showExplanation && option === quiz.questions[currentQuestionIdx].correctAnswer && (
                                                        <CheckCircle className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-green-600" size={18} />
                                                    )}
                                                    {showExplanation && isSelected && option !== quiz.questions[currentQuestionIdx].correctAnswer && (
                                                        <AlertCircle className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {showExplanation && (
                                        <div className="bg-blue-50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-blue-100 text-blue-800 animate-in fade-in slide-in-from-top-2">
                                            <p className="font-semibold mb-1 text-sm sm:text-base">Explanation:</p>
                                            <p className="text-sm sm:text-base">{quiz.questions[currentQuestionIdx].explanation}</p>
                                        </div>
                                    )}

                                    {showExplanation && (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="w-full py-2.5 sm:py-3 bg-gray-900 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-800 transition-colors"
                                        >
                                            {currentQuestionIdx < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 sm:py-10 text-red-500 px-4">
                                    <p className="text-sm sm:text-base">Failed to load quiz. Please try again later.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </>
        </CoReaderLayout>
    );
};
