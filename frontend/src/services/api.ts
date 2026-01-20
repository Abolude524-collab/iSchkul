import axios from 'axios'
import { useAuthStore } from './store'

// API base: backend origin + /api
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const API_BASE_URL = `${API_ORIGIN}/api`

// 🔧 Helper function for direct fetch calls (always prefixes /api)
export const getAPIEndpoint = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
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
    apiClient.post('/chat/send', { userId, content, groupId }),
  getMessages: (groupId?: string, limit: number = 50) =>
    apiClient.get('/chat/messages', { params: { groupId, limit } }),
}

// Quiz endpoints
export const quizAPI = {
  generateQuiz: (text: string, numQuestions: number, createdBy: string, groupId?: string) =>
    apiClient.post('/generate/quiz', { text, numQuestions, createdBy, groupId }),
  getQuiz: (quizId: string) =>
    apiClient.get(`/quiz/${quizId}`),
  submitQuiz: (quizId: string, answers: any[], userId: string) =>
    apiClient.post(`/quiz/${quizId}/submit`, { answers, userId }),
}

// Group endpoints
export const groupAPI = {
  // Group CRUD
  createGroup: (data: { name: string; description?: string; category?: string; isPrivate?: boolean; tags?: string[] }) =>
    apiClient.post('/groups/create', data),
  getGroups: (params?: { category?: string; role?: string; limit?: number; skip?: number }) =>
    apiClient.get('/groups', { params }),
  getGroup: (groupId: string) =>
    apiClient.get(`/groups/${groupId}`),
  updateGroup: (groupId: string, data: any) =>
    apiClient.put(`/groups/${groupId}`, data),
  deleteGroup: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}`),

  // Invite links
  generateInviteLink: (groupId: string, data?: { expiresInDays?: number; maxUses?: number }) =>
    apiClient.post(`/groups/${groupId}/invite-link`, data),
  revokeInviteLink: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}/invite-link`),
  joinGroup: (inviteCode: string) =>
    apiClient.post(`/groups/join/${inviteCode}`),

  // Member management
  addMember: (groupId: string, data: { userId: string; role?: string }) =>
    apiClient.post(`/groups/${groupId}/members`, data),
  updateMemberRole: (groupId: string, userId: string, data: { role: string }) =>
    apiClient.put(`/groups/${groupId}/members/${userId}`, data),
  removeMember: (groupId: string, userId: string) =>
    apiClient.delete(`/groups/${groupId}/members/${userId}`),
  leaveGroup: (groupId: string) =>
    apiClient.post(`/groups/${groupId}/leave`),

  // Messages
  getGroupMessages: (groupId: string, params?: { limit?: number; before?: string }) =>
    apiClient.get(`/groups/${groupId}/messages`, { params }),
  sendGroupMessage: (groupId: string, data: { content: string; messageType?: string; attachments?: any[]; replyTo?: string }) =>
    apiClient.post(`/groups/${groupId}/messages`, data),
};

// Personal chat endpoints
export const personalChatAPI = {
  createChat: (contactId: string) =>
    apiClient.post('/personal-chat/create', { contactId }),
  listChats: () =>
    apiClient.get('/personal-chat/list'),
  getChatMessages: (chatId: string) =>
    apiClient.get(`/personal-chat/messages/${chatId}`),
  sendMessage: (chatId: string, content: string, messageType?: string) =>
    apiClient.post(`/personal-chat/send/${chatId}`, { content, messageType }),
}

// Gamification endpoints
export const gamificationAPI = {
  awardXP: (activityType: string) =>
    apiClient.post('/gamification/award', { activity_type: activityType }),
  getUserStats: () =>
    apiClient.get('/gamification/activity'),
  userEnter: () =>
    apiClient.post('/gamification/enter'),
  getLeaderboard: () =>
    apiClient.get('/gamification/leaderboard'),
  getXpHistory: () =>
    apiClient.get('/gamification/history'),
  getUserActivity: () =>
    apiClient.get('/gamification/activity'),
  joinLeaderboard: () =>
    apiClient.post('/gamification/join-leaderboard'),
  leaveLeaderboard: () =>
    apiClient.post('/gamification/leave-leaderboard'),
  getUserBadges: () =>
    apiClient.get('/gamification/badges'),
  getUserAwards: () =>
    apiClient.get('/gamification/awards'),
  getStreak: () =>
    apiClient.get('/gamification/streak'),
}

// Leaderboard management endpoints
export const leaderboardAPI = {
  createLeaderboard: (data: { title: string; description?: string; durationDays: number; prizes?: string[]; isRestricted?: boolean; allowedUsers?: string[] }) =>
    apiClient.post('/leaderboard/create', data),
  listLeaderboards: () =>
    apiClient.get('/leaderboard/list'),
  getActiveLeaderboard: () =>
    apiClient.get('/leaderboard/active'),
  joinLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/join', { leaderboardId }),
  leaveLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/leave', { leaderboardId }),
  endLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/end', { leaderboardId }),
  getLeaderboardParticipants: (leaderboardId: string) =>
    apiClient.get('/leaderboard/participants', { params: { leaderboardId } }),
}

// Student of the Week endpoints
export const sotwAPI = {
  getCurrent: () =>
    apiClient.get('/sotw/current'),
  getArchive: () =>
    apiClient.get('/sotw/archive'),
  submitQuote: (quote: string) =>
    apiClient.post('/sotw/quote', { quote }),
}

// Flashcard sets endpoints
export const flashcardSetsAPI = {
  createSet: (data: { title: string; description?: string; subject?: string; isPublic?: boolean; tags?: string[] }) =>
    apiClient.post('/flashcard-sets/create', data),
  getUserSets: () =>
    apiClient.get('/flashcard-sets/list'),
  getPublicSet: (shareCode: string) =>
    apiClient.get('/flashcard-sets/public', { params: { shareCode } }),
  updateSet: (data: { setId: string; title?: string; description?: string; subject?: string; isPublic?: boolean; tags?: string[] }) =>
    apiClient.put('/flashcard-sets/update', data),
  deleteSet: (setId: string) =>
    apiClient.delete('/flashcard-sets', { params: { setId } }),
  addCardsToSet: (data: { setId: string; cards: Array<{ front: string; back: string; tags?: string[]; difficulty?: string }> }) =>
    apiClient.post('/flashcard-sets/add-cards', data),
  getShareLink: (setId: string) =>
    apiClient.get('/flashcard-sets/share-link', { params: { setId } }),
}

// Users endpoints
export const usersAPI = {
  searchUsers: (query: string) =>
    apiClient.get('/users/search', { params: { q: query } }),
  getUser: (userId: string) =>
    apiClient.get(`/users/${userId}`),
  getUserBadges: (userId: string) =>
    apiClient.get(`/users/${userId}/badges`),
  getMyBadges: () =>
    apiClient.get('/users/badges/my'),
}

// Flashcard endpoints
export const flashcardAPI = {
  getDueCards: (limit?: number, setId?: string) =>
    apiClient.get('/flashcards/due', { params: { limit, groupId: setId } }),
  recordReview: (flashcardId: string, quality: number) =>
    apiClient.post('/flashcards/review', { flashcardId, quality }),
  getStats: () =>
    apiClient.get('/flashcards/stats'),
  createCard: (data: { front: string; back: string; tags?: string[]; difficulty?: string; setId?: string }) =>
    apiClient.post('/flashcards/create', data),
  generateCards: (data: { text?: string; numCards?: number; setId?: string; subject?: string; file?: File | null }) => {
    const formData = new FormData();
    if (data.text) formData.append('text', data.text);
    if (data.numCards) formData.append('numCards', String(data.numCards));
    if (data.setId) formData.append('setId', data.setId);
    if (data.subject) formData.append('subject', data.subject);
    if (data.file) formData.append('file', data.file);

    return apiClient.post('/flashcards/generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getUserCards: (limit?: number, setId?: string) =>
    apiClient.get('/flashcards', { params: { limit, groupId: setId } }),
  exportSetPdf: (setId: string) =>
    apiClient.get(`/flashcards/${setId}/export/pdf`, { responseType: 'blob' }),
  downloadCard: (setId: string, cardId: string) =>
    apiClient.get(`/flashcards/${setId}/cards/${cardId}/download`, { responseType: 'blob' }),
}

export default apiClient
