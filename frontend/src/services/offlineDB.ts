/**
 * IndexedDB Schema for Offline Functionality
 * Stores quizzes, flashcards, and sync queue
 */

import Dexie, { Table } from 'dexie';

// Type definitions
export interface OfflineQuiz {
  id?: number;
  quizId: string;
  title: string;
  questions: any[];
  timeLimit: number;
  difficulty: string;
  subject: string;
  cachedAt: Date;
}

export interface OfflineQuizAttempt {
  id?: number;
  attemptId: string;
  quizId: string;
  userId: string;
  answers: any[];
  score: number;
  totalQuestions: number;
  startedAt: Date;
  completedAt: Date;
  synced: boolean;
}

export interface OfflineFlashcard {
  id?: number;
  flashcardId: string;
  setId: string;
  question: string;
  answer: string;
  difficulty?: string;
  tags?: string[];
  cachedAt: Date;
}

export interface OfflineFlashcardProgress {
  id?: number;
  flashcardId: string;
  userId: string;
  reviewed: boolean;
  confidence: number; // 1-5
  lastReviewedAt: Date;
  nextReviewAt?: Date;
  synced: boolean;
}

export interface SyncQueueItem {
  id?: number;
  action: 'quiz_submission' | 'flashcard_review' | 'flashcard_progress';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  data: any;
  createdAt: Date;
  retries: number;
  lastError?: string;
}

export class OfflineDatabase extends Dexie {
  quizzes!: Table<OfflineQuiz>;
  quizAttempts!: Table<OfflineQuizAttempt>;
  flashcards!: Table<OfflineFlashcard>;
  flashcardProgress!: Table<OfflineFlashcardProgress>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('ischkul-offline-db');
    
    this.version(1).stores({
      quizzes: '++id, quizId, cachedAt',
      quizAttempts: '++id, attemptId, quizId, userId, synced, completedAt',
      flashcards: '++id, flashcardId, setId, cachedAt',
      flashcardProgress: '++id, flashcardId, userId, synced, lastReviewedAt',
      syncQueue: '++id, action, createdAt, retries'
    });
  }
}

// Create singleton instance
export const db = new OfflineDatabase();

// Utility functions
export const clearOldCachedData = async (daysOld: number = 7) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  await db.quizzes.where('cachedAt').below(cutoffDate).delete();
  await db.flashcards.where('cachedAt').below(cutoffDate).delete();
};

export const getSyncQueueSize = async (): Promise<number> => {
  return await db.syncQueue.count();
};

export const getUnsyncedCount = async (): Promise<{
  quizAttempts: number;
  flashcardProgress: number;
}> => {
  const quizAttempts = await db.quizAttempts.where('synced').equals(0).count();
  const flashcardProgress = await db.flashcardProgress.where('synced').equals(0).count();
  
  return { quizAttempts, flashcardProgress };
};
