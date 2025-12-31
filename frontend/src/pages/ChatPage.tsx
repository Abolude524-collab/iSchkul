import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { FlashcardPreview } from '../components/FlashcardPreview';
import { useAuthStore } from '../services/store';
import { usePersonalChatStore } from '../services/store';
import { personalChatAPI } from '../services/api';
import { Send, Loader, AlertCircle, Users, Settings, MessageSquare, User, MessageCircle } from 'lucide-react';

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  type: string;
}

interface Group {
  _id: string;
  name: string;
  description: string;
  memberIds: string[];
}

interface PersonalChat {
  _id: string;
  participants: string[];
  lastMessage: any;
  otherParticipant: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  } | null;
  createdAt: string;
}

interface PersonalMessage {
  _id: string;
  sender: string;
  content: string;
  messageType: string;
  timestamp: string;
  readBy: string[];
}

type ChatMode = 'groups' | 'personal' | 'ai';

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { chats, currentChatId, chatMessages, setChats, setCurrentChat, setChatMessages, addChatMessage } = usePersonalChatStore();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedPersonalChat, setSelectedPersonalChat] = useState<PersonalChat | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('groups');
  const [isAIMode, setIsAIMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchGroups();
    fetchPersonalChats();
  }, [user, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMessages]);

  useEffect(() => {
    if (selectedGroup && chatMode === 'groups') {
      fetchMessages();
      fetchOnlineUsers();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedGroup, chatMode]);

  useEffect(() => {
    if (selectedPersonalChat && chatMode === 'personal') {
      fetchPersonalMessages();
      const interval = setInterval(fetchPersonalMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPersonalChat, chatMode]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('authToken');
      // This would call the groups endpoint
      // For now, mock data
      setGroups([
        {
          _id: '1',
          name: 'General',
          description: 'General discussion',
          memberIds: [user?._id || ''],
        },
        {
          _id: '2',
          name: 'Physics Study Group',
          description: 'Discuss physics concepts',
          memberIds: [user?._id || ''],
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    try {
      const token = localStorage.getItem('authToken');
      // Mock messages for demo
      setMessages([
        {
          _id: '1',
          content: 'Hey everyone! Did you finish the homework?',
          sender: { _id: '1', name: 'John Doe', avatar: '' },
          createdAt: new Date(Date.now() - 300000).toISOString(),
          type: 'text',
        },
        {
          _id: '2',
          content: 'Almost done! Just need to review chapter 5.',
          sender: { _id: '2', name: 'Jane Smith', avatar: '' },
          createdAt: new Date(Date.now() - 180000).toISOString(),
          type: 'text',
        },
        {
          _id: '3',
          content: 'Anyone want to study together tonight?',
          sender: { _id: '1', name: 'John Doe', avatar: '' },
          createdAt: new Date(Date.now() - 60000).toISOString(),
          type: 'text',
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchOnlineUsers = async () => {
    if (!selectedGroup) return;
    try {
      const token = localStorage.getItem('authToken');
      // Mock online users
      setOnlineUsers([
        { _id: '1', name: 'John Doe', isOnline: true },
        { _id: '2', name: 'Jane Smith', isOnline: true },
        { _id: '3', name: 'Bob Johnson', isOnline: false },
      ]);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchPersonalChats = async () => {
    try {
      const response = await personalChatAPI.listChats();
      setChats(response.data.chats);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchPersonalMessages = async () => {
    if (!selectedPersonalChat) return;
    try {
      const response = await personalChatAPI.getChatMessages(selectedPersonalChat._id);
      setChatMessages(response.data.messages);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      // This would be a users search API - for now, mock data
      setSearchResults([
        { _id: '1', name: 'John Doe', username: 'johndoe' },
        { _id: '2', name: 'Jane Smith', username: 'janesmith' },
      ].filter(user => user.name.toLowerCase().includes(query.toLowerCase())));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (chatMode === 'personal' && !selectedPersonalChat) return;
    if (chatMode === 'groups' && !selectedGroup && !isAIMode) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      let response;
      let newMsg;

      if (chatMode === 'personal' && selectedPersonalChat) {
        // Send personal message
        response = await personalChatAPI.sendMessage(selectedPersonalChat._id, newMessage);

        if (response.data.success) {
          const messageData = response.data.message;
          addChatMessage({
            _id: messageData._id,
            sender: messageData.sender._id,
            content: messageData.content,
            messageType: messageData.messageType,
            timestamp: messageData.timestamp,
            readBy: messageData.readBy
          });
        }
      } else if (isAIMode) {
        // Use chat API for AI responses
        response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/chat/send`,
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
        newMsg = {
          _id: data.messageId,
          content: newMessage,
          sender: {
            _id: user?.id || '',
            name: user?.name || 'You',
            avatar: user?.avatar,
          },
          createdAt: new Date().toISOString(),
          type: 'text',
        };

        setMessages(prev => [...prev, newMsg]);

        // Add AI response if available
        if (data.aiResponse) {
          const aiMsg = {
            _id: Date.now().toString(),
            content: data.aiResponse,
            sender: {
              _id: 'ai-assistant',
              name: 'AI Assistant',
              avatar: null,
            },
            createdAt: new Date().toISOString(),
            type: 'text',
            sources: data.sources,
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      } else {
        // Use realtime API for group messages
        response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/realtime/send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content: newMessage,
              groupId: selectedGroup!._id,
            }),
          }
        );

        if (!response.ok) throw new Error('Failed to send message');

        newMsg = {
          _id: Date.now().toString(),
          content: newMessage,
          sender: {
            _id: user?.id || '',
            name: user?.name || 'You',
            avatar: user?.avatar,
          },
          createdAt: new Date().toISOString(),
          type: 'text',
        };

        setMessages(prev => [...prev, newMsg]);
      }

      setNewMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const token = localStorage.getItem('authToken');
      // Mock create group
      const newGroup: Group = {
        _id: Date.now().toString(),
        name: newGroupName,
        description: '',
        memberIds: [user?.id || ''],
      };
      setGroups([...groups, newGroup]);
      setNewGroupName('');
      setShowNewGroup(false);
      setSelectedGroup(newGroup);
      setChatMode('groups');
      setIsAIMode(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartPersonalChat = async (contactId: string) => {
    try {
      const response = await personalChatAPI.createChat(contactId);
      const newChat = response.data.chat;
      setChats(prev => [...prev, newChat]);
      setSelectedPersonalChat(newChat);
      setChatMode('personal');
      setShowUserSearch(false);
      setUserSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSelectPersonalChat = (chat: PersonalChat) => {
    setSelectedPersonalChat(chat);
    setCurrentChat(chat._id);
    setChatMode('personal');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow flex">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Chat Type Tabs */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => {
                  setChatMode('groups');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatMode === 'groups' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users size={16} className="inline mr-2" />
                Groups
              </button>
              <button
                onClick={() => {
                  setChatMode('personal');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatMode === 'personal' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <User size={16} className="inline mr-2" />
                Personal
              </button>
              <button
                onClick={() => {
                  setChatMode('ai');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(true);
                  setMessages([]);
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatMode === 'ai' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🤖 AI
              </button>
            </div>

            {chatMode === 'groups' && (
              <>
                <button
                  onClick={() => setShowNewGroup(!showNewGroup)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold"
                >
                  + New Group
                </button>

                {showNewGroup && (
                  <form onSubmit={handleCreateGroup} className="mt-4 space-y-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewGroup(false)}
                        className="flex-1 px-3 py-1 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {chatMode === 'personal' && (
              <>
                <button
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold"
                >
                  + New Chat
                </button>

                {showUserSearch && (
                  <div className="mt-4 space-y-2">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        searchUsers(e.target.value);
                      }}
                      placeholder="Search users..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                    {searchResults.map((user) => (
                      <button
                        key={user._id}
                        onClick={() => handleStartPersonalChat(user._id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat List */}
          <div className="flex-grow overflow-y-auto">
            {chatMode === 'groups' && groups.map((group) => (
              <button
                key={group._id}
                onClick={() => {
                  setSelectedGroup(group);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedGroup?._id === group._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <p className="font-semibold text-gray-900">{group.name}</p>
                <p className="text-xs text-gray-500 mt-1">{group.memberIds.length} members</p>
              </button>
            ))}

            {chatMode === 'personal' && chats.map((chat) => (
              <button
                key={chat._id}
                onClick={() => handleSelectPersonalChat(chat)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedPersonalChat?._id === chat._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <p className="font-semibold text-gray-900">{chat.otherParticipant?.name || 'Unknown User'}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
                </p>
              </button>
            ))}

            {chatMode === 'ai' && (
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(true);
                  setMessages([]);
                }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isAIMode ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <p className="font-semibold text-gray-900">🤖 AI Assistant</p>
                <p className="text-xs text-gray-500 mt-1">Ask questions about your documents</p>
              </button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-grow hidden md:flex flex-col bg-white">
          {(selectedGroup || selectedPersonalChat || isAIMode) ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {isAIMode ? 'AI Assistant' : selectedPersonalChat ? selectedPersonalChat.otherParticipant?.name : selectedGroup?.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isAIMode ? 'Ask questions about your uploaded documents' : selectedPersonalChat ? 'Personal chat' : `${onlineUsers.filter(u => u.isOnline).length} online`}
                  </p>
                </div>
                {!isAIMode && !selectedPersonalChat && (
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                      <Users size={20} className="text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                      <Settings size={20} className="text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {(chatMode === 'personal' ? chatMessages : messages).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  (chatMode === 'personal' ? chatMessages : messages).map((message: any) => (
                    <div
                      key={message._id}
                      className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          message.sender === user?.id
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.sender !== user?.id && (
                          <p className="text-xs font-semibold mb-1 opacity-75">
                            {chatMode === 'personal' ? selectedPersonalChat?.otherParticipant?.name : message.sender.name}
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        {(message as any).sources && (message as any).sources.length > 0 && (
                          <p className="text-xs mt-1 opacity-75">
                            Sources: {(message as any).sources.join(', ')}
                          </p>
                        )}
                        <p className={`text-xs mt-1 ${message.sender === user?.id ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(chatMode === 'personal' ? message.timestamp : message.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      isAIMode ? "Ask a question about your documents..." :
                      selectedPersonalChat ? `Message ${selectedPersonalChat.otherParticipant?.name}...` :
                      "Type a message..."
                    }
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newMessage.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={64} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {chatMode === 'groups' ? 'Select a group to start chatting' :
                   chatMode === 'personal' ? 'Select a personal chat or start a new one' :
                   'Select AI Assistant to ask questions'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};
