
import React, { useState, useEffect, useCallback, useRef } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import CustomNavbar from './Navbar';
import { Sidebar } from './Sidebar'; // Importación nombrada
import { UserProfile } from '../../types';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import { supabase } from '../../supabaseClient'; // Para el conteo de solicitudes
import LoadingSpinner from './LoadingSpinner';

interface AuthenticatedLayoutProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

// Constantes para la detección de gestos táctiles (swipe)
const SWIPE_THRESHOLD = 50; // Mínimo de píxeles para considerar un deslizamiento
const SWIPE_EDGE_ZONE = 50; // Máximo de píxeles desde el borde izquierdo para iniciar un deslizamiento para abrir sidebar

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ userProfile, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Estado para la visibilidad de la barra lateral, persistido en localStorage.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const storedSidebarState = localStorage.getItem('sidebarOpen');
    const onMainPage = location.pathname === '/home' || location.pathname === '/'; // ¿Está en la página principal?
    
    if (storedSidebarState !== null) { // Si hay un estado guardado, usarlo.
      return storedSidebarState === 'true';
    }
    // Comportamiento por defecto si no hay estado guardado:
    // En pantallas grandes (>=1024px), la sidebar no se muestra en la página principal por defecto,
    // pero sí en otras páginas. Esto cambia si el usuario interactúa.
    return !onMainPage && window.innerWidth >= 1024;
  });

  // Estado para rastrear si el usuario ha interactuado con la UI principal (navegado o usado sidebar/navbar).
  // Esto ayuda a decidir si mostrar la navbar/sidebar en la página principal.
  const [hasInteracted, setHasInteracted] = useState(() => {
    // Si no está en la página principal al cargar, se considera que ya interactuó.
    return !(location.pathname === '/home' || location.pathname === '/');
  });

  const [activeUITab, setActiveUITab] = useState('solicitudes'); // Pestaña activa por defecto para vistas con pestañas (ej. AdminDashboardPage)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0); // Conteo de solicitudes pendientes para usuarios
  
  const touchStartX = useRef<number | null>(null); // Coordenada X inicial para gestos táctiles

  const isOnMainPage = location.pathname === '/home' || location.pathname === '/';

  // Determinar visibilidad real de navbar y sidebar basado en interacción y estado.
  // La navbar se muestra si no está en la página principal O si ya interactuó O si la sidebar está abierta.
  const actualNavbarVisible = (!isOnMainPage || hasInteracted) ? true : isSidebarOpen;
  const actualSidebarVisible = isSidebarOpen; // La sidebar se muestra si su estado es abierto.

  // Efecto para manejar la interacción inicial y el estado de la sidebar.
  useEffect(() => {
    if (!isOnMainPage && !hasInteracted) {
      setHasInteracted(true); // Marcar como interactuado si carga en una página que no es la principal.
      // Si es la primera vez que no está en la página principal y no hay estado de sidebar guardado,
      // decidir si la sidebar debe estar abierta por defecto en pantallas grandes.
      if (localStorage.getItem('sidebarOpen') === null) {
        const shouldBeOpenByDefault = window.innerWidth >= 1024;
        setIsSidebarOpen(shouldBeOpenByDefault);
        localStorage.setItem('sidebarOpen', String(shouldBeOpenByDefault));
      }
    }
  }, [location.pathname, hasInteracted, isOnMainPage]); // Dependencias para re-evaluar
  
  // Efecto para obtener el conteo de solicitudes pendientes del usuario (si es rol 'usuario').
  useEffect(() => {
    if (userProfile?.rol === 'usuario' && userProfile.empleado_id) {
      const fetchPendingCount = async () => {
        const { count, error } = await supabase
          .from('solicitudcompra')
          .select('*', { count: 'exact', head: true }) // Solo contar, no traer datos
          .eq('empleado_id', userProfile.empleado_id!)
          .eq('estado', 'Pendiente');
        
        if (error) {
          console.error("Error al obtener el conteo de solicitudes pendientes del usuario:", error);
        } else {
          setPendingRequestsCount(count || 0);
        }
      };
      fetchPendingCount();
    }
  }, [userProfile]); // Dependencia en userProfile para re-obtener si cambia

  // Función para alternar la visibilidad de la barra lateral.
  const toggleSidebar = useCallback(() => {
    const newIsOpen = !isSidebarOpen;
    setIsSidebarOpen(newIsOpen);
    localStorage.setItem('sidebarOpen', String(newIsOpen)); // Guardar estado
    if (!hasInteracted) { // Si es la primera interacción, marcarla.
      setHasInteracted(true);
    }
  }, [isSidebarOpen, hasInteracted]);

  // Efecto para manejar gestos táctiles (swipe para abrir/cerrar sidebar).
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Solo registrar inicio de swipe si el toque está cerca del borde izquierdo y la sidebar está cerrada.
      if (e.touches[0].clientX < SWIPE_EDGE_ZONE && !isSidebarOpen) { 
        touchStartX.current = e.touches[0].clientX;
      } else {
        touchStartX.current = null; // Ignorar si no es un swipe desde el borde para abrir.
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return; // No se registró un inicio de swipe válido.
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchEndX - touchStartX.current;

      // Si desliza hacia la derecha lo suficiente Y la barra está cerrada -> Abrir sidebar.
      if (deltaX > SWIPE_THRESHOLD && !isSidebarOpen) { 
        setIsSidebarOpen(true);
        localStorage.setItem('sidebarOpen', 'true');
        if (!hasInteracted) setHasInteracted(true);
      }
      // (Podría añadirse lógica para cerrar con swipe hacia la izquierda si está abierta)
      touchStartX.current = null; // Resetear para el próximo gesto.
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => { // Limpieza de eventos al desmontar.
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSidebarOpen, hasInteracted, toggleSidebar]); // toggleSidebar agregado para la lógica de cierre si se implementa.


  // Efecto para cerrar la barra lateral en pantallas pequeñas al cambiar de ruta (comportamiento móvil típico).
  useEffect(() => {
    if (window.innerWidth < 1024 && isSidebarOpen) { // Si es pantalla pequeña y la sidebar está abierta
      // Comprobar si la ruta actual es diferente a la última ruta donde se interactuó con la sidebar.
      // Esto evita que se cierre si el usuario solo abrió y cerró la sidebar sin navegar.
      if (location.pathname !== (localStorage.getItem('lastPathForSidebarToggle') || '')) {
        setIsSidebarOpen(false);
        localStorage.setItem('sidebarOpen', 'false');
      }
    }
    // Guardar la ruta actual para la próxima comparación.
    localStorage.setItem('lastPathForSidebarToggle', location.pathname);
  }, [location.pathname, isSidebarOpen]);


  // Hook para el temporizador de inactividad.
  const { showWarningModal, timeLeft, setShowWarningModal, resetTimers } = useInactivityTimer({
    onLogout: onLogout,
    isUserActive: !!userProfile, // El temporizador solo se activa si hay un perfil de usuario (está logueado).
  });

  const handleContinueSession = () => {
    resetTimers(); // Reiniciar temporizadores de inactividad.
    setShowWarningModal(false); // Ocultar modal de advertencia.
  };
  
  // Advertencia en consola si este layout se renderiza sin un perfil de usuario.
  // Esto no debería ocurrir si App.tsx maneja correctamente la redirección a /login.
  useEffect(() => {
    if (!userProfile) {
      console.warn("[AuthenticatedLayout] Renderizado sin userProfile. App.tsx debería haber redirigido a /login.");
    }
  }, [userProfile, navigate]);

  // Si no hay perfil de usuario (ej. sesión expirada y el hook useAuth está en proceso de logout),
  // mostrar un spinner. App.tsx eventualmente redirigirá a /login.
  if (!userProfile) {
    return <LoadingSpinner message="Sesión terminada o inválida, redirigiendo..." />; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden"> {/* Contenedor principal a pantalla completa */}
      <Sidebar 
        isVisible={actualSidebarVisible} 
        userProfile={userProfile}
        pendingRequestsCount={pendingRequestsCount}
        onNewRequestClick={() => {
          setHasInteracted(true); 
          navigate('/new-request');
        }}
        onSelectTab={(tab) => {
          setHasInteracted(true); 
          setActiveUITab(tab);
        }}
        onLogout={onLogout}
        activeUITab={activeUITab}
        setHasInteracted={setHasInteracted} // Permitir que Sidebar marque interacción
      />
      
      {/* Área de contenido principal que tendrá scroll vertical si es necesario */}
      <div 
        className={`flex flex-col flex-1 w-full overflow-y-auto transition-all duration-300 ease-in-out ${
          // Aplicar margen izquierdo solo en pantallas grandes (lg) cuando la sidebar es visible (y se asume fija)
          actualSidebarVisible ? 'lg:ml-64' : 'ml-0' 
        }`}
      >
        {actualNavbarVisible && ( // Mostrar Navbar si corresponde
          <CustomNavbar 
            userProfile={userProfile} 
            onToggleSidebar={toggleSidebar}
            onLogout={onLogout}
            setHasInteracted={setHasInteracted} // Permitir que Navbar marque interacción
          />
        )}
        {/* El contenido principal (Outlet) */}
        <main className={`h-full ${actualNavbarVisible ? 'pt-16' : 'pt-0'}`}> {/* Ajustar padding superior si navbar está visible */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
            {/* Pasar userProfile, activeUITab, setActiveUITab, y setHasInteracted al contexto del Outlet
                para que las páginas hijas puedan acceder a ellos y marcar interacción si es necesario. */}
            <Outlet context={{ userProfile, activeUITab, setActiveUITab, setHasInteracted }} />
          </div>
        </main>
      </div>

      {/* Modal de advertencia de inactividad */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50"> {/* Overlay oscuro */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sesión a punto de expirar</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tu sesión se cerrará en {Math.floor(timeLeft / 60)}:{/* Minutos */}
              {(timeLeft % 60).toString().padStart(2, '0')}{/* Segundos */} por inactividad.
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">¿Deseas mantener la sesión abierta?</p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onLogout} // Cerrar sesión inmediatamente
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cerrar sesión ahora
              </button>
              <button
                onClick={handleContinueSession} // Continuar sesión (resetear timers)
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Mantener sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};