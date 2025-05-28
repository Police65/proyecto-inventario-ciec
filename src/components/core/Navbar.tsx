
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; // Path relative to src/components/core
import { UserProfile, Notificacion } from '../../types'; // Path relative to src/components/core
import ThemeToggle from './ThemeToggle';
import { Bars3Icon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface CustomNavbarProps {
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const MAX_RETRIES = 3; 
const RETRY_DELAY_MS = 5000;

function CustomNavbar({ userProfile, onToggleSidebar, onLogout }: CustomNavbarProps): JSX.Element {
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
            console.error('Error fetching notifications:', error.message, error.details, error.code, error);
            return; 
        }
        setNotifications(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Failed to process notifications:', errorMessage, err);
      }
    };

    fetchUserNotifications();

    const channelName = \`user-notifications-\${userProfile.id}\`;
    const subscriptionChannel = supabase.channel(channelName);

    const scheduleRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryAttempt);
        retryTimerRef.current = window.setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
        }, delay);
      } else {
        console.error(\`Max retries (\${MAX_RETRIES}) reached for notifications channel for user \${userProfile.id}.\`);
      }
    };

    subscriptionChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: \`user_id=eq.\${userProfile.id}\`,
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
        const baseMessage = \`Notification channel for user \${userProfile.id} on channel \${channelName}\`;
        const errDetails = err ? \`Error: \${err.message || String(err)}\` : 'No additional error info.';

        if (status === 'SUBSCRIBED') {
          if (retryAttempt > 0) {
            setRetryAttempt(0);
          }
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        } else if (status === 'CLOSED') {
          console.warn(\`\${baseMessage} was CLOSED. Attempting to re-subscribe. \${errDetails}\`);
          scheduleRetry();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(\`\${baseMessage} failure: \${status}. Attempting to re-subscribe. \${errDetails}\`);
          scheduleRetry();
        } else {
          const logLevel = err ? 'error' : 'info';
          console[logLevel](\`\${baseMessage} status: \${status}. \${err ? errDetails : '(No specific error details)'}\`);
        }
      });

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel)
          .catch(removeError => {
            console.error(\`Error removing Supabase channel \${channelName} for user \${userProfile.id}:\`, removeError.message || String(removeError));
        });
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
        console.error('Error marking notification as read:', error.message, error.details, error.code, error);
        return; 
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to mark notification as read:', errorMessage, err);
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

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md fixed w-full z-30 top-0">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none lg:hidden"
              aria-label="Toggle sidebar"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <Link to="/home" className="flex-shrink-0 flex items-center ml-2 lg:ml-0">
              <img className="h-8 w-auto" src="https://picsum.photos/seed/logo/40/40" alt="Logo" />
              <span className="ml-2 font-semibold text-xl text-gray-800 dark:text-white">RequiSoftware</span>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />

            <div className="relative">
              <button
                ref={notificationRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none relative"
                aria-haspopup="true"
                aria-expanded={showNotifications}
                aria-label={\`Notificaciones (\${notifications.length} no leídas)\`}
              >
                <BellIcon className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-800 bg-red-500" aria-hidden="true" />
                )}
                 <span className="sr-only">\${notifications.length} notificaciones no leídas</span>
              </button>
              {showNotifications && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 md:w-96 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="notifications-button">
                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 font-semibold border-b dark:border-gray-600">
                      Notificaciones (\${notifications.length})
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
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="p-1 flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-primary-500"
                aria-haspopup="true"
                aria-expanded={showProfileMenu}
                aria-label="Menú de usuario"
              >
                <span className="sr-only">Open user menu</span>
                {userProfile?.empleado?.nombre ? (
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold" aria-hidden="true">
                        {userProfile.empleado.nombre.charAt(0).toUpperCase()}
                        {userProfile.empleado.apellido ? userProfile.empleado.apellido.charAt(0).toUpperCase() : ''}
                    </div>
                ) : (
                    <UserCircleIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                )}
              </button>
              {showProfileMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                  <div className="px-4 py-3 border-b dark:border-gray-600">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      Hola, {userProfile?.empleado?.nombre || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={\`Rol: \${userProfile?.rol || 'N/A'}\`}>
                      Rol: {userProfile?.rol || 'N/A'}
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
      </div>
    </nav>
  );
}

export default CustomNavbar;
