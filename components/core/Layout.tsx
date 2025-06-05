import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import CustomNavbar from './Navbar';
import { Sidebar } from './Sidebar';
import { UserProfile } from '../../types';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import { supabase } from '../../supabaseClient';
import LoadingSpinner from './LoadingSpinner';

interface AuthenticatedLayoutProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

const SWIPE_THRESHOLD = 50; 
const SWIPE_EDGE_ZONE = 50; 

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ userProfile, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const storedSidebarState = localStorage.getItem('sidebarOpen');
    const onMain = location.pathname === '/home' || location.pathname === '/';
    if (storedSidebarState !== null) {
      return storedSidebarState === 'true';
    }
    return !onMain && window.innerWidth >= 1024;
  });

  const [hasInteracted, setHasInteracted] = useState(() => {
    return !(location.pathname === '/home' || location.pathname === '/');
  });

  const [activeUITab, setActiveUITab] = useState('solicitudes');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  const touchStartX = useRef<number | null>(null);


  const isOnMainPage = location.pathname === '/home' || location.pathname === '/';

  const actualNavbarVisible = (!isOnMainPage || hasInteracted) ? true : isSidebarOpen;
  const actualSidebarVisible = isSidebarOpen;

  useEffect(() => {
    if (!isOnMainPage && !hasInteracted) {
      setHasInteracted(true);
      if (localStorage.getItem('sidebarOpen') === null) {
        const shouldBeOpen = window.innerWidth >= 1024;
        setIsSidebarOpen(shouldBeOpen);
        localStorage.setItem('sidebarOpen', String(shouldBeOpen));
      }
    }
  }, [location.pathname, hasInteracted, isOnMainPage]);
  
  useEffect(() => {
    if (userProfile?.rol === 'usuario' && userProfile.empleado_id) {
      const fetchPendingCount = async () => {
        const { count, error } = await supabase
          .from('solicitudcompra')
          .select('*', { count: 'exact', head: true })
          .eq('empleado_id', userProfile.empleado_id!)
          .eq('estado', 'Pendiente');
        
        if (error) {
          console.error("Error al obtener el conteo de solicitudes pendientes:", error);
        } else {
          setPendingRequestsCount(count || 0);
        }
      };
      fetchPendingCount();
    }
  }, [userProfile]);

  const toggleSidebar = useCallback(() => {
    const newIsOpen = !isSidebarOpen;
    setIsSidebarOpen(newIsOpen);
    localStorage.setItem('sidebarOpen', String(newIsOpen));
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [isSidebarOpen, hasInteracted]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0].clientX < SWIPE_EDGE_ZONE) {
        touchStartX.current = e.touches[0].clientX;
      } else {
        touchStartX.current = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchEndX - touchStartX.current;

      if (deltaX > SWIPE_THRESHOLD && !isSidebarOpen) { 
        setIsSidebarOpen(true);
        localStorage.setItem('sidebarOpen', 'true');
        if (!hasInteracted) {
          setHasInteracted(true);
        }
      }
      touchStartX.current = null;
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSidebarOpen, hasInteracted]);


  useEffect(() => {
    if (window.innerWidth < 1024 && isSidebarOpen) {
      if (location.pathname !== (localStorage.getItem('lastPathForSidebarToggle') || '')) {
        setIsSidebarOpen(false);
        localStorage.setItem('sidebarOpen', 'false');
      }
    }
    localStorage.setItem('lastPathForSidebarToggle', location.pathname);
  }, [location.pathname, isSidebarOpen]);


  const { showWarningModal, timeLeft, setShowWarningModal, resetTimers } = useInactivityTimer({
    onLogout: onLogout,
    isUserActive: !!userProfile, 
  });

  const handleContinueSession = () => {
    resetTimers();
    setShowWarningModal(false);
  };
  
  useEffect(() => {
    if (!userProfile) {
      console.warn("Layout Autenticado renderizado sin userProfile, App.tsx debería haber redirigido.");
    }
  }, [userProfile, navigate]);

  if (!userProfile) {
    return <LoadingSpinner message="Sesión terminada, redirigiendo..." />; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
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
        setHasInteracted={setHasInteracted}
      />
      <div 
        className={`flex flex-col flex-1 w-full overflow-y-auto transition-all duration-300 ease-in-out ${
          actualSidebarVisible ? 'lg:ml-64' : 'ml-0' 
        }`}
      >
        {actualNavbarVisible && (
          <CustomNavbar 
            userProfile={userProfile} 
            onToggleSidebar={toggleSidebar}
            onLogout={onLogout}
            setHasInteracted={setHasInteracted}
          />
        )}
        <main className={`h-full ${actualNavbarVisible ? 'pt-16' : 'pt-0'}`}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
            <Outlet context={{ userProfile, activeUITab, setActiveUITab, setHasInteracted }} />
          </div>
        </main>
      </div>

      {showWarningModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sesión a punto de expirar</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tu sesión se cerrará en {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} debido a inactividad.
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">¿Deseas mantener la sesión abierta?</p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cerrar sesión ahora
              </button>
              <button
                onClick={handleContinueSession}
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