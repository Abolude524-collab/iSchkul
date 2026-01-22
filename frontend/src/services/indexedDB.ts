/**
 * IndexedDB Database Management
 * Stores quizzes, flashcards, quiz attempts, and sync queue for offline support
 */

const DB_NAME = 'ischkul_offline';
// Incremented to 5 to stay ahead of any local corruption versions
const DB_VERSION = 5;

// Store names
export const STORES = {
  QUIZZES: 'quizzes',
  FLASHCARD_SETS: 'flashcardSets',
  FLASHCARDS: 'flashcards',
  QUIZ_ATTEMPTS: 'quizAttempts',
  SYNC_QUEUE: 'syncQueue',
  USER_PROGRESS: 'userProgress',
  SETTINGS: 'settings',
  DOCUMENTS: 'documents',
  DOCUMENT_CONTENT: 'documentContent'
};

// Singleton connection (cached)
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Handle persistent storage of current version to avoid VersionError on reload
 */
const getSavedVersion = (): number => {
  const saved = localStorage.getItem('ischkul_db_version');
  return saved ? parseInt(saved, 10) : DB_VERSION;
};

const saveVersion = (v: number) => {
  localStorage.setItem('ischkul_db_version', v.toString());
};

let currentVersion = getSavedVersion();

/**
 * Verify all required stores exist
 */
const allStoresExist = (db: IDBDatabase): boolean => {
  const requiredStores = Object.values(STORES);
  return requiredStores.every(storeName => db.objectStoreNames.contains(storeName));
};

/**
 * Open or create the IndexedDB database (singleton pattern)
 */
export const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance && allStoresExist(dbInstance)) {
    return Promise.resolve(dbInstance);
  }
  
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    console.log(`Attempting to open IndexedDB version ${currentVersion}...`);
    const request = indexedDB.open(DB_NAME, currentVersion);

    request.onerror = () => {
      const error = request.error;
      dbPromise = null;
      
      // If version is too low, extract the expected version and retry
      if (error?.name === 'VersionError') {
        console.warn('Database version mismatch detected.');
        // Try to recover by incrementing version
        currentVersion++;
        saveVersion(currentVersion);
        openDB().then(resolve).catch(reject);
        return;
      }

      console.error('IndexedDB open error:', error);
      reject(error);
    };

    request.onsuccess = () => {
      const db = request.result;
      
      if (!allStoresExist(db)) {
        console.warn('Stores missing, triggering upgrade...');
        db.close();
        dbInstance = null;
        dbPromise = null;
        currentVersion++;
        saveVersion(currentVersion);
        openDB().then(resolve).catch(reject);
        return;
      }
      
      dbInstance = db;
      saveVersion(db.version);
      
      db.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };
      
      console.log(`IndexedDB v${db.version} opened successfully`);
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log(`Upgrading IndexedDB to v${db.version}...`);

      // Quizzes store
      if (!db.objectStoreNames.contains(STORES.QUIZZES)) {
        const quizzesStore = db.createObjectStore(STORES.QUIZZES, { keyPath: '_id' });
        quizzesStore.createIndex('userId', 'userId', { unique: false });
        quizzesStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('✓ Created QUIZZES store');
      }

      // Flashcard sets store
      if (!db.objectStoreNames.contains(STORES.FLASHCARD_SETS)) {
        const setsStore = db.createObjectStore(STORES.FLASHCARD_SETS, { keyPath: '_id' });
        setsStore.createIndex('userId', 'userId', { unique: false });
        setsStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('✓ Created FLASHCARD_SETS store');
      }

      // Individual flashcards
      if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
        const cardsStore = db.createObjectStore(STORES.FLASHCARDS, { keyPath: '_id' });
        cardsStore.createIndex('setId', 'setId', { unique: false });
        cardsStore.createIndex('userId', 'userId', { unique: false });
        console.log('✓ Created FLASHCARDS store');
      }

      // Quiz attempts
      if (!db.objectStoreNames.contains(STORES.QUIZ_ATTEMPTS)) {
        const attemptsStore = db.createObjectStore(STORES.QUIZ_ATTEMPTS, { keyPath: 'id', autoIncrement: true });
        attemptsStore.createIndex('quizId', 'quizId', { unique: false });
        attemptsStore.createIndex('userId', 'userId', { unique: false });
        attemptsStore.createIndex('timestamp', 'timestamp', { unique: false });
        attemptsStore.createIndex('synced', 'synced', { unique: false });
        console.log('✓ Created QUIZ_ATTEMPTS store');
      }

      // Sync queue
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('type', 'type', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('synced', 'synced', { unique: false });
        console.log('✓ Created SYNC_QUEUE store');
      }

      // User progress
      if (!db.objectStoreNames.contains(STORES.USER_PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.USER_PROGRESS, { keyPath: 'id', autoIncrement: true });
        progressStore.createIndex('flashcardId', 'flashcardId', { unique: false });
        progressStore.createIndex('userId', 'userId', { unique: false });
        progressStore.createIndex('lastReview', 'lastReview', { unique: false });
        console.log('✓ Created USER_PROGRESS store');
      }

      // Settings
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        console.log('✓ Created SETTINGS store');
      }

      // Documents
      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: '_id' });
        docStore.createIndex('userId', 'userId', { unique: false });
        docStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('✓ Created DOCUMENTS store');
      }

      // Document Content (Blobs)
      if (!db.objectStoreNames.contains(STORES.DOCUMENT_CONTENT)) {
        db.createObjectStore(STORES.DOCUMENT_CONTENT, { keyPath: 'id' });
        console.log('✓ Created DOCUMENT_CONTENT store');
      }
    };
  });

  return dbPromise;
};

/**
 * Save a quiz to local storage
 */
export const saveQuiz = async (quiz: any, userId?: string): Promise<void> => {
  try {
    if (!quiz || !quiz._id) {
      throw new Error('Quiz must have an _id property');
    }
    
    // Extract userId for indexing if not provided
    const effectiveUserId = userId || quiz.userId || (quiz.createdBy && (quiz.createdBy._id || quiz.createdBy.id));
    
    const db = await openDB();
    
    // Ensure the store exists
    if (!db.objectStoreNames.contains(STORES.QUIZZES)) {
      throw new Error(`Object store ${STORES.QUIZZES} not found. Database may not be initialized.`);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUIZZES], 'readwrite');
      const store = transaction.objectStore(STORES.QUIZZES);
      
      const dataToSave = { 
        ...quiz, 
        userId: effectiveUserId,
        savedAt: new Date().toISOString() 
      };
      
      const request = store.put(dataToSave);

      request.onerror = () => {
        console.error('Error saving quiz:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log('Quiz saved successfully:', quiz._id);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('Transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('saveQuiz error:', error);
    throw error;
  }
};

/**
 * Get a quiz by ID
 */
export const getQuiz = async (quizId: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZZES], 'readonly');
    const store = transaction.objectStore(STORES.QUIZZES);
    const request = store.get(quizId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get all quizzes for user
 */
export const getQuizzesByUser = async (userId: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZZES], 'readonly');
    const store = transaction.objectStore(STORES.QUIZZES);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get ALL quizzes stored locally (no user filter)
 * Useful for secondary fallback
 */
export const getAllQuizzes = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZZES], 'readonly');
    const store = transaction.objectStore(STORES.QUIZZES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Save a quiz attempt (test taken)
 */
export const saveQuizAttempt = async (attempt: any): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZ_ATTEMPTS], 'readwrite');
    const store = transaction.objectStore(STORES.QUIZ_ATTEMPTS);
    const request = store.add({
      ...attempt,
      timestamp: new Date().toISOString(),
      synced: false
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
};

/**
 * Get quiz attempt by ID
 */
export const getQuizAttempt = async (attemptId: number): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZ_ATTEMPTS], 'readonly');
    const store = transaction.objectStore(STORES.QUIZ_ATTEMPTS);
    const request = store.get(attemptId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get all unsynced quiz attempts
 */
export const getUnsyncedAttempts = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZ_ATTEMPTS], 'readonly');
    const store = transaction.objectStore(STORES.QUIZ_ATTEMPTS);
    const request = store.getAll(); // Fetch all and filter in JS to avoid boolean index key issue

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      const unsynced = results.filter(item => item.synced === false);
      resolve(unsynced);
    };
  });
};

/**
 * Mark quiz attempt as synced
 */
export const markAttemptSynced = async (attemptId: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.QUIZ_ATTEMPTS], 'readwrite');
    const store = transaction.objectStore(STORES.QUIZ_ATTEMPTS);
    
    const getRequest = store.get(attemptId);
    getRequest.onsuccess = () => {
      const attempt = getRequest.result;
      const putRequest = store.put({ ...attempt, synced: true });
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

/**
 * Save flashcard set
 */
export const saveFlashcardSet = async (set: any, userId?: string): Promise<void> => {
  try {
    if (!set || !set._id) {
      throw new Error('Flashcard set must have an _id property');
    }
    
    // Extract userId for indexing if not provided
    const effectiveUserId = userId || set.userId || (set.createdBy && (set.createdBy._id || set.createdBy.id));
    
    const db = await openDB();
    
    // Ensure the store exists
    if (!db.objectStoreNames.contains(STORES.FLASHCARD_SETS)) {
      throw new Error(`Object store ${STORES.FLASHCARD_SETS} not found. Database may not be initialized.`);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.FLASHCARD_SETS], 'readwrite');
      const store = transaction.objectStore(STORES.FLASHCARD_SETS);
      
      const dataToSave = { 
        ...set, 
        userId: effectiveUserId,
        savedAt: new Date().toISOString() 
      };
      
      const request = store.put(dataToSave);

      request.onerror = () => {
        console.error('Error saving flashcard set:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log('Flashcard set saved successfully:', set._id);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('Transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('saveFlashcardSet error:', error);
    throw error;
  }
};

/**
 * Get flashcard set by ID
 */
export const getFlashcardSet = async (setId: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARD_SETS], 'readonly');
    const store = transaction.objectStore(STORES.FLASHCARD_SETS);
    const request = store.get(setId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get all flashcard sets for user
 */
export const getFlashcardSetsByUser = async (userId: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARD_SETS], 'readonly');
    const store = transaction.objectStore(STORES.FLASHCARD_SETS);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get ALL locally stored flashcard sets
 */
export const getAllFlashcardSets = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARD_SETS], 'readonly');
    const store = transaction.objectStore(STORES.FLASHCARD_SETS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * SPEED OPTIMIZATION: Get full flashcard set and all its cards in one transaction
 */
export const getFullSetOffline = async (setId: string): Promise<{set: any, cards: any[]}> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORES.FLASHCARD_SETS, STORES.FLASHCARDS], 'readonly');
      const setStore = transaction.objectStore(STORES.FLASHCARD_SETS);
      const cardsStore = transaction.objectStore(STORES.FLASHCARDS);
      const cardsIndex = cardsStore.index('setId');

      const setReq = setStore.get(setId);
      const cardsReq = cardsIndex.getAll(setId);

      let set: any = null;
      let cards: any[] = [];
      let counts = 0;

      const checkDone = () => {
        counts++;
        if (counts === 2) {
          resolve({ set, cards });
        }
      };

      setReq.onsuccess = () => {
        set = setReq.result;
        checkDone();
      };
      cardsReq.onsuccess = () => {
        cards = cardsReq.result || [];
        checkDone();
      };

      setReq.onerror = () => reject(setReq.error);
      cardsReq.onerror = () => reject(cardsReq.error);
      transaction.onerror = () => reject(transaction.error);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Get all flashcards in a set
 */
export const getFlashcardsBySet = async (setId: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARDS], 'readonly');
    const store = transaction.objectStore(STORES.FLASHCARDS);
    const index = store.index('setId');
    const request = index.getAll(setId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Save flashcards (bulk)
 */
export const saveFlashcards = async (cards: any[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARDS], 'readwrite');
    const store = transaction.objectStore(STORES.FLASHCARDS);

    cards.forEach(card => {
      store.put(card);
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
};

/**
 * Save single flashcard
 */
export const saveFlashcard = async (card: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FLASHCARDS], 'readwrite');
    const store = transaction.objectStore(STORES.FLASHCARDS);
    const request = store.put({ ...card, savedAt: new Date().toISOString() });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * Add to sync queue (action to sync later)
 */
export const addToSyncQueue = async (action: {
  type: 'quiz_attempt' | 'flashcard_review' | 'progress_update';
  data: any;
  retries?: number;
}): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.add({
      ...action,
      timestamp: new Date().toISOString(),
      synced: false,
      retries: action.retries || 0
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
};

/**
 * Get all unsynced actions
 */
export const getUnsyncedActions = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    
    // Safely check if store exists
    if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
      console.warn(`${STORES.SYNC_QUEUE} store not found, returning empty array`);
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.getAll(); // Fetch all and filter in JS to avoid boolean index key issue

      request.onerror = () => {
        console.error('Error getting unsynced actions:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        const results = request.result || [];
        const unsynced = results.filter(item => item.synced === false);
        console.log('Found unsynced actions:', unsynced.length);
        resolve(unsynced);
      };
      
      transaction.onerror = () => {
        console.error('Transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('getUnsyncedActions error:', error);
    return [];
  }
};

/**
 * Mark action as synced
 */
export const markActionSynced = async (actionId: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    const getRequest = store.get(actionId);
    getRequest.onsuccess = () => {
      const action = getRequest.result;
      const putRequest = store.put({ ...action, synced: true });
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

/**
 * Delete action from sync queue (after successful sync)
 */
export const deleteSyncAction = async (actionId: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(actionId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * Save flashcard review/progress
 */
export const saveFlashcardProgress = async (progress: {
  flashcardId: string;
  userId: string;
  reviewCount: number;
  correctCount: number;
  lastReview: string;
  difficulty: number;
}): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.USER_PROGRESS], 'readwrite');
    const store = transaction.objectStore(STORES.USER_PROGRESS);
    const request = store.add(progress);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * Get flashcard progress for user
 */
export const getFlashcardProgress = async (flashcardId: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.USER_PROGRESS], 'readonly');
    const store = transaction.objectStore(STORES.USER_PROGRESS);
    const index = store.index('flashcardId');
    const request = index.getAll(flashcardId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Clear all data (use with caution)
 */
export const clearDatabase = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.values(STORES), 'readwrite');

    Object.values(STORES).forEach(store => {
      transaction.objectStore(store).clear();
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
};

/**
 * Get database stats (for debugging)
 */
export const getDatabaseStats = async (): Promise<any> => {
  const db = await openDB();
  const stats: any = {};

  for (const store of Object.values(STORES)) {
    const transaction = db.transaction([store as string], 'readonly');
    const objStore = transaction.objectStore(store as string);
    
    await new Promise((resolve) => {
      const request = objStore.count();
      request.onsuccess = () => {
        stats[store] = request.result;
        resolve(null);
      };
    });
  }

  return stats;
};

/**
 * Save document metadata and optional content
 */
export const saveDocument = async (doc: any, content?: Blob): Promise<void> => {
  const db = await openDB();
  
  // Save metadata
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.put(doc);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Save content if provided
  if (content) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORES.DOCUMENT_CONTENT], 'readwrite');
      const store = transaction.objectStore(STORES.DOCUMENT_CONTENT);
      const request = store.put({ id: doc._id, content });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
};

/**
 * Get document content (Blob) from local storage
 */
export const getDocumentContent = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENT_CONTENT], 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENT_CONTENT);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result ? request.result.content : null);
    };
  });
};

/**
 * Get all documents from local storage
 */
export const getOfflineDocuments = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};
