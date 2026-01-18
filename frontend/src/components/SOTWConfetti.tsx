import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '../hooks/useWindowSize';
import { sotwAPI } from '../services/api';
import { useAuthStore } from '../services/store';

export const SOTWConfetti: React.FC = () => {
  const { width, height } = useWindowSize();
  const { user } = useAuthStore();
  const [isSOTWWinner, setIsSOTWWinner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const checkSOTWStatus = async () => {
      if (!user) return;

      try {
        const response = await sotwAPI.getCurrent();
        const currentWinner = response.data.winner;

        // Check if current user is the SOTW winner
        if (currentWinner && currentWinner.user_id === user.id) {
          setIsSOTWWinner(true);
          // Show confetti for 5 seconds
          setShowConfetti(true);
          const timer = setTimeout(() => setShowConfetti(false), 5000);
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('Failed to check SOTW status:', error);
      }
    };

    checkSOTWStatus();
  }, [user]);

  if (!showConfetti || !isSOTWWinner) return null;

  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={200}
      gravity={0.3}
      recycle={true}
      colors={['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32']}
    />
  );
};
