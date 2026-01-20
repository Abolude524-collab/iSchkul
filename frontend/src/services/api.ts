import axios from 'axios'
import { useAuthStore } from './store'

// Use relative /api path to let Netlify proxy to backend via netlify.toml redirect
// Or use VITE_API_URL for explicit backend URL in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// 🔧 Helper function for direct fetch calls
export const getAPIEndpoint = (path: string): string => {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle responses and redirect on auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      // Token is invalid or expired, clear auth data and redirect to login
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      useAuthStore.getState().setUser(null)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else {
      // Log other errors for debugging
      console.error(`[API Error] ${status || 'Network'}:`, data?.error || error.message);
    }

    return Promise.reject(error)
  }
)

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  logout: () => {
    localStorage.removeItem('authToken')
  },
}

// Chat endpoints
export const chatAPI = {
  sendMessage: (userId: string, content: string, groupId?: string) =>
    apiClient.post('/api/chat/send', { userId, content, groupId }),
  getMessages: (groupId?: string, limit: number = 50) =>
    apiClient.get('/api/chat/messages', { params: { groupId, limit } }),
}

// Quiz endpoints
export const quizAPI = {
  generateQuiz: (text: string, numQuestions: number, createdBy: string, groupId?: string) =>
    apiClient.post('/api/generate/quiz', { text, numQuestions, createdBy, groupId }),
  getQuiz: (quizId: string) =>
    apiClient.get(`/api/quiz/${quizId}`),
  submitQuiz: (quizId: string, answers: any[], userId: string) =>
    apiClient.post(`/api/quiz/${quizId}/submit`, { answers, userId }),
}

// Group endpoints
export const groupAPI = {
  // Group CRUD
  createGroup: (data: { name: string; description?: string; category?: string; isPrivate?: boolean; tags?: string[] }) =>
    apiClient.post('/api/groups/create', data),
  getGroups: (params?: { category?: string; role?: string; limit?: number; skip?: number }) =>
    apiClient.get('/api/groups', { params }),
  getGroup: (groupId: string) =>
    apiClient.get(`/api/groups/${groupId}`),
  updateGroup: (groupId: string, data: any) =>
    apiClient.put(`/api/groups/${groupId}`, data),
  deleteGroup: (groupId: string) =>
    apiClient.delete(`/api/groups/${groupId}`),

  // Invite links
  generateInviteLink: (groupId: string, data?: { expiresInDays?: number; maxUses?: number }) =>
    apiClient.post(`/api/groups/${groupId}/invite-link`, data),
  revokeInviteLink: (groupId: string) =>
    apiClient.delete(`/api/groups/${groupId}/invite-link`),
  joinGroup: (inviteCode: string) =>
    apiClient.post(`/api/groups/join/${inviteCode}`),

  // Member management
  addMember: (groupId: string, data: { userId: string; role?: string }) =>
    apiClient.post(`/api/groups/${groupId}/members`, data),
  updateMemberRole: (groupId: string, userId: string, data: { role: string }) =>
    apiClient.put(`/api/groups/${groupId}/members/${userId}`, data),
  removeMember: (groupId: string, userId: string) =>
    apiClient.delete(`/api/groups/${groupId}/members/${userId}`),
  leaveGroup: (groupId: string) =>
    apiClient.post(`/api/groups/${groupId}/leave`),

  // Messages
  getGroupMessages: (groupId: string, params?: { limit?: number; before?: string }) =>
    apiClient.get(`/api/groups/${groupId}/messages`, { params }),
  sendGroupMessage: (groupId: string, data: { content: string; messageType?: string; attachments?: any[]; replyTo?: string }) =>
    apiClient.post(`/api/groups/${groupId}/messages`, data),
};

// Personal chat endpoints
export const personalChatAPI = {
  createChat: (contactId: string) =>
    apiClient.post('/api/personal-chat/create', { contactId }),
  listChats: () =>
    apiClient.get('/api/personal-chat/list'),
  getChatMessages: (chatId: string) =>
    apiClient.get(`/api/personal-chat/messages/${chatId}`),
  sendMessage: (chatId: string, content: string, messageType?: string) =>
    apiClient.post(`/api/personal-chat/send/${chatId}`, { content, messageType }),
}

// Gamification endpoints
export const gamificationAPI = {
  awardXP: (activityType: string) =>
    apiClient.post('/api/gamification/award', { activity_type: activityType }),
  getUserStats: () =>
    apiClient.get('/api/gamification/activity'),
  userEnter: () =>
    apiClient.post('/api/gamification/enter'),
  getLeaderboard: () =>
    apiClient.get('/api/gamification/leaderboard'),
  getXpHistory: () =>
    apiClient.get('/api/gamification/history'),
  getUserActivity: () =>
    apiClient.get('/api/gamification/activity'),
  joinLeaderboard: () =>
    apiClient.post('/api/gamification/join-leaderboard'),
  leaveLeaderboard: () =>
    apiClient.post('/api/gamification/leave-leaderboard'),
  getUserBadges: () =>
    apiClient.get('/api/gamification/badges'),
  getUserAwards: () =>
    apiClient.get('/api/gamification/awards'),
  getStreak: () =>
    apiClient.get('/api/gamification/streak'),
}

// Leaderboard management endpoints
export const leaderboardAPI = {
  createLeaderboard: (data: { title: string; description?: string; durationDays: number; prizes?: string[]; isRestricted?: boolean; allowedUsers?: string[] }) =>
    apiClient.post('/api/leaderboard/create', data),
  listLeaderboards: () =>
    apiClient.get('/api/leaderboard/list'),
  getActiveLeaderboard: () =>
    apiClient.get('/api/leaderboard/active'),
  joinLeaderboard: (leaderboardId: string) =>
    apiClient.post('/api/leaderboard/join', { leaderboardId }),
  leaveLeaderboard: (leaderboardId: string) =>
    apiClient.post('/api/leaderboard/leave', { leaderboardId }),
  endLeaderboard: (leaderboardId: string) =>
    apiClient.post('/api/leaderboard/end', { leaderboardId }),
  getLeaderboardParticipants: (leaderboardId: string) =>
    apiClient.get('/api/leaderboard/participants', { params: { leaderboardId } }),
}

// Student of the Week endpoints
export const sotwAPI = {
  getCurrent: () =>
    apiClient.get('/api/sotw/current'),
  getArchive: () =>
    apiClient.get('/api/sotw/archive'),
  submitQuote: (quote: string) =>
    apiClient.post('/api/sotw/quote', { quote }),
}

// Flashcard sets endpoints
export const flashcardSetsAPI = {
  createSet: (data: { title: string; description?: string; subject?: string; isPublic?: boolean; tags?: string[] }) =>
    apiClient.post('/api/flashcard-sets/create', data),
  getUserSets: () =>
    apiClient.get('/api/flashcard-sets/list'),
  getPublicSet: (shareCode: string) =>
    apiClient.get('/api/flashcard-sets/public', { params: { shareCode } }),
  updateSet: (data: { setId: string; title?: string; description?: string; subject?: string; isPublic?: boolean; tags?: string[] }) =>
    apiClient.put('/api/flashcard-sets/update', data),
  deleteSet: (setId: string) =>
    apiClient.delete('/api/flashcard-sets', { params: { setId } }),
  addCardsToSet: (data: { setId: string; cards: Array<{ front: string; back: string; tags?: string[]; difficulty?: string }> }) =>
    apiClient.post('/api/flashcard-sets/add-cards', data),
  getShareLink: (setId: string) =>
    apiClient.get('/api/flashcard-sets/share-link', { params: { setId } }),
}

// Users endpoints
export const usersAPI = {
  searchUsers: (query: string) =>
    apiClient.get('/api/users/search', { params: { q: query } }),
  getUser: (userId: string) =>
    apiClient.get(`/api/users/${userId}`),
  getUserBadges: (userId: string) =>
    apiClient.get(`/api/users/${userId}/badges`),
  getMyBadges: () =>
    apiClient.get('/api/users/badges/my'),
}

// Flashcard endpoints
export const flashcardAPI = {
  getDueCards: (limit?: number, setId?: string) =>
    apiClient.get('/api/flashcards/due', { params: { limit, groupId: setId } }),
  recordReview: (flashcardId: string, quality: number) =>
    apiClient.post('/api/flashcards/review', { flashcardId, quality }),
  getStats: () =>
    apiClient.get('/api/flashcards/stats'),
  createCard: (data: { front: string; back: string; tags?: string[]; difficulty?: string; setId?: string }) =>
    apiClient.post('/api/flashcards/create', data),
  generateCards: (data: { text?: string; numCards?: number; setId?: string; subject?: string; file?: File | null }) => {
    const formData = new FormData();
    if (data.text) formData.append('text', data.text);
    if (data.numCards) formData.append('numCards', String(data.numCards));
    if (data.setId) formData.append('setId', data.setId);
    if (data.subject) formData.append('subject', data.subject);
    if (data.file) formData.append('file', data.file);

    return apiClient.post('/api/flashcards/generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getUserCards: (limit?: number, setId?: string) =>
    apiClient.get('/api/flashcards', { params: { limit, groupId: setId } }),
  exportSetPdf: (setId: string) =>
    apiClient.get(`/api/flashcards/${setId}/export/pdf`, { responseType: 'blob' }),
  downloadCard: (setId: string, cardId: string) =>
    apiClient.get(`/api/flashcards/${setId}/cards/${cardId}/download`, { responseType: 'blob' }),
}

export default apiClient
