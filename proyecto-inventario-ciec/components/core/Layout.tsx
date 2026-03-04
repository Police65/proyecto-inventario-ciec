import React, { useState, useEffect, useCallback, useRef } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import CustomNavbar from './Navbar';
import { Sidebar } from './Sidebar'; // Importación nombrada
import { UserProfile, Inventario } from '../../types';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import { useGuidedTour } from '../../hooks/useGuidedTour'; // Importar el nuevo hook del tour
import { supabase } from '../../supabaseClient'; // Para el conteo de solicitudes
import LoadingSpinner from './LoadingSpinner';
import LowStockAlertModal from '../inventory/LowStockAlertModal';
import { ClockIcon } from '@heroicons/react/24/outline';

interface AuthenticatedLayoutProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_EDGE_ZONE = 50;

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ userProfile, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useGuidedTour({ userProfile });

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const storedSidebarState = sessionStorage.getItem('sidebarOpen');
    const onMainPage = location.pathname === '/home' || location.pathname === '/';

    if (storedSidebarState !== null) {
      return storedSidebarState === 'true';
    }
    return !onMainPage && window.innerWidth >= 1024;
  });

  const [hasInteracted, setHasInteracted] = useState(() => {
    return !(location.pathname === '/home' || location.pathname === '/');
  });

  const [activeUITab, setActiveUITab] = useState('solicitudes');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<Inventario[]>([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  // Estado para controlar que la verificación de stock solo ocurra una vez por sesión activa (login)
  const [hasCheckedLowStock, setHasCheckedLowStock] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const isOnMainPage = location.pathname === '/home' || location.pathname === '/';
  const actualNavbarVisible = true;
  const actualSidebarVisible = isSidebarOpen;

  // Sincronizar pestaña activa si se pasa en el estado de navegación
  useEffect(() => {
    if (location.state?.tab) {
      setActiveUITab(location.state.tab);
    }
  }, [location.state]);

  useEffect(() => {
    // Comprobar bajo stock al iniciar la sesión (cuando se carga el perfil)
    // Usamos hasCheckedLowStock en lugar de sessionStorage para que se reinicie en cada login
    if (userProfile?.rol === 'admin' && !hasCheckedLowStock) {
      const checkLowStock = async () => {
        try {
          const { data, error } = await supabase
            .from('inventario')
            .select('*, producto:producto_id(descripcion, stock_minimo, unidad_medida)')
            .not('existencias', 'is', null);

          if (error) throw error;

          // Filtrar items que están por debajo del stock mínimo definido en el catálogo
          const filteredLowStock = (data as any[] || []).filter(item =>
            item.producto?.stock_minimo !== null &&
            item.existencias !== null &&
            item.existencias < item.producto.stock_minimo
          );

          if (filteredLowStock.length > 0) {
            setLowStockItems(filteredLowStock as Inventario[]);
            setShowLowStockModal(true);
          }

          // Marcamos como verificado en este montaje del Layout. 
          // Al cerrar sesión, este estado desaparece. Al loguear de nuevo, vuelve a ser false.
          setHasCheckedLowStock(true);
        } catch (err) {
          console.error("Error comprobando bajo stock:", err);
        }
      };
      checkLowStock();
    }
  }, [userProfile, hasCheckedLowStock]);

  useEffect(() => {
    if (!isOnMainPage && !hasInteracted) {
      setHasInteracted(true);
      if (sessionStorage.getItem('sidebarOpen') === null) {
        const shouldBeOpenByDefault = window.innerWidth >= 1024;
        setIsSidebarOpen(shouldBeOpenByDefault);
        sessionStorage.setItem('sidebarOpen', String(shouldBeOpenByDefault));
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
          console.error("Error al obtener el conteo de solicitudes pendientes del usuario:", error);
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
    sessionStorage.setItem('sidebarOpen', String(newIsOpen));
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [isSidebarOpen, hasInteracted]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0].clientX < SWIPE_EDGE_ZONE && !isSidebarOpen) {
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
        sessionStorage.setItem('sidebarOpen', 'true');
        if (!hasInteracted) setHasInteracted(true);
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
      if (location.pathname !== (sessionStorage.getItem('lastPathForSidebarToggle') || '')) {
        setIsSidebarOpen(false);
        sessionStorage.setItem('sidebarOpen', 'false');
      }
    }
    sessionStorage.setItem('lastPathForSidebarToggle', location.pathname);
  }, [location.pathname, isSidebarOpen]);

  const { showWarningModal, timeLeft, setShowWarningModal, resetTimers } = useInactivityTimer({
    onLogout: onLogout,
    isUserActive: !!userProfile,
  });

  const handleContinueSession = () => {
    resetTimers();
    setShowWarningModal(false);
  };

  if (!userProfile) {
    return <LoadingSpinner message="Sesión terminada o inválida, redirigiendo..." />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-500">
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
        className={`flex flex-col flex-1 w-full overflow-y-auto transition-all duration-300 ease-in-out ${actualSidebarVisible ? 'lg:ml-64' : 'ml-0'
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
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full fade-in-content">
            <Outlet context={{ userProfile, activeUITab, setActiveUITab, setHasInteracted }} />
          </div>
        </main>
      </div>

      <LowStockAlertModal
        show={showLowStockModal}
        onClose={() => setShowLowStockModal(false)}
        items={lowStockItems}
        // FIX: Access rol from userProfile as userRole variable is not defined in this scope.
        userRole={userProfile.rol}
      />

      {showWarningModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-pop-in">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <ClockIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-display font-black text-slate-900 dark:text-white text-center">Sesión por expirar</h3>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center leading-relaxed">
              Por motivos de seguridad, tu sesión se cerrará en <span className="font-bold text-primary-600 dark:text-primary-400">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span> por inactividad.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handleContinueSession}
                className="w-full px-6 py-4 text-sm font-black uppercase tracking-widest text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/25 transition-all duration-300 active:scale-95"
              >
                Mantener sesión
              </button>
              <button
                onClick={onLogout}
                className="w-full px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all duration-300"
              >
                Cerrar sesión ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};