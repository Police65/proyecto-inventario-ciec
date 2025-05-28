
import { useState, useEffect, useRef, useCallback } from 'react';

const INACTIVITY_WARNING_TIME = 10 * 60 * 1000; // 10 minutes
const INACTIVITY_LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes (total from last activity)
const COUNTDOWN_DURATION = (INACTIVITY_LOGOUT_TIME - INACTIVITY_WARNING_TIME) / 1000; // 5 minutes in seconds

interface UseInactivityTimerProps {
  onLogout: () => void;
  isUserActive: boolean; // To control whether the timer should run
}

interface InactivityTimerResult {
  showWarningModal: boolean;
  timeLeft: number; // in seconds
  setShowWarningModal: React.Dispatch<React.SetStateAction<boolean>>;
  resetTimers: () => void;
}

export function useInactivityTimer({ onLogout, isUserActive }: UseInactivityTimerProps): InactivityTimerResult {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_DURATION);

  const warningTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const countdownInterval = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  const startCountdown = useCallback(() => {
    setTimeLeft(COUNTDOWN_DURATION);
    countdownInterval.current = window.setInterval(() => { // Use window.setInterval for clarity
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          onLogout();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [onLogout]);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarningModal(false);
    setTimeLeft(COUNTDOWN_DURATION);

    if (isUserActive) {
      localStorage.setItem("sessionTime", Date.now().toString()); // Update last activity time

      warningTimer.current = window.setTimeout(() => { // Use window.setTimeout
        setShowWarningModal(true);
        startCountdown();
      }, INACTIVITY_WARNING_TIME);

      logoutTimer.current = window.setTimeout(() => { // Use window.setTimeout
        onLogout();
      }, INACTIVITY_LOGOUT_TIME);
    }
  }, [isUserActive, clearAllTimers, startCountdown, onLogout]);

  useEffect(() => {
    if (!isUserActive) {
      clearAllTimers();
      setShowWarningModal(false);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetTimers();
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetTimers(); // Initial setup

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isUserActive, resetTimers]);

  return { showWarningModal, timeLeft, setShowWarningModal, resetTimers };
}
