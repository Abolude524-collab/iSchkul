import { create } from 'zustand'

interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  isAdmin?: boolean
  role?: string
  // Gamification fields
  total_xp?: number
  current_streak?: number
  level?: number
  badges?: string[]
  last_active_date?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User | null) => void
  refreshUserStats: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('authToken'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      // Call API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) throw new Error('Login failed')

      const data = await response.json()
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      set({ user: data.user, token: data.token })
    } catch (error: any) {
      set({ error: error.message })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },

  setUser: (user) => set({ user }),

  refreshUserStats: async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/gamification/activity`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) return

      const data = await response.json()

      set((state) => {
        if (!state.user) return state
        return {
          user: {
            ...state.user,
            total_xp: data.totalXp,
            level: data.level,
            current_streak: data.currentStreak,
            badges: data.badges
          }
        }
      })

      // Also update localStorage
      set((state) => {
        if (state.user) {
          localStorage.setItem('user', JSON.stringify(state.user))
        }
        return state
      })
    } catch (error) {
      console.error('Failed to refresh user stats:', error)
    }
  },
}))

// Quiz store
interface QuizState {
  currentQuiz: any | null
  results: any | null
  setCurrentQuiz: (quiz: any) => void
  setResults: (results: any) => void
}

export const useQuizStore = create<QuizState>((set) => ({
  currentQuiz: null,
  results: null,
  setCurrentQuiz: (quiz) => set({ currentQuiz: quiz }),
  setResults: (results) => set({ results }),
}))

// Chat store
interface Message {
  id: string
  userId: string
  content: string
  createdAt: string
}

interface PersonalChat {
  _id: string
  participants: string[]
  lastMessage: Message | null
  otherParticipant: {
    _id: string
    name: string
    username: string
    avatar?: string
  } | null
  createdAt: string
}

interface PersonalMessage {
  _id: string
  sender: string
  content: string
  messageType: string
  timestamp: string
  readBy: string[]
}

interface ChatState {
  messages: Message[]
  currentGroupId: string | null
  addMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  setCurrentGroup: (groupId: string | null) => void
}

interface PersonalChatState {
  chats: PersonalChat[]
  currentChatId: string | null
  chatMessages: PersonalMessage[]
  addChat: (chat: PersonalChat) => void
  setChats: (chats: PersonalChat[]) => void
  setCurrentChat: (chatId: string | null) => void
  setChatMessages: (messages: PersonalMessage[]) => void
  addChatMessage: (message: PersonalMessage) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentGroupId: null,
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setCurrentGroup: (groupId) => set({ currentGroupId: groupId }),
}))

export const usePersonalChatStore = create<PersonalChatState>((set) => ({
  chats: [],
  currentChatId: null,
  chatMessages: [],
  addChat: (chat) => set((state) => ({ chats: [...state.chats, chat] })),
  setChats: (chats) => set({ chats }),
  setCurrentChat: (chatId) => set({ currentChatId: chatId, chatMessages: [] }),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
}))
