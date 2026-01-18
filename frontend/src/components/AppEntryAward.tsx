import React from 'react';
import { useAuthStore } from '../services/store';

export const AppEntryAward: React.FC = () => {
  const { user } = useAuthStore();

  React.useEffect(() => {
    const awardDailyXP = async () => {
      if (!user) return;

      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        // Call the enter endpoint to award daily XP if not already awarded today
        // The backend handles atomic operations to prevent duplicates
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/gamification/enter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        // Silently fail - daily XP is not critical
        console.warn('Failed to award daily XP on app entry:', error);
      }
    };

    awardDailyXP();
  }, [user]);

  return null;
};