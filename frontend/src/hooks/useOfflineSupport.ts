import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to detect online/offline status
 */
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new Event('app-online'));
    };

    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new Event('app-offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
};

/**
 * Hook to register service worker and manage offline features
 */
export const useServiceWorker = () => {
  const [swReady, setSwReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          setSwReady(true);
          console.log('Service Worker registered');

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error);
        });
    }
  }, []);

  const updateApp = useCallback(() => {
    if (updateAvailable) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        registration?.installing?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
    }
  }, [updateAvailable]);

  return { swReady, updateAvailable, updateApp };
};

/**
 * Hook to listen for sync messages from service worker
 */
export const useSyncListener = (onSync: () => void) => {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_OFFLINE_DATA') {
        onSync();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [onSync]);
};
