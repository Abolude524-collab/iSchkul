import axios from 'axios'
import { useAuthStore } from './store'
import { requestLimiter, getCacheKey, getTTLForEndpoint, getExponentialBackoffDelay } from './requestLimiter'

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

// Track request attempts for retry logic
const requestAttempts = new Map<string, number>();

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Check for rate limiting before making request
  const cacheKey = getCacheKey(config.method || 'GET', config.url || '');
  if (requestLimiter.isRateLimited(cacheKey)) {
    const waitTime = requestLimiter.getWaitTime(cacheKey);
    console.warn(`[Rate Limited] Endpoint ${cacheKey} is rate limited. Wait ${waitTime}ms before retrying.`);
  }

  return config
})

// Handle responses and redirect on auth errors + rate limiting
apiClient.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method === 'get' || response.config.method === 'GET') {
      const cacheKey = getCacheKey(response.config.method, response.config.url || '');
      const ttl = getTTLForEndpoint(response.config.method, response.config.url || '');
      requestLimiter.setCache(cacheKey, response.data, ttl);
    }
    
    // Reset retry attempts on success
    const cacheKey = getCacheKey(response.config.method || 'GET', response.config.url || '');
    requestAttempts.delete(cacheKey);
    
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const config = error.config;
    const cacheKey = getCacheKey(config.method || 'GET', config.url || '');

    // Handle 429 (Too Many Requests)
    if (status === 429) {
      const retryAfter = error.response?.headers['retry-after'];
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : 60;
      
      console.error(`[429 Rate Limited] ${config.url} - Retry after ${retryAfterSeconds}s`);
      requestLimiter.handleRateLimit(cacheKey, retryAfterSeconds);

      // Attempt retry with exponential backoff
      const attempts = requestAttempts.get(cacheKey) || 0;
      const maxRetries = 3;

      if (attempts < maxRetries) {
        requestAttempts.set(cacheKey, attempts + 1);
        const delay = getExponentialBackoffDelay(attempts);
        
        console.log(`[Retry] Attempt ${attempts + 1}/${maxRetries} in ${delay}ms`);
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            apiClient.request(config)
              .then(resolve)
              .catch(reject);
          }, delay);
        });
      } else {
        console.error(`[Exhausted Retries] ${cacheKey} failed after ${maxRetries} attempts`);
        requestAttempts.delete(cacheKey);
        return Promise.reject(error);
      }
    }

    if (status === 401) {
      // Check if we are offline - if so, don't clear session yet
      if (!navigator.onLine) {
        console.warn('Unauthorized error while offline. Ignoring for now.');
        return Promise.reject(error);
      }

      // Token is invalid or expired, clear auth data and redirect to login
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      useAuthStore.getState().setUser(null)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (status !== 429) {
      // Log other errors for debugging (but not 429 since we already logged it)
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
    cachedGet(`/quizzes/${quizId}`),
  submitQuiz: (quizId: string, answers: any[], userId: string) =>
    apiClient.post(`/quizzes/${quizId}/submit`, { answers, userId }),
}

// Group endpoints
export const groupAPI = {
  // Group CRUD
  createGroup: (data: { name: string; description?: string; category?: string; isPrivate?: boolean; tags?: string[] }) =>
    apiClient.post('/groups/create', data),
  getGroups: (params?: { category?: string; role?: string; limit?: number; skip?: number }) =>
    cachedGet('/groups', { params }),
  getGroup: (groupId: string) =>
    cachedGet(`/groups/${groupId}`),
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
    cachedGet(`/groups/${groupId}/messages`, { params }),
  sendGroupMessage: (groupId: string, data: { content: string; messageType?: string; attachments?: any[]; replyTo?: string }) =>
    apiClient.post(`/groups/${groupId}/messages`, data),
};

// Personal chat endpoints
export const personalChatAPI = {
  createChat: (contactId: string) =>
    apiClient.post('/personal-chat/create', { contactId }),
  listChats: () =>
    cachedGet('/personal-chat/list'),
  getChatMessages: (chatId: string) =>
    cachedGet(`/personal-chat/messages/${chatId}`),
  sendMessage: (chatId: string, content: string, messageType?: string) =>
    apiClient.post(`/personal-chat/send/${chatId}`, { content, messageType }),
}

// Utility to wrap GET requests with caching and deduplication
async function cachedGet(url: string, config?: any) {
  const cacheKey = getCacheKey('GET', url);
  
  // Check cache first
  const cached = requestLimiter.getFromCache(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  // Check if request is already in flight
  const pending = requestLimiter.getPendingRequest(cacheKey);
  if (pending) {
    return pending;
  }

  // Make new request
  const request = apiClient.get(url, config);
  requestLimiter.setPendingRequest(cacheKey, request);
  
  return request;
}

// Gamification endpoints
export const gamificationAPI = {
  awardXP: (data: string | { activityType: string; xpAmount?: number; metadata?: any }) => {
    if (typeof data === 'string') {
      return apiClient.post('/gamification/award', { activity_type: data });
    }
    return apiClient.post('/gamification/award', {
      activity_type: data.activityType,
      xp_amount: data.xpAmount,
      metadata: data.metadata,
    });
  },
  getUserStats: () =>
    cachedGet('/gamification/activity'),
  userEnter: () =>
    apiClient.post('/gamification/enter'),
  getLeaderboard: () =>
    cachedGet('/gamification/leaderboard'),
  getXpHistory: (limit: number = 50) =>
    cachedGet('/gamification/history', { params: { limit } }),
  getUserActivity: () =>
    cachedGet('/gamification/activity'),
  getProfileStats: () =>
    cachedGet('/gamification/profile-stats'),
  joinLeaderboard: () =>
    apiClient.post('/gamification/join-leaderboard'),
  leaveLeaderboard: () =>
    apiClient.post('/gamification/leave-leaderboard'),
  getUserBadges: () =>
    cachedGet('/gamification/badges'),
  getUserAwards: () =>
    cachedGet('/gamification/awards'),
  getStreak: () =>
    cachedGet('/gamification/streak'),
}

// Leaderboard management endpoints
export const leaderboardAPI = {
  createLeaderboard: (data: { title: string; description?: string; durationDays: number; prizes?: string[]; isRestricted?: boolean; allowedUsers?: string[] }) =>
    apiClient.post('/leaderboard/create', data),
  listLeaderboards: () =>
    cachedGet('/leaderboard/list'),
  getActiveLeaderboard: () =>
    cachedGet('/leaderboard/active'),
  joinLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/join', { leaderboardId }),
  leaveLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/leave', { leaderboardId }),
  endLeaderboard: (leaderboardId: string) =>
    apiClient.post('/leaderboard/end', { leaderboardId }),
  getLeaderboardParticipants: (leaderboardId: string) =>
    cachedGet('/leaderboard/participants', { params: { leaderboardId } }),
}

// Student of the Week endpoints
export const sotwAPI = {
  getCurrent: () =>
    cachedGet('/sotw/current'),
  getArchive: () =>
    cachedGet('/sotw/archive'),
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
    cachedGet('/users/search', { params: { q: query } }),
  getUser: (userId: string) =>
    cachedGet(`/users/${userId}`),
  getUserBadges: (userId: string) =>
    cachedGet(`/users/${userId}/badges`),
  getMyBadges: () =>
    cachedGet('/users/badges/my'),
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
