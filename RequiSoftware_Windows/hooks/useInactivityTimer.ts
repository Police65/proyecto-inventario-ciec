
import { useState, useEffect, useRef, useCallback } from 'react';

const INACTIVITY_WARNING_TIME = 10 * 60 * 1000; // 10 minutos para mostrar advertencia de inactividad
const INACTIVITY_LOGOUT_TIME = 15 * 60 * 1000; // 15 minutos totales desde la última actividad para cerrar sesión
const COUNTDOWN_DURATION = (INACTIVITY_LOGOUT_TIME - INACTIVITY_WARNING_TIME) / 1000; // Duración de la cuenta regresiva en segundos (5 minutos)

interface UseInactivityTimerProps {
  onLogout: () => void; // Función a ejecutar al cerrar sesión por inactividad
  isUserActive: boolean; // Para controlar si el temporizador debe ejecutarse (ej. si el usuario está logueado)
}

interface InactivityTimerResult {
  showWarningModal: boolean; // Estado para mostrar el modal de advertencia
  timeLeft: number; // Tiempo restante en segundos para la cuenta regresiva
  setShowWarningModal: React.Dispatch<React.SetStateAction<boolean>>; // Control manual del modal
  resetTimers: () => void; // Función para reiniciar los temporizadores (ej. al continuar sesión)
}

export function useInactivityTimer({ onLogout, isUserActive }: UseInactivityTimerProps): InactivityTimerResult {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_DURATION);

  const warningTimer = useRef<number | null>(null); // Timer para la advertencia
  const logoutTimer = useRef<number | null>(null);  // Timer para el cierre de sesión final
  const countdownInterval = useRef<number | null>(null); // Intervalo para la cuenta regresiva

  // Limpia todos los temporizadores e intervalos.
  const clearAllTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  // Inicia la cuenta regresiva que se muestra en el modal.
  const startCountdown = useCallback(() => {
    setTimeLeft(COUNTDOWN_DURATION);
    countdownInterval.current = window.setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) { // Si el tiempo llega a 0 o menos
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          // onLogout() es manejado por el logoutTimer principal para evitar llamadas dobles.
          // Este intervalo es solo para la UI.
          return 0;
        }
        return prevTime - 1; // Decrementar tiempo
      });
    }, 1000); // Cada segundo
  }, []);

  // Reinicia todos los temporizadores. Se llama con actividad del usuario o al continuar sesión.
  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarningModal(false); // Ocultar modal si estaba visible
    setTimeLeft(COUNTDOWN_DURATION); // Resetear cuenta regresiva

    if (isUserActive) { // Solo activar si el usuario está activo/logueado
      sessionStorage.setItem("sessionTime", Date.now().toString()); // Actualizar tiempo de última actividad

      // Programar la advertencia
      warningTimer.current = window.setTimeout(() => {
        setShowWarningModal(true); // Mostrar modal
        startCountdown(); // Iniciar cuenta regresiva del modal
      }, INACTIVITY_WARNING_TIME);

      // Programar el cierre de sesión final
      logoutTimer.current = window.setTimeout(() => {
        onLogout();
      }, INACTIVITY_LOGOUT_TIME);
    }
  }, [isUserActive, clearAllTimers, startCountdown, onLogout]);

  // Efecto principal: maneja la actividad del usuario y la configuración/limpieza de timers.
  useEffect(() => {
    if (!isUserActive) { // Si el usuario no está activo (ej. no logueado), limpiar todo y salir.
      clearAllTimers();
      setShowWarningModal(false);
      return;
    }

    // Eventos que indican actividad del usuario
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetTimers(); // Reiniciar temporizadores con cada actividad
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetTimers(); // Configuración inicial de los temporizadores al montar o cuando isUserActive cambia a true

    return () => { // Limpieza al desmontar o cuando isUserActive cambia a false
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isUserActive, resetTimers, clearAllTimers]); // clearAllTimers añadido a dependencias

  return { showWarningModal, timeLeft, setShowWarningModal, resetTimers };
}
