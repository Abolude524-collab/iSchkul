/**
 * Service Worker for iSchkul Offline Support
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'ischkul-v1';
const ASSETS_CACHE = 'ischkul-assets-v1';
const API_CACHE = 'ischkul-api-v1';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// API endpoints to cache responses
const CACHEABLE_APIS = [
  '/api/quizzes',
  '/api/flashcards',
  '/api/users/me'
];

/**
 * Install event - cache essential assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        console.warn('Some assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== ASSETS_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - offline support with network-first/cache-first strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: Network-first for API calls (try network, fallback to cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // CRITICAL: Clone IMMEDIATELY before body is consumed
          if (!response.ok) {
            return response;
          }
          
          // Clone the response to cache it
          const responseClone = response.clone();
          
          // Cache in background (don't block response)
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseClone).catch((err) => {
              console.warn('Failed to cache API response:', err);
            });
          });
          
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            
            return new Response(
              JSON.stringify({ error: 'Offline - cached data not available' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Strategy 2: Cache-first for static assets (use cache, fallback to network)
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => {
          if (cached) return cached;
          
          return fetch(request).then((response) => {
            if (!response.ok) {
              return response;
            }
            
            // Clone BEFORE consuming body
            const responseClone = response.clone();
            
            // Cache in background
            caches.open(ASSETS_CACHE).then((cache) => {
              cache.put(request, responseClone).catch((err) => {
                console.warn('Failed to cache asset:', err);
              });
            });
            
            return response;
          });
        })
        .catch(() => {
          // Return placeholder for failed assets
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50" y="50" text-anchor="middle" dy=".3em">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        })
    );
    return;
  }

  // Strategy 3: Network-first for navigation/HTML pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest version of the root page
          if (response.ok && url.pathname === '/') {
            const responseClone = response.clone();
            caches.open(ASSETS_CACHE).then(cache => cache.put('/', responseClone));
          }
          return response;
        })
        .catch(() => {
          // OFFLINE: Fallback to the cached index.html for ALL navigation requests (SPA)
          return caches.match('/').then((cached) => {
            if (cached) return cached;
            
            // If even root isn't cached, try index.html or offline.html
            return caches.match('/index.html').then(idx => {
               return idx || caches.match('/offline.html');
            });
          });
        })
    );
    return;
  }

  // Strategy 4: Fallback for all other requests
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

/**
 * Background Sync - sync queued actions when online
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * Push notifications for sync events
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png'
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/**
 * Sync offline data to server
 */
async function syncOfflineData() {
  try {
    // This would be called when device comes online
    // The actual sync logic is handled by the app
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_OFFLINE_DATA'
      });
    });
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// Handle messages from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
