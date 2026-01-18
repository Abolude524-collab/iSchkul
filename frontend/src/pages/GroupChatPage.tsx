import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { groupAPI } from '../services/api';
import { useAuthStore } from '../services/store';
import { MessageBubble } from '../components/MessageBubble';
import { GroupMemberList } from '../components/GroupMemberList';
import { GroupSettings } from '../components/GroupSettings';

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  tags: string[];
  members: GroupMember[];
  inviteLink?: {
    code: string;
    expiresAt: string;
    maxUses: number;
    currentUses: number;
  };
  createdBy: string;
  createdAt: string;
}

interface GroupMember {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
}

interface GroupMessage {
  _id: string;
  groupId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  attachments?: any[];
  replyTo?: string;
  reactions?: { [emoji: string]: string[] };
  mentions?: string[];
  readBy: string[];
  createdAt: string;
}

export const GroupChatPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadMessages();
      initializeSocket();
    }
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSocket = () => {
    const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001', {
      auth: {
        token: localStorage.getItem('authToken')
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket');
      newSocket.emit('join-group', groupId);
    });

    newSocket.on('group-message', (message: GroupMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('group-member-joined', (data: { userId: string; username: string }) => {
      // Handle member joined
      console.log('Member joined:', data);
    });

    newSocket.on('group-member-left', (data: { userId: string; username: string }) => {
      // Handle member left
      console.log('Member left:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  };

  const loadGroup = async () => {
    try {
      const response = await groupAPI.getGroup(groupId!);
      setGroup(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load group');
    }
  };

  const loadMessages = async () => {
    try {
      const response = await groupAPI.getGroupMessages(groupId!, { limit: 50 });
      setMessages(response.data);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    try {
      const response = await groupAPI.sendGroupMessage(groupId!, {
        content: newMessage.trim(),
        messageType: 'text'
      });

      // Message will be received via socket
      setNewMessage('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId) return;
    try {
      await groupAPI.leaveGroup(groupId);
      navigate('/groups');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to leave group');
    }
  };

  const isAdmin = group?.members.find(m => m.userId === user?.id)?.role === 'admin';
  const isModerator = group?.members.find(m => m.userId === user?.id)?.role === 'moderator';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-center">
          <p className="text-xl mb-4">{error}</p>
          <button
            onClick={() => navigate('/groups')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Group not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/groups')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{group.name}</h1>
              <p className="text-sm text-gray-500">
                {group.members?.length || 0} members • {group.category}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
            >
              👥
            </button>
            {(isAdmin || isModerator) && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
              >
                ⚙️
              </button>
            )}
            <button
              onClick={handleLeaveGroup}
              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isOwn={message.senderId === user?.id}
              showSender={true}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t p-4">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Members Panel */}
      {showMembers && (
        <div className="w-80 bg-white border-l shadow-lg">
          <GroupMemberList
            group={group}
            currentUserId={user?.id || ''}
            onClose={() => setShowMembers(false)}
            onRoleUpdate={loadGroup}
          />
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && isAdmin && (
        <div className="w-80 bg-white border-l shadow-lg">
          <GroupSettings
            group={group}
            onClose={() => setShowSettings(false)}
            onUpdate={loadGroup}
          />
        </div>
      )}
    </div>
  );
};