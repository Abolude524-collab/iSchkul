import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { Send, Upload, Loader, MessageSquare } from 'lucide-react';

interface Message {
  _id: string;
  content: string;
  userId: string;
  createdAt: string;
  sources?: string[];
}

export const ReaderPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user?.id,
            content: newMessage,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Add user message
      const userMsg: Message = {
        _id: data.messageId,
        content: newMessage,
        userId: user?.id || '',
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMsg]);

      // Add AI response if available
      if (data.aiResponse) {
        const aiMsg: Message = {
          _id: Date.now().toString(),
          content: data.aiResponse,
          userId: 'ai-assistant',
          createdAt: new Date().toISOString(),
          sources: data.sources,
        };
        setMessages(prev => [...prev, aiMsg]);
      }

      setNewMessage('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      alert('PDF uploaded and processed successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Co-Reader AI Assistant</h2>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Upload PDF</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Messages */}
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a PDF and start asking questions!</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex ${msg.userId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.userId === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <p className="text-xs mt-1 opacity-75">
                      Sources: {msg.sources.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 px-4 py-2 rounded-lg">
                  <Loader className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask a question about your uploaded documents..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
};