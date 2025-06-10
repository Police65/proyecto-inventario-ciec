import { useState, useEffect, useRef, useCallback } from 'react';

const INACTIVITY_WARNING_TIME = 5 * 60 * 1000; // 5 minutos para advertencia
const INACTIVITY_LOGOUT_TIME = 15 * 60 * 1000; // 15 minutos totales desde la última actividad para cierre de sesión
const COUNTDOWN_DURATION = (INACTIVITY_LOGOUT_TIME - INACTIVITY_WARNING_TIME) / 1000; // Ahora 10 minutos (600 segundos) de cuenta regresiva

interface UseInactivityTimerProps {
  onLogout: () => void;
  isUserActive: boolean; // Para controlar si el temporizador debe ejecutarse
}

interface InactivityTimerResult {
  showWarningModal: boolean;
  timeLeft: number; // en segundos
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
    countdownInterval.current = window.setInterval(() => {
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
      localStorage.setItem("sessionTime", Date.now().toString()); // Actualizar hora de última actividad

      warningTimer.current = window.setTimeout(() => {
        setShowWarningModal(true);
        startCountdown();
      }, INACTIVITY_WARNING_TIME);

      logoutTimer.current = window.setTimeout(() => {
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
    resetTimers(); // Configuración inicial

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isUserActive, resetTimers]);

  return { showWarningModal, timeLeft, setShowWarningModal, resetTimers };
}