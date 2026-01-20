import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
// FlashcardPreview is imported but was unused; kept it in case you need it later
import { FlashcardPreview } from '../components/FlashcardPreview';
import { GroupMemberList } from '../components/GroupMemberList';
import { GroupSettings } from '../components/GroupSettings';
import { VideoCall } from '../components/VideoCall';
import { useAuthStore } from '../services/store';
import { usePersonalChatStore } from '../services/store';
import { personalChatAPI, groupAPI, chatAPI } from '../services/api';
import { Send, Loader, AlertCircle, Users, Settings, MessageSquare, User, Bell, UserPlus, ArrowLeft, Video, Phone } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

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
  sources?: string[]; // Added to fix AI source rendering
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

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

interface ContactRequest {
  _id: string;
  sender: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  };
  recipient: {
    _id: string;
    name: string;
    username: string;
  };
  status: string;
  createdAt: string;
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  createdAt: string;
  createdBy: {
    name: string;
    username: string;
  };
}

type ChatMode = 'groups' | 'personal' | 'ai' | 'notifications';

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { chats, setChats, setCurrentChat, chatMessages, setChatMessages, addChatMessage } = usePersonalChatStore();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedPersonalChat, setSelectedPersonalChat] = useState<PersonalChat | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('groups');
  const [isAIMode, setIsAIMode] = useState(false);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('study');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [newGroupTags, setNewGroupTags] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [newGroupMemberSearch, setNewGroupMemberSearch] = useState('');
  const [newGroupAvailableUsers, setNewGroupAvailableUsers] = useState<any[]>([]);
  const [newGroupLoadingUsers, setNewGroupLoadingUsers] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [showChatSettings, setShowChatSettings] = useState(false);
  const [chatAbout, setChatAbout] = useState('');
  const [chatAvatar, setChatAvatar] = useState('');
  const [useMainProfile, setUseMainProfile] = useState(true);

  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerName?: string; roomId: string; isGroup?: boolean } | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneAudioRef = useRef<AudioContext | null>(null);

  const stopIncomingRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current as unknown as number);
      ringIntervalRef.current = null;
    }
    if (ringtoneAudioRef.current) {
      try {
        ringtoneAudioRef.current.close();
      } catch (err) {
        console.warn('[CALL] Failed to close ringtone audio context', err);
      }
      ringtoneAudioRef.current = null;
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchGroups();
    fetchPersonalChats();
    fetchChatProfile();
    fetchContactRequests();
    fetchAdminNotifications();

    // Connect to Socket.IO
    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: {
        token: localStorage.getItem('authToken')
      }
    });

    socketRef.current.on('connect', () => {
      // Join user room for notifications
      socketRef.current?.emit('join-user', user?.id);
    });

    socketRef.current.on('new-message', (message) => {
      console.log('Received new-message event:', message);
      if (selectedGroup && message.groupId === selectedGroup._id) {
        console.log('Adding message to current group');
        setMessages(prev => {
          const currentMessages = Array.isArray(prev) ? prev : [];
          return [...currentMessages, message];
        });
      } else {
        console.log('Message not for current group', { selectedGroup: selectedGroup?._id, messageGroup: message.groupId });
      }
    });

    socketRef.current.on('group-message', (message: GroupMessage) => {
      console.log('Received group-message event:', message);
      if (selectedGroup && message.groupId === selectedGroup._id) {
        console.log('Adding group message to current group');
        setMessages(prev => {
          const currentMessages = Array.isArray(prev) ? prev : [];
          return [...currentMessages, message];
        });
      }
    });

    socketRef.current.on('group-member-joined', (data: { userId: string; username: string }) => {
      // Handle member joined
      console.log('Member joined:', data);
      if (selectedGroup) {
        fetchGroups(); // Refresh group data
      }
    });

    socketRef.current.on('group-member-left', (data: { userId: string; username: string }) => {
      // Handle member left
      console.log('Member left:', data);
      if (selectedGroup) {
        fetchGroups(); // Refresh group data
      }
    });

    socketRef.current.on('personal-message', (data) => {
      const { chatId, message } = data;
      if (selectedPersonalChat && chatId === selectedPersonalChat._id) {
        addChatMessage(message);
      }
    });

    socketRef.current.on('contact-request', (request) => {
      // Add to requests
      setContactRequests(prev => [request, ...prev]);
    });

    socketRef.current.on('request-accepted', (request) => {
      alert(`Your connect request to ${request.recipient.name} was accepted!`);
    });

    socketRef.current.on('request-rejected', (request) => {
      alert(`Your connect request to ${request.recipient.name} was rejected.`);
    });

    // Handle incoming personal chat calls (Google Meet/Zoom style)
    socketRef.current.on('call-incoming', (data: { callerId: string; callerName?: string; roomId: string; timestamp?: number; isGroup?: boolean }) => {
      console.log('[CALL] Incoming call:', data);
      stopIncomingRingtone();
      setIncomingCall({ callerId: data.callerId, callerName: data.callerName, roomId: data.roomId, isGroup: data.isGroup });

      // Start simple ringtone loop (short beep every second)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneAudioRef.current = audioContext;

      const playBeep = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      };
      playBeep();
      ringIntervalRef.current = setInterval(playBeep, 1000);
    });

    // Caller notified that callee accepted
    socketRef.current.on('call-accepted', ({ roomId }) => {
      console.log('[CALL] Accepted:', roomId);
      stopIncomingRingtone();
      setInCall(true);
    });

    // Caller notified that callee declined
    socketRef.current.on('call-declined', ({ roomId }) => {
      console.log('[CALL] Declined:', roomId);
      stopIncomingRingtone();
      setIncomingCall(null);
      alert('Call was declined.');
      setInCall(false);
    });

    return () => {
      stopIncomingRingtone();
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  // Debug: Log when groups state changes
  useEffect(() => {
    console.log('[Groups State Changed]', groups);
    console.log('[Groups State] Length:', groups?.length);
    console.log('[Groups State] Is Array:', Array.isArray(groups));
  }, [groups]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && !(event.target as Element).closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (selectedGroup && chatMode === 'groups') {
      fetchMessages();
      fetchOnlineUsers();
      socketRef.current?.emit('join-group', selectedGroup._id);
      // Remove polling
      // const interval = setInterval(fetchMessages, 3000);
      // return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, chatMode]);

  useEffect(() => {
    if (selectedPersonalChat && chatMode === 'personal') {
      fetchPersonalMessages();
      socketRef.current?.emit('join-personal-chat', selectedPersonalChat._id);
      // Removed polling since we have real-time updates via Socket.IO
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonalChat, chatMode]);

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      console.log('Fetching groups...');
      const response = await groupAPI.getGroups();
      console.log('Groups API response:', response);
      console.log('Response.data:', response.data);

      // Handle different response formats with proper logic
      let groupsData: any[] = [];
      if (response.data?.groups && Array.isArray(response.data.groups)) {
        groupsData = response.data.groups;
        console.log('Extracted from response.data.groups');
      } else if (Array.isArray(response.data)) {
        groupsData = response.data;
        console.log('Extracted from response.data (array)');
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        groupsData = response.data.data;
        console.log('Extracted from response.data.data');
      }

      console.log('Extracted groupsData:', groupsData);
      console.log('Is array?', Array.isArray(groupsData));
      console.log('Groups count:', groupsData.length);

      setGroups(groupsData);
      console.log('Groups set to state with', groupsData.length, 'items');
    } catch (err: any) {
      console.error('Failed to load groups:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.message || 'Failed to load groups');
      setGroups([]); // Ensure groups is always an array
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    try {
      const response = await groupAPI.getGroupMessages(selectedGroup._id, { limit: 50 });
      // Ensure we always set an array
      const messagesData = Array.isArray(response.data?.messages) ? response.data.messages :
        Array.isArray(response.data) ? response.data : [];
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load messages');
      setMessages([]); // Set empty array on error
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
      setLoadingChats(true);
      const response = await personalChatAPI.listChats();
      setChats(response.data.chats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchPersonalMessages = async () => {
    if (!selectedPersonalChat) return;
    try {
      const response = await personalChatAPI.getChatMessages(selectedPersonalChat._id);
      setChatMessages(response.data.messages || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchChatProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/users/${user?.id}/chat-profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setChatAbout(data.user.chatAbout || '');
        setChatAvatar(data.user.chatAvatar || '');
        setUseMainProfile(!data.user.chatAbout && !data.user.chatAvatar);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchContactRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/contact-requests/received`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setContactRequests(data.requests);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchAdminNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminNotifications(data.notifications || []);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`getAPIEndpoint('/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // Update local state
      setAdminNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`getAPIEndpoint('/notifications/read-all`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // Update local state
      setAdminNotifications(prev =>
        prev.map(notification => ({ ...notification, isRead: true }))
      );
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to search users');
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (err: any) {
      console.error(err);
      setSearchResults([]);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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

        if (response.data.message) {
          const messageData = response.data.message;
          addChatMessage({
            _id: messageData._id,
            sender: messageData.sender, // Already a string ID from backend
            content: messageData.content,
            messageType: messageData.messageType,
            timestamp: messageData.timestamp,
            readBy: messageData.readBy
          });
        }
      } else if (isAIMode) {
        // Use chat API for AI responses
        response = await fetch(
          `getAPIEndpoint('/chat/send`,
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

        // Add user message locally
        newMsg = {
          _id: data.messageId || Date.now().toString(),
          content: newMessage,
          sender: {
            _id: user?.id || '',
            name: user?.name || 'You',
          },
          createdAt: new Date().toISOString(),
          type: 'text',
          status: 'sending'
        };

        setMessages(prev => [...prev, newMsg as Message]);

        // Simulate status update
        setTimeout(() => {
          setMessages(prev => prev.map(msg =>
            msg._id === newMsg._id ? { ...msg, status: 'sent' as const } : msg
          ));
        }, 500);

        // Add AI response if available
        if (data.aiResponse) {
          const aiMsg: Message = {
            _id: (Date.now() + 1).toString(),
            content: data.aiResponse,
            sender: {
              _id: 'ai-assistant',
              name: 'AI Assistant',
            },
            createdAt: new Date().toISOString(),
            type: 'text',
            sources: data.sources,
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      } else {
        // Send group message using new API
        console.log('Sending group message to:', selectedGroup!._id);
        const response = await groupAPI.sendGroupMessage(selectedGroup!._id, {
          content: newMessage.trim(),
          messageType: 'text'
        });
        console.log('Group message sent response:', response.data);

        // Immediately add message to UI
        if (response.data?.message) {
          setMessages(prev => {
            const currentMessages = Array.isArray(prev) ? prev : [];
            return [...currentMessages, response.data.message];
          });
        }

        // Emit socket event for other users
        socketRef.current?.emit('send-message', {
          groupId: selectedGroup!._id,
          content: newMessage.trim(),
          userId: user?.id
        });

        setNewMessage('');
      }

      setNewMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = () => {
    if (selectedPersonalChat) {
      const recipientId = selectedPersonalChat.otherParticipant?._id;
      if (!recipientId) {
        alert('Cannot start call: recipient not found.');
        return;
      }

      // Initiate personal call (Google Meet/Zoom style)
      socketRef.current?.emit('initiate-personal-call', {
        callerId: user?.id,
        callerName: user?.name || user?.username || 'Someone',
        recipientId,
        roomId: selectedPersonalChat._id,
        isGroup: false
      });

      alert('Calling... Waiting for recipient to accept.');
      return; // Wait for call-accepted before starting VideoCall
    }

    if (selectedGroup) {
      // Initiate group call - notify all members
      socketRef.current?.emit('initiate-group-call', {
        callerId: user?.id,
        callerName: user?.name || user?.username || 'Someone',
        groupId: selectedGroup._id,
        groupName: selectedGroup.name
      });
      return; // Wait for members to accept
    }
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;

    stopIncomingRingtone();

    if (incomingCall.isGroup) {
      // Accepting a group call
      socketRef.current?.emit('accept-group-call', {
        callerId: incomingCall.callerId,
        userId: user?.id,
        groupId: incomingCall.roomId
      });

      // Find and select the group
      const group = groups.find((g: any) => g._id === incomingCall.roomId);
      if (group) {
        setSelectedGroup(group);
        setSelectedPersonalChat(null);
        setChatMode('groups');
        setShowMobileChat(true);
      }
    } else {
      // Accepting a personal call
      const chat = chats.find((c: any) => c._id === incomingCall.roomId);
      const fallbackChat = chat || {
        _id: incomingCall.roomId,
        participants: [incomingCall.callerId, user?.id].filter(Boolean),
        lastMessage: null,
        otherParticipant: {
          _id: incomingCall.callerId,
          name: incomingCall.callerName || 'Caller',
          username: incomingCall.callerName || 'caller'
        },
        createdAt: new Date().toISOString()
      };

      setSelectedPersonalChat(fallbackChat as any);
      setCurrentChat(fallbackChat._id);
      setChatMode('personal');
      setShowMobileChat(true);

      socketRef.current?.emit('accept-call', {
        callerId: incomingCall.callerId,
        recipientId: user?.id,
        roomId: incomingCall.roomId
      });
    }

    setIncomingCall(null);
    setInCall(true);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;

    stopIncomingRingtone();

    if (incomingCall.isGroup) {
      socketRef.current?.emit('decline-group-call', {
        callerId: incomingCall.callerId,
        userId: user?.id,
        groupId: incomingCall.roomId
      });
    } else {
      socketRef.current?.emit('decline-call', {
        callerId: incomingCall.callerId,
        recipientId: user?.id,
        roomId: incomingCall.roomId
      });
    }

    setIncomingCall(null);
  };

  const handleLoadGroupMembers = async (query: string = '') => {
    setNewGroupLoadingUsers(true);
    try {
      // Get contacts from personal chat list
      const response = await personalChatAPI.listChats();
      const chats = Array.isArray(response.data?.chats) ? response.data.chats :
        Array.isArray(response.chats) ? response.chats :
          Array.isArray(response.data) ? response.data : [];

      // Extract other participants from chats
      let contacts = chats
        .map((chat: any) => chat?.otherParticipant)
        .filter((p: any) => p && p._id !== user?._id);

      // Remove duplicates
      contacts = Array.from(new Map(contacts.map((c: any) => [c._id, c])).values());

      // Filter by search query if provided
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        contacts = contacts.filter((c: any) =>
          c.name?.toLowerCase().includes(lowerQuery) ||
          c.username?.toLowerCase().includes(lowerQuery)
        );
      }

      setNewGroupAvailableUsers(contacts);
    } catch (err: any) {
      console.error('Failed to load contacts:', err);
      setNewGroupAvailableUsers([]);
    } finally {
      setNewGroupLoadingUsers(false);
    }
  };

  const handleAddGroupMember = (userId: string) => {
    if (!newGroupMemberIds.includes(userId)) {
      setNewGroupMemberIds([...newGroupMemberIds, userId]);
    }
  };

  const handleRemoveGroupMember = (userId: string) => {
    setNewGroupMemberIds(newGroupMemberIds.filter(id => id !== userId));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const groupData = {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        category: newGroupCategory,
        isPrivate: newGroupIsPrivate,
        tags: newGroupTags.split(',').map(tag => tag.trim()).filter(tag => tag),
        memberIds: newGroupMemberIds
      };

      const response = await groupAPI.createGroup(groupData);
      const newGroup = response.data.group;
      // Refresh groups list from server to ensure sync
      await fetchGroups();
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupCategory('study');
      setNewGroupIsPrivate(false);
      setNewGroupTags('');
      setNewGroupMemberIds([]);
      setNewGroupMemberSearch('');
      setNewGroupAvailableUsers([]);
      setShowNewGroup(false);
      setSelectedGroup(newGroup);
      setChatMode('groups');
      setIsAIMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create group');
    }
  };

  const handleStartPersonalChat = async (contactId: string) => {
    try {
      const response = await personalChatAPI.createChat(contactId);
      const newChat = response.data.chat;
      setChats([...chats, newChat]);
      setSelectedPersonalChat(newChat);
      setChatMode('personal');
      setShowUserSearch(false);
      setUserSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveChatProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/users/chat-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatAbout: useMainProfile ? '' : chatAbout,
          chatAvatar: useMainProfile ? '' : chatAvatar,
        }),
      });
      if (response.ok) {
        setShowChatSettings(false);
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendConnectRequest = async (recipientId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/contact-requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId }),
      });
      if (response.ok) {
        setShowUserSearch(false);
        setUserSearchQuery('');
        setSearchResults([]);
        alert('Connect request sent!');
      } else {
        const data = await response.json();
        throw new Error(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/contact-requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Refresh requests
        fetchContactRequests();
        // Create personal chat with the accepted contact
        try {
          const chatResponse = await personalChatAPI.createChat(data.request.sender);
          // Refresh personal chats to show the new chat
          fetchPersonalChats();
          // Switch to personal chat tab
          setChatMode('personal');
          setSelectedGroup(null);
          setSelectedPersonalChat(null);
          setIsAIMode(false);
          setShowMobileChat(false);
        } catch (chatErr) {
          console.error('Error creating chat:', chatErr);
        }
      } else {
        throw new Error('Failed to accept request');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`getAPIEndpoint('/contact-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchContactRequests();
      } else {
        throw new Error('Failed to reject request');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSelectPersonalChat = (chat: PersonalChat) => {
    setSelectedPersonalChat(chat);
    setCurrentChat(chat._id);
    setChatMode('personal');
    setShowMobileChat(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar - Hidden on mobile when chatting */}
        <div className={`${showMobileChat ? 'hidden' : 'flex'} w-full md:w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0`}>
          {/* Chat Type Tabs - Mobile optimized */}
          <div className="p-3 md:p-4 border-b border-gray-200">
            <div className="flex gap-1 mb-3 md:mb-4">
              <button
                onClick={() => {
                  setChatMode('groups');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                  setShowMobileChat(false);
                }}
                className={`flex-1 px-2 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors ${chatMode === 'groups' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Users size={14} className="inline mr-1 md:mr-2" />
                <span className="hidden sm:inline">Groups</span>
                <span className="sm:hidden">Grp</span>
              </button>
              <button
                onClick={() => {
                  setChatMode('personal');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                  setShowMobileChat(false);
                }}
                className={`flex-1 px-2 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors ${chatMode === 'personal' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <User size={14} className="inline mr-1 md:mr-2" />
                <span className="hidden sm:inline">Personal</span>
                <span className="sm:hidden">Pers</span>
              </button>
              <button
                onClick={() => {
                  setChatMode('notifications');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                  setShowMobileChat(false);
                  fetchContactRequests();
                }}
                className={`flex-1 px-2 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors ${chatMode === 'notifications' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Bell size={14} className="inline mr-1 md:mr-2" />
                <span className="hidden sm:inline">Notifs</span>
                <span className="sm:hidden">Not</span>
                {contactRequests.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                    {contactRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setChatMode('ai');
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(true);
                  setMessages([]);
                  setShowMobileChat(false);
                }}
                className={`flex-1 px-2 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors ${chatMode === 'ai' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                🤖 <span className="hidden sm:inline">AI</span>
              </button>
            </div>

            {chatMode === 'groups' && (
              <>
                <button
                  onClick={() => setShowNewGroup(!showNewGroup)}
                  className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-xs md:text-sm font-semibold"
                >
                  + New Group
                </button>

                {showNewGroup && (
                  <div className="mt-3 bg-gray-50 rounded-lg flex flex-col max-h-96 overflow-hidden">
                    <div className="px-3 pt-3 pb-2">
                      <h4 className="font-semibold text-sm text-gray-900">Create New Group</h4>
                    </div>

                    <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 overflow-hidden">
                      {/* Scrollable form body */}
                      <div className="flex-1 overflow-y-auto px-3 space-y-3">
                        <div>
                          <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <textarea
                            value={newGroupDescription}
                            onChange={(e) => setNewGroupDescription(e.target.value)}
                            placeholder="Group description (optional)..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>

                        <div>
                          <select
                            value={newGroupCategory}
                            onChange={(e) => setNewGroupCategory(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="study">Study Group</option>
                            <option value="project">Project Group</option>
                            <option value="general">General</option>
                            <option value="gaming">Gaming</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={newGroupTags}
                            onChange={(e) => setNewGroupTags(e.target.value)}
                            placeholder="Tags (comma-separated)..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="isPrivate"
                            checked={newGroupIsPrivate}
                            onChange={(e) => setNewGroupIsPrivate(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700">
                            Private Group
                          </label>
                        </div>

                        {/* Member Selection */}
                        <div className="border-t pt-2">
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Add Members (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Search your contacts..."
                            value={newGroupMemberSearch}
                            onChange={(e) => {
                              setNewGroupMemberSearch(e.target.value);
                              handleLoadGroupMembers(e.target.value);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 mb-2"
                          />

                          {/* Member Search Results */}
                          {newGroupMemberSearch && (
                            <div className="border border-gray-300 rounded-lg bg-white max-h-32 overflow-y-auto mb-2">
                              {newGroupLoadingUsers ? (
                                <div className="p-2 text-center text-gray-500 text-xs">
                                  Loading users...
                                </div>
                              ) : newGroupAvailableUsers.length > 0 ? (
                                newGroupAvailableUsers.map((user: any) => (
                                  <div
                                    key={user._id}
                                    className="p-2 border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-gray-900">{user.name}</p>
                                      <p className="text-xs text-gray-600">@{user.username}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddGroupMember(user._id)}
                                      disabled={newGroupMemberIds.includes(user._id)}
                                      className={`px-2 py-1 rounded text-xs font-medium ${newGroupMemberIds.includes(user._id)
                                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                          : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                    >
                                      {newGroupMemberIds.includes(user._id) ? 'Added' : 'Add'}
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="p-2 text-center text-gray-500 text-xs">
                                  No contacts found matching that search
                                </div>
                              )}
                            </div>
                          )}

                          {/* Selected Members */}
                          {newGroupMemberIds.length > 0 && (
                            <div className="mb-2 p-2 bg-blue-50 rounded">
                              <p className="text-xs text-blue-900 font-medium mb-1">
                                {newGroupMemberIds.length} member(s) selected
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {newGroupMemberIds.map((memberId) => {
                                  const member = newGroupAvailableUsers.find(u => u._id === memberId);
                                  return (
                                    <div
                                      key={memberId}
                                      className="inline-flex items-center gap-1 bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs"
                                    >
                                      <span>{member?.name || memberId}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveGroupMember(memberId)}
                                        className="text-blue-900 hover:text-blue-700 font-semibold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fixed buttons at bottom */}
                      <div className="flex gap-2 p-3 border-t bg-gray-50 flex-shrink-0">
                        <button
                          type="submit"
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewGroup(false)}
                          className="flex-1 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-100 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {chatMode === 'personal' && (
              <>
                <button
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  className="w-full px-3 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-xs md:text-sm font-semibold"
                >
                  + New Chat
                </button>

                {showUserSearch && (
                  <div className="mt-3 space-y-2">
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
                    {searchResults.map((u) => (
                      <div
                        key={u._id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                        <button
                          onClick={() => handleSendConnectRequest(u._id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat List - Scrollable */}
          <div className="flex-grow overflow-y-auto">
            {(() => {
              console.log('[Groups Display] chatMode:', chatMode, 'loadingGroups:', loadingGroups, 'groups.length:', groups?.length);
              return null;
            })()}
            {chatMode === 'groups' && loadingGroups && (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">Loading groups...</p>
              </div>
            )}
            {chatMode === 'groups' && !loadingGroups && Array.isArray(groups) && groups.length > 0 && groups.map((group) => (
              <button
                key={group._id}
                onClick={() => {
                  console.log('Group clicked:', group.name);
                  setSelectedGroup(group);
                  setSelectedPersonalChat(null);
                  setIsAIMode(false);
                  setShowMobileChat(true);
                  fetchMessages();
                }}
                className={`w-full text-left px-3 md:px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedGroup?._id === group._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm md:text-base truncate">{group.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{group.members?.length || group.memberCount || 0} members</p>
                    {group.category && (
                      <p className="text-xs text-gray-400 capitalize">{group.category}</p>
                    )}
                  </div>
                  {group.isPrivate && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      Private
                    </span>
                  )}
                </div>
              </button>
            ))}

            {chatMode === 'groups' && !loadingGroups && (!Array.isArray(groups) || groups.length === 0) && (
              <div className="p-6 text-center text-gray-500">
                <p className="text-sm">No groups yet</p>
                <p className="text-xs mt-2">Create a group or join one to get started!</p>
              </div>
            )}

            {chatMode === 'personal' && (
              <>
                {loadingChats && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-gray-500">Loading chats...</p>
                  </div>
                )}
                {!loadingChats && chats.map((chat) => (
                  <button
                    key={chat._id}
                    onClick={() => handleSelectPersonalChat(chat)}
                    className={`w-full text-left px-3 md:px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedPersonalChat?._id === chat._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        {chat.otherParticipant?.avatar ? (
                          <img
                            src={chat.otherParticipant.avatar}
                            alt={chat.otherParticipant.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User size={20} className="text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                          {chat.otherParticipant?.name || 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {chatMode === 'ai' && (
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setSelectedPersonalChat(null);
                  setIsAIMode(true);
                  setMessages([]);
                  setShowMobileChat(true);
                }}
                className={`w-full text-left px-3 md:px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isAIMode ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
              >
                <p className="font-semibold text-gray-900 text-sm md:text-base">🤖 AI Assistant</p>
                <p className="text-xs text-gray-500 mt-1">Ask questions about your documents</p>
              </button>
            )}

            {chatMode === 'notifications' && (
              <div className="space-y-2">
                {/* Mark all as read button */}
                {(contactRequests.length > 0 || adminNotifications.filter(n => !n.isRead).length > 0) && (
                  <div className="px-3 md:px-4 py-2">
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all as read
                    </button>
                  </div>
                )}

                {/* Admin Notifications */}
                {adminNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-3 md:px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    onClick={() => !notification.isRead && markNotificationAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${notification.type === 'info' ? 'bg-blue-100' :
                          notification.type === 'success' ? 'bg-green-100' :
                            notification.type === 'warning' ? 'bg-yellow-100' :
                              'bg-red-100'
                        }`}>
                        <Bell size={16} className={
                          notification.type === 'info' ? 'text-blue-600' :
                            notification.type === 'success' ? 'text-green-600' :
                              notification.type === 'warning' ? 'text-yellow-600' :
                                'text-red-600'
                        } />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Contact Requests */}
                {contactRequests.map((request) => (
                  <div
                    key={request._id}
                    className="px-3 md:px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserPlus size={20} className="text-blue-600" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {request.sender.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            wants to connect
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request._id)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request._id)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {contactRequests.length === 0 && adminNotifications.length === 0 && !notificationsLoading && (
                  <div className="text-center py-8">
                    <Bell size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No new notifications</p>
                  </div>
                )}

                {/* Loading state */}
                {notificationsLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-xs text-gray-500 mt-2">Loading notifications...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area - Full width on mobile */}
        <div className={`${showMobileChat ? 'flex' : 'hidden'} md:flex flex-grow flex-col bg-white min-w-0`}>
          {(selectedGroup || selectedPersonalChat || isAIMode) ? (
            <>
              {/* Header - Mobile optimized */}
              <div className="p-3 md:p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => {
                      setShowMobileChat(false);
                      setSelectedGroup(null);
                      setSelectedPersonalChat(null);
                      setIsAIMode(false);
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 truncate">
                      {isAIMode ? 'AI Assistant' : selectedPersonalChat ? selectedPersonalChat.otherParticipant?.name : selectedGroup?.name}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 truncate">
                      {isAIMode ? 'Ask questions about your uploaded documents' : selectedPersonalChat ? 'Personal chat' : `${onlineUsers.filter(u => u.isOnline).length} online`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 md:gap-2 flex-shrink-0">
                  {/* Video Call Button */}
                  {(selectedGroup || selectedPersonalChat) && !isAIMode && (
                    <button
                      onClick={handleStartCall}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Start Video Call"
                    >
                      <Video size={18} className="text-blue-600" />
                    </button>
                  )}

                  {!isAIMode && !selectedPersonalChat && selectedGroup && (
                    <>
                      <button
                        onClick={() => setShowGroupMembers(!showGroupMembers)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Users size={18} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => setShowGroupSettings(!showGroupSettings)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Settings size={18} className="text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Messages - Scrollable area */}
              <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 min-h-0">
                {(chatMode === 'personal' ? chatMessages : messages).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : Array.isArray(chatMode === 'personal' ? chatMessages : messages) ? (
                  (chatMode === 'personal' ? chatMessages : messages).map((message: any) => {
                    // Logic to normalize message structure
                    const isPersonal = chatMode === 'personal';
                    const isGroup = chatMode === 'groups';

                    // Check if message is from the current user
                    const senderId = isPersonal
                      ? message.sender
                      : (typeof message.sender === 'string' ? message.sender : message.senderId || message.sender?._id);
                    const isMe = senderId === user?.id;

                    // Determine display name
                    const senderName = isPersonal
                      ? (isMe ? 'You' : selectedPersonalChat?.otherParticipant?.name || 'User')
                      : (isGroup ? (isMe ? 'You' : message.senderUsername || message.sender?.name || 'User') : message.sender.name);

                    const timestamp = isPersonal ? message.timestamp : message.createdAt;
                    const content = message.content;

                    return (
                      <div
                        key={message._id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[280px] sm:max-w-xs lg:max-w-md px-3 md:px-4 py-2 rounded-lg ${isMe
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                            }`}
                        >
                          {!isMe && isGroup && (
                            <p className="text-xs font-semibold mb-1 opacity-75">
                              {senderName}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>

                          {/* AI Sources */}
                          {message.sources && message.sources.length > 0 && (
                            <p className="text-xs mt-1 opacity-75 border-t border-white/20 pt-1">
                              Sources: {message.sources.join(', ')}
                            </p>
                          )}

                          <p className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-gray-500'} flex items-center gap-1`}>
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isMe && message.status && (
                              <span className="text-xs">
                                {message.status === 'sending' && '⏳'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && '👁'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex justify-center items-center h-full">
                    <p className="text-gray-400">Error loading messages</p>
                  </div>
                )}
                <div ref={messagesEndRef} />

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input - Fixed at bottom */}
              <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-gray-200 flex-shrink-0 relative">
                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 z-10 emoji-picker-container">
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Simple typing indicator
                      setIsTyping(true);
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                      }
                      typingTimeoutRef.current = setTimeout(() => {
                        setIsTyping(false);
                      }, 1000);
                    }}
                    placeholder={
                      isAIMode ? "Ask a question about your documents..." :
                        selectedPersonalChat ? `Message ${selectedPersonalChat.otherParticipant?.name || 'user'}...` :
                          "Type a message..."
                    }
                    className="flex-grow px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm md:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    😀
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newMessage.trim()}
                    className="px-3 md:px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                  >
                    {loading ? <Loader size={18} className="animate-spin" /> : <Send size={16} className="md:w-5 md:h-5" />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={64} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-base md:text-lg">
                  {chatMode === 'groups' ? 'Select a group to start chatting' :
                    chatMode === 'personal' ? 'Select a personal chat or start a new one' :
                      chatMode === 'notifications' ? 'Check your notifications above' :
                        'Select AI Assistant to ask questions'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end pointer-events-none p-4">
          <div className="pointer-events-auto bg-white border border-gray-200 shadow-2xl rounded-lg w-full max-w-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                <Phone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Incoming {incomingCall.isGroup ? 'group ' : ''}call</p>
                <p className="text-xs text-gray-600 truncate">From {incomingCall.callerName || 'Someone'}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDeclineIncomingCall}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptIncomingCall}
                className="flex-1 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Settings Modal */}
      {showChatSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Chat Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Profile Source</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={useMainProfile}
                        onChange={() => setUseMainProfile(true)}
                        className="mr-2"
                      />
                      Use Main Profile
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!useMainProfile}
                        onChange={() => setUseMainProfile(false)}
                        className="mr-2"
                      />
                      Custom Chat Profile
                    </label>
                  </div>
                </div>

                {!useMainProfile && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">About</label>
                      <textarea
                        value={chatAbout}
                        onChange={(e) => setChatAbout(e.target.value)}
                        placeholder="Tell others about yourself..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Profile Picture URL</label>
                      <input
                        type="url"
                        value={chatAvatar}
                        onChange={(e) => setChatAvatar(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveChatProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowChatSettings(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Members Panel */}
      {showGroupMembers && selectedGroup && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-lg z-40 flex flex-col">
          <GroupMemberList
            group={selectedGroup}
            currentUserId={user?.id || ''}
            onClose={() => setShowGroupMembers(false)}
            onRoleUpdate={() => {
              fetchGroups();
              fetchMessages();
            }}
          />
        </div>
      )}

      {/* Group Settings Panel */}
      {showGroupSettings && selectedGroup && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-lg z-40 flex flex-col">
          <GroupSettings
            group={selectedGroup}
            onClose={() => setShowGroupSettings(false)}
            onUpdate={() => {
              fetchGroups();
              fetchMessages();
            }}
          />
        </div>
      )}

      {/* Video Call */}
      {inCall && (selectedGroup || selectedPersonalChat) && socketRef.current && (
        <VideoCall
          roomId={selectedGroup ? selectedGroup._id : selectedPersonalChat!._id}
          userId={user?.id || ''}
          isGroup={!!selectedGroup}
          isAdmin={selectedGroup ? selectedGroup.members?.some(m => m.userId === user?.id && m.role === 'admin') || false : false}
          socket={socketRef.current}
          onEnd={() => setInCall(false)}
          isPersonalChat={!!selectedPersonalChat}
        />
      )}

      <Footer />
    </div>
  );
};
