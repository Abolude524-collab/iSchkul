import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../services/store';
import {
  createAppTour,
  shouldShowTour,
  hasCompletedTour,
  markTourCompleted,
} from '../services/tourConfig';

/**
 * Hook to manage the onboarding tour
 * Automatically shows tour to new users on dashboard load
 */
export const useTour = () => {
  const tourRef = useRef<any>(null);
  const user = useAuthStore((state) => state.user);
  const [tourStarted, setTourStarted] = useState(false);

  /**
   * Start the tour
   */
  const startTour = () => {
    if (!tourRef.current) {
      tourRef.current = createAppTour();
    }

    // Add event listeners for tour completion/cancellation
    tourRef.current.on('complete', () => {
      if (user?.id) {
        markTourCompleted(user.id);
      }
      tourRef.current = null;
    });

    tourRef.current.on('cancel', () => {
      tourRef.current = null;
    });

    tourRef.current.start();
    setTourStarted(true);
  };

  /**
   * Stop/cancel the tour
   */
  const stopTour = () => {
    if (tourRef.current) {
      tourRef.current.cancel();
      tourRef.current = null;
    }
    setTourStarted(false);
  };

  /**
   * Auto-start tour for new users
   */
  useEffect(() => {
    if (
      user &&
      !tourStarted &&
      !hasCompletedTour(user.id) &&
      shouldShowTour(user)
    ) {
      // Small delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        startTour();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [user, tourStarted]);

  return {
    startTour,
    stopTour,
    tourRef,
  };
};

export default useTour;
