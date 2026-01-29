/**
 * Request Rate Limiter & Cacher
 * Prevents 429 (Too Many Requests) errors by:
 * 1. Caching responses for GET requests
 * 2. Debouncing rapid requests to same endpoint
 * 3. Implementing exponential backoff for retries
 * 4. Respecting Retry-After headers
 */

interface CachedRequest {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestRateLimiter {
  private cache: Map<string, CachedRequest> = new Map();
  private pending: Map<string, PendingRequest> = new Map();
  private retryAfter: Map<string, number> = new Map();
  private rateLimitResetTime: number = 0;

  // Cache TTL (Time To Live) in milliseconds
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly FAST_CACHE_TTL = 30 * 1000; // 30 seconds for frequently accessed data
  private readonly SLOW_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for slower queries

  /**
   * Get from cache if available and not expired
   */
  getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }

  /**
   * Store in cache with TTL
   */
  setCache(key: string, data: any, ttl: number = this.DEFAULT_CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    console.log(`[Cache SET] ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Deduplicate pending requests
   * If same request is in flight, return existing promise instead of making new one
   */
  getPendingRequest(key: string): Promise<any> | null {
    const pending = this.pending.get(key);
    if (!pending) return null;

    const now = Date.now();
    // Consider request "stale" after 5 seconds
    if (now - pending.timestamp > 5000) {
      this.pending.delete(key);
      return null;
    }

    console.log(`[Dedup] Returning pending request: ${key}`);
    return pending.promise;
  }

  /**
   * Store pending request to prevent duplicates
   */
  setPendingRequest(key: string, promise: Promise<any>): void {
    this.pending.set(key, {
      promise,
      timestamp: Date.now()
    });

    // Clean up after request completes
    promise
      .then(() => this.pending.delete(key))
      .catch(() => this.pending.delete(key));
  }

  /**
   * Handle 429 response by respecting Retry-After header
   */
  handleRateLimit(key: string, retryAfterSeconds: number = 60): void {
    console.warn(`[Rate Limit] ${key} - Retry after ${retryAfterSeconds}s`);
    this.retryAfter.set(key, Date.now() + (retryAfterSeconds * 1000));
    this.rateLimitResetTime = Math.max(this.rateLimitResetTime, Date.now() + (retryAfterSeconds * 1000));
  }

  /**
   * Check if endpoint is currently rate limited
   */
  isRateLimited(key: string): boolean {
    const resetTime = this.retryAfter.get(key);
    if (!resetTime) return false;

    if (Date.now() >= resetTime) {
      this.retryAfter.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get wait time before retrying
   */
  getWaitTime(key: string): number {
    const resetTime = this.retryAfter.get(key);
    if (!resetTime) return 0;
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Cache] Cleared');
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      cachedItems: this.cache.size,
      pendingRequests: this.pending.size,
      rateLimitedEndpoints: this.retryAfter.size,
      globalRateLimitResetTime: this.rateLimitResetTime
    };
  }
}

// Singleton instance
export const requestLimiter = new RequestRateLimiter();

/**
 * Exponential backoff calculator for retries
 */
export function getExponentialBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Request cache key generator
 * Includes method, URL, and relevant query params
 */
export function getCacheKey(method: string, url: string, data?: any): string {
  const baseKey = `${method.toUpperCase()}:${url}`;
  
  // Include data in key for POST/PUT requests
  if (data && (method === 'POST' || method === 'PUT')) {
    return `${baseKey}:${JSON.stringify(data)}`;
  }
  
  return baseKey;
}

/**
 * Cache key prefixes for common endpoints
 * Use shorter TTL for frequently changing data
 */
export const CACHE_KEYS = {
  // User endpoints
  'GET:/users/me': { ttl: 5 * 60 * 1000 }, // 5 mins
  
  // Notifications - frequent updates
  'GET:/notifications/count': { ttl: 30 * 1000 }, // 30 secs
  'GET:/notifications': { ttl: 30 * 1000 },
  
  // Chat - medium frequency
  'GET:/chat/messages': { ttl: 60 * 1000 }, // 1 min
  'GET:/personal-chat/messages': { ttl: 60 * 1000 },
  
  // Groups - lower frequency
  'GET:/groups': { ttl: 5 * 60 * 1000 }, // 5 mins
  'GET:/groups/': { ttl: 5 * 60 * 1000 },
  
  // Gamification
  'GET:/gamification': { ttl: 2 * 60 * 1000 }, // 2 mins
  'GET:/leaderboard': { ttl: 5 * 60 * 1000 }, // 5 mins
  
  // Files - long cache (content rarely changes)
  'GET:/files': { ttl: 10 * 60 * 1000 }, // 10 mins
};

/**
 * Get TTL for a given endpoint
 */
export function getTTLForEndpoint(method: string, url: string): number {
  const key = `${method}:${url}`;
  
  // Check exact match first
  if (CACHE_KEYS[key as keyof typeof CACHE_KEYS]) {
    return CACHE_KEYS[key as keyof typeof CACHE_KEYS].ttl;
  }
  
  // Check prefix matches
  for (const [cacheKey, config] of Object.entries(CACHE_KEYS)) {
    if (key.startsWith(cacheKey.replace(/\/$/, ''))) {
      return config.ttl;
    }
  }
  
  // Default TTL
  return 5 * 60 * 1000; // 5 minutes
}
