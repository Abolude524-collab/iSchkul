import React, { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, BrainCircuit } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: { pageNumber: number; snippet: string }[];
    timestamp: Date;
}

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
    onCitationClick: (pageNumber: number) => void;
    isTyping: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    onSendMessage,
    onCitationClick,
    isTyping
}) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center gap-2 shadow-sm">
                <BrainCircuit className="text-purple-600" size={24} />
                <h2 className="font-semibold text-gray-800">AI Co-Reader</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>Ask me anything about this document!</p>
                        <div className="mt-6 space-y-2">
                            <button
                                onClick={() => onSendMessage("Summarize this document")}
                                className="block w-full p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-left transition-colors"
                            >
                                Summarize this document
                            </button>
                            <button
                                onClick={() => onSendMessage("What are the key concepts?")}
                                className="block w-full p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-left transition-colors"
                            >
                                What are the key concepts?
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                }`}
                        >
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>

                            {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200/20 flex flex-wrap gap-2">
                                    {msg.citations.map((citation, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onCitationClick(citation.pageNumber)}
                                            className="text-xs bg-black/10 hover:bg-black/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            <BookOpen size={10} />
                                            Page {citation.pageNumber}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl p-4 rounded-bl-none">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your question..."
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
