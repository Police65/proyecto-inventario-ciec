import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import CustomNavbar from './Navbar'; // Assuming Navbar.tsx exports default CustomNavbar
import Sidebar from './Sidebar'; // Assuming Sidebar.tsx exports default Sidebar
import { UserProfile } from '../../types'; // Path relative to src/components/core
import { useAuth } from '../../hooks/useAuth'; // Path relative to src/components/core
import { useInactivityTimer } from '../../hooks/useInactivityTimer'; // Path relative to src/components/core
import { supabase } from '../../supabaseClient'; // Path relative to src/components/core
import LoadingSpinner from './LoadingSpinner';

interface AuthenticatedLayoutProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ userProfile, onLogout }) => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(window.innerWidth >= 1024);
  const navigate = useNavigate();
  const location = useLocation();

  const [activeUITab, setActiveUITab] = useState('solicitudes');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  useEffect(() => {
    if (userProfile?.rol === 'usuario' && userProfile.empleado_id) {
      const fetchPendingCount = async () => {
        const { count, error } = await supabase
          .from('solicitudcompra')
          .select('*', { count: 'exact', head: true })
          .eq('empleado_id', userProfile.empleado_id!)
          .eq('estado', 'Pendiente');
        
        if (error) {
          console.error("Error fetching pending requests count:", error);
        } else {
          setPendingRequestsCount(count || 0);
        }
      };
      fetchPendingCount();
    }
  }, [userProfile]);


  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  useEffect(() => {
    if (window.innerWidth < 1024 && isSidebarVisible) {
      setIsSidebarVisible(false);
    }
  }, [location.pathname, isSidebarVisible]);


  const { showWarningModal, timeLeft, setShowWarningModal, resetTimers } = useInactivityTimer({
    onLogout: () => {
      onLogout();
    },
    isUserActive: !!userProfile, 
  });

  const handleContinueSession = () => {
    resetTimers();
    setShowWarningModal(false);
  };
  
  useEffect(() => {
    if (!userProfile) {
      console.warn("AuthenticatedLayout rendered without userProfile, App.tsx should have redirected.");
    }
  }, [userProfile, navigate]);

  if (!userProfile) {
    return <LoadingSpinner message="Sesión terminada, redirigiendo..." />; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <Sidebar 
        isVisible={isSidebarVisible} 
        userProfile={userProfile}
        pendingRequestsCount={pendingRequestsCount}
        onNewRequestClick={() => navigate('/new-request')}
        onSelectTab={setActiveUITab}
        onLogout={onLogout}
        activeUITab={activeUITab}
      />
      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <CustomNavbar 
          userProfile={userProfile} 
          onToggleSidebar={toggleSidebar}
          onLogout={onLogout}
        />
        <main className="h-full pt-16">
          <div className="container mx-auto px-6 py-8">
            <Outlet context={{ userProfile, activeUITab, setActiveUITab }} />
          </div>
        </main>
      </div>

      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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