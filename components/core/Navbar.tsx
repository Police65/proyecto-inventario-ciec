import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { UserProfile, Notificacion } from '../../types';
import ThemeToggle from './ThemeToggle';
import { Bars3Icon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface CustomNavbarProps {
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  setHasInteracted: (interacted: boolean) => void;
}

const CustomNavbar = ({ userProfile, onToggleSidebar, onLogout, setHasInteracted }: CustomNavbarProps): JSX.Element => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const notificationRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const retryTimerRef = useRef<number | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!userProfile?.id) {
      setNotifications([]);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRetryAttempt(0);
      return; 
    }

    const fetchUserNotifications = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('user_id', userProfile.id!)
          .eq('read', false)
          .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener notificaciones:', error.message, error.details, error.code, error);
            return; 
        }
        setNotifications(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error al procesar notificaciones:', errorMessage, err);
      }
    };

    fetchUserNotifications();

    const channelName = `user-notifications-${userProfile.id}`;
    const subscriptionChannel = supabase.channel(channelName);

    const scheduleRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (retryAttempt < 3) { // MAX_REINTENTOS
        const delay = 5000 * Math.pow(2, retryAttempt); // RETRY_DELAY_MS_BASE
        retryTimerRef.current = window.setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
        }, delay);
      } else {
        console.error(`Máximo de reintentos (3) alcanzado para el canal de notificaciones del usuario ${userProfile.id}.`);
      }
    };

    subscriptionChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'read' in payload.new && !payload.new.read) {
            const newNotification = payload.new as Notificacion;
            if (newNotification.id !== undefined) {
                setNotifications((prev) => [newNotification, ...prev.filter(n => n.id !== newNotification.id)].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
            }
          }
        }
      )
      .subscribe((status, err) => {
        const baseMessage = `Canal de notificaciones para usuario ${userProfile.id} en canal ${channelName}`;
        const errDetails = err ? `Error: ${err.message || String(err)}` : 'Sin información adicional de error.';

        if (status === 'SUBSCRIBED') {
          if (retryAttempt > 0) setRetryAttempt(0);
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`${baseMessage} ${status === 'CLOSED' ? 'fue CERRADO' : `falló: ${status}`}. Intentando re-suscribir. ${errDetails}`);
          scheduleRetry();
        } else {
          console[err ? 'error' : 'info'](`${baseMessage} estado: ${status}. ${err ? errDetails : '(Sin detalles de error específicos)'}`);
        }
      });

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel)
          .catch(removeError => console.error(`Error al eliminar canal ${channelName}:`, removeError.message || String(removeError)));
      }
    };
  }, [userProfile?.id, retryAttempt]); 

  const handleMarkNotificationAsRead = async (notificationId: number): Promise<void> => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) {
        console.error('Error al marcar notificación como leída:', error.message, error.details, error.code, error);
        return; 
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error al marcar notificación como leída:', errorMessage, err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleToggleSidebarAndInteract = () => {
    setHasInteracted(true); 
    onToggleSidebar();
  };


  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md fixed w-full z-50 top-0">
      <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={handleToggleSidebarAndInteract}
            className="p-1 sm:p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none"
            aria-label="Alternar barra lateral"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <Link to="/home" onClick={() => setHasInteracted(true)} className="flex-shrink-0 flex items-center ml-2 lg:ml-0">
            <img className="h-8 w-auto" src="/assets/logo_svg.svg" alt="Logo RequiSoftware" />
            <span className="hidden xl:inline ml-1 font-semibold text-xl text-gray-800 dark:text-white">RequiSoftware</span>
          </Link>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <ThemeToggle />

          <div className="relative">
            <button
              ref={notificationRef}
              onClick={() => { setShowNotifications(!showNotifications); setHasInteracted(true); }}
              className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none relative"
              aria-haspopup="true"
              aria-expanded={showNotifications}
              aria-label={`Notificaciones (${notifications.length} no leídas)`}
            >
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-800 bg-red-500" aria-hidden="true" />
              )}
                <span className="sr-only">{notifications.length} notificaciones no leídas</span>
            </button>
            {showNotifications && (
              <div className="origin-top-right absolute right-0 mt-2 w-80 md:w-96 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="notifications-button">
                  <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 font-semibold border-b dark:border-gray-600">
                    Notificaciones ({notifications.length})
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div key={notification.id} className="px-4 py-3 border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600" role="menuitem">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{notification.description}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                          <button 
                            onClick={() => notification.id && handleMarkNotificationAsRead(notification.id)}
                            className="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 mt-1"
                          >
                            Marcar como leída
                          </button>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No hay notificaciones nuevas.</p>
                  )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              ref={profileRef}
              onClick={() => { setShowProfileMenu(!showProfileMenu); setHasInteracted(true);}}
              className="p-1 flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-primary-500"
              aria-haspopup="true"
              aria-expanded={showProfileMenu}
              aria-label="Menú de usuario"
            >
              <span className="sr-only">Abrir menú de usuario</span>
              {userProfile?.empleado?.nombre ? (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold" aria-hidden="true">
                      {userProfile.empleado.nombre.charAt(0).toUpperCase()}
                      {userProfile.empleado.apellido ? userProfile.empleado.apellido.charAt(0).toUpperCase() : ''}
                  </div>
              ) : (
                  <UserCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              )}
            </button>
            {showProfileMenu && (
              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                <div className="px-4 py-3 border-b dark:border-gray-600">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    Hola, {userProfile?.empleado?.nombre || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={`Rol: ${userProfile?.rol || 'N/D'}`}>
                    Rol: {userProfile?.rol || 'N/D'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-700 dark:hover:text-red-300"
                  role="menuitem"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default CustomNavbar;