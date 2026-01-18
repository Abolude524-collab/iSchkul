import { useState, useEffect, useCallback } from 'react';

export const usePomodoro = (initialTime = 25 * 60) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const [isActive, setIsActive] = useState(false);
    const [isBreak, setIsBreak] = useState(false);

    const startTimer = useCallback(() => setIsActive(true), []);
    const pauseTimer = useCallback(() => setIsActive(false), []);
    const resetTimer = useCallback(() => {
        setIsActive(false);
        setTimeLeft(initialTime);
    }, [initialTime]);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((time) => time - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            setIsBreak(true);
            if (interval) clearInterval(interval);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft]);

    return {
        timeLeft,
        isActive,
        isBreak,
        setIsBreak,
        startTimer,
        pauseTimer,
        resetTimer
    };
};
