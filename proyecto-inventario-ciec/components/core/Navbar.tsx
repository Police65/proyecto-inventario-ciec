
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { UserProfile, Notificacion, Database } from '../../types';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'; // Importar el nuevo hook
import { Bars3Icon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { LIGHT_MODE_LOGO_URL, DARK_MODE_LOGO_URL } from '../../assets/paths';
import ThemeToggle from './ThemeToggle';


interface CustomNavbarProps {
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  setHasInteracted: (interacted: boolean) => void; // Para registrar la primera interacción del usuario
}

// FIX: Import React to resolve React.ReactElement namespace error.
const CustomNavbar = ({ userProfile, onToggleSidebar, onLogout, setHasInteracted }: CustomNavbarProps): React.ReactElement => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notificationRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Obtener notificaciones iniciales
  useEffect(() => {
    if (!userProfile?.id) {
      setNotifications([]);
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
          console.error('Error al obtener notificaciones iniciales:', error.message, error.details, error.code, error);
          return;
        }
        setNotifications(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Excepción al procesar notificaciones iniciales:', errorMessage, err);
      }
    };

    fetchUserNotifications();
  }, [userProfile?.id]);

  // Suscripción en tiempo real usando el nuevo hook
  const { isSubscribed, error: subscriptionError } = useRealtimeSubscription<Notificacion>({
    channelName: `user-notifications-${userProfile?.id || 'guest'}`, // Asegurar que channelName siempre sea válido
    tableName: 'notificaciones',
    filter: userProfile?.id ? `user_id=eq.${userProfile.id}` : undefined, // Filtrar solo si userProfile.id existe
    event: 'INSERT',
    onNewPayload: (payload) => {
      if (payload.new && typeof payload.new === 'object' && 'read' in payload.new && !(payload.new as Notificacion).read) {
        const newNotification = payload.new as Notificacion;
        if (newNotification.id !== undefined) {
          setNotifications((prev) =>
            [newNotification, ...prev.filter(n => n.id !== newNotification.id)]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          );
        }
      }
    },
    enabled: !!userProfile?.id, // Habilitar solo si userProfile.id existe
  });

  const hasSubscriptionError = !!subscriptionError;

  // Registrar estado de suscripción (opcional, para depuración)
  useEffect(() => {
    if (userProfile?.id) {
      if (hasSubscriptionError) {
        console.error(`[Navbar] Error de suscripción a notificaciones para ${userProfile.id}: ${subscriptionError}`);
      } else if (isSubscribed) {
        console.log(`[Navbar] Suscrito exitosamente a notificaciones del usuario ${userProfile.id}.`);
      }
    }
  }, [isSubscribed, subscriptionError, userProfile?.id, hasSubscriptionError]);


  const handleMarkNotificationAsRead = async (notificationId: number): Promise<void> => {
    try {
      // FIX: Cast from() to any to resolve 'never' type error in Supabase update
      const { error } = await (supabase
        .from('notificaciones') as any)
        .update({ read: true })
        .eq('id', notificationId);
      if (error) {
        console.error('Error al marcar notificación como leída:', error.message, error.details, error.code, error);
        return;
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Excepción al marcar notificación como leída:', errorMessage, err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (
        profileRef.current && !profileRef.current.contains(event.target as Node) &&
        profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)
      ) {
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
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 fixed w-full z-50 top-0 transition-all duration-300">
      <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={handleToggleSidebarAndInteract}
            className="p-1 sm:p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none transition-transform duration-150 ease-in-out active:scale-95"
            aria-label="Alternar barra lateral"
            data-tour-id="navbar-sidebar-toggle"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <Link to="/home" onClick={() => setHasInteracted(true)} className="flex-shrink-0 flex items-center ml-2 lg:ml-0 group">
            {/* Logo para modo claro (se oculta en modo oscuro) */}
            <img className="h-9 w-auto block dark:hidden group-hover:scale-110 transition-transform duration-300" src={LIGHT_MODE_LOGO_URL} alt="Logo RequiSoftware" />
            {/* Logo para modo oscuro (se oculta en modo claro) */}
            <img className="h-9 w-auto hidden dark:block group-hover:scale-110 transition-transform duration-300" src={DARK_MODE_LOGO_URL} alt="Logo RequiSoftware" />
            <span className="hidden xl:inline ml-2 font-display font-black text-2xl tracking-tighter text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300">RequiSoftware</span>
          </Link>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <ThemeToggle />
          <div className="relative">
            <button
              ref={notificationRef}
              onClick={() => { setShowNotifications(!showNotifications); setHasInteracted(true); }}
              className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none relative transition-transform duration-150 ease-in-out active:scale-95"
              aria-haspopup="true"
              aria-expanded={showNotifications}
              aria-label={hasSubscriptionError ? "Error en notificaciones en tiempo real" : `Notificaciones (${notifications.length} no leídas)`}
              title={hasSubscriptionError ? "Error de conexión en tiempo real. Verifique la configuración de replicación de Supabase para la tabla 'notificaciones'." : "Notificaciones"}
            >
              <BellIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${hasSubscriptionError ? 'text-amber-500' : ''}`} />
              {notifications.length > 0 && !hasSubscriptionError && (
                <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 bg-red-500 animate-pulse" aria-hidden="true" />
              )}
              {hasSubscriptionError && (
                <ExclamationTriangleIcon className="absolute top-0 right-0 h-3.5 w-3.5 text-red-500 bg-white dark:bg-slate-900 rounded-full" />
              )}
              <span className="sr-only">{hasSubscriptionError ? "Error en notificaciones" : `${notifications.length} notificaciones no leídas`}</span>
            </button>
            {showNotifications && (
              <div className="origin-top-right absolute right-0 mt-3 w-80 md:w-96 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-pop-in">
                <div role="menu" aria-orientation="vertical" aria-labelledby="notifications-button">
                  <div className="px-6 py-4 text-sm text-slate-900 dark:text-white font-bold border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    {hasSubscriptionError ? "Error de Conexión" : `Notificaciones (${notifications.length})`}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {hasSubscriptionError ? (
                      <div className="p-6 text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20">
                        <p className="font-bold">No se pueden recibir notificaciones.</p>
                        <p className="mt-2 text-xs opacity-80 leading-relaxed">
                          Error de conexión con el servicio de notificaciones. Verifique la replicación de la tabla.
                        </p>
                      </div>
                    ) : notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div key={notification.id} className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" role="menuitem">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{notification.title}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{notification.description}</p>
                          <div className="flex justify-between items-center mt-3">
                            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              {new Date(notification.created_at).toLocaleString('es-VE')}
                            </p>
                            <button
                              onClick={() => notification.id && handleMarkNotificationAsRead(notification.id)}
                              className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-all"
                            >
                              Marcar como leída
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <BellIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-500">No hay notificaciones nuevas.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              ref={profileRef}
              onClick={() => { setShowProfileMenu(!showProfileMenu); setHasInteracted(true); }}
              className="p-1 flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-primary-500 transition-transform duration-150 ease-in-out active:scale-95"
              aria-haspopup="true"
              aria-expanded={showProfileMenu}
              aria-label="Menú de usuario"
              data-tour-id="navbar-user-menu"
            >
              <span className="sr-only">Abrir menú de usuario</span>
              {userProfile?.empleado?.nombre ? (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-xs" aria-hidden="true">
                  {userProfile.empleado.nombre.charAt(0).toUpperCase()}
                  {userProfile.empleado.apellido ? userProfile.empleado.apellido.charAt(0).toUpperCase() : ''}
                </div>
              ) : (
                <UserCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              )}
            </button>
            {showProfileMenu && (
              <div ref={profileMenuRef} className="origin-top-right absolute right-0 mt-3 w-64 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-pop-in" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                <div className="px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {userProfile?.empleado?.nombre || 'Usuario'}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    {userProfile?.rol?.toUpperCase() || 'N/D'}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-all"
                    role="menuitem"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" aria-hidden="true" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default CustomNavbar;
