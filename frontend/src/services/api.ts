import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
  createGroup: (name: string, description: string, adminUserId: string) =>
    apiClient.post('/groups/create', { name, description, adminUserId }),
  getGroups: () =>
    apiClient.get('/groups'),
  getGroup: (groupId: string) =>
    apiClient.get(`/groups/${groupId}`),
}

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
  awardXp: (activityType: string) =>
    apiClient.post('/gamification/award', { activity_type: activityType }),
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
}

// Leaderboard management endpoints
export const leaderboardAPI = {
  createLeaderboard: (data: { title: string; description?: string; durationDays: number; prizes?: string[] }) =>
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
  generateCards: (data: { text?: string; numCards?: number; setId?: string; file?: any }) =>
    apiClient.post('/flashcards/generate', data),
  getUserCards: (limit?: number, setId?: string) =>
    apiClient.get('/flashcards', { params: { limit, groupId: setId } }),
}

export default apiClient
