
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { UserProfile, Notificacion } from '../../types';
import ThemeToggle from './ThemeToggle';
import { Bars3Icon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface CustomNavbarProps {
  userProfile: UserProfile | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  setHasInteracted: (interacted: boolean) => void; // Para registrar la primera interacción del usuario
}

const CustomNavbar = ({ userProfile, onToggleSidebar, onLogout, setHasInteracted }: CustomNavbarProps): JSX.Element => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false); // Controla visibilidad del dropdown de notificaciones
  const [notifications, setNotifications] = useState<Notificacion[]>([]); // Lista de notificaciones no leídas
  const [showProfileMenu, setShowProfileMenu] = useState(false); // Controla visibilidad del dropdown de perfil
  
  // Refs para los botones de notificación y perfil, para detectar clics fuera de ellos
  const notificationRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  
  const retryTimerRef = useRef<number | null>(null); // ID del temporizador para reintentar conexión al canal de notificaciones
  const [retryAttempt, setRetryAttempt] = useState(0); // Contador de intentos de reconexión

  // Efecto para obtener notificaciones y suscribirse al canal de Realtime
  useEffect(() => {
    // Si no hay ID de perfil de usuario (ej. no logueado), limpiar notificaciones y temporizadores.
    if (!userProfile?.id) {
      setNotifications([]);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRetryAttempt(0); // Resetear contador de reintentos
      return; 
    }

    // Función para obtener las notificaciones no leídas del usuario al cargar
    const fetchUserNotifications = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('user_id', userProfile.id!) // Asegurar que userProfile.id existe
          .eq('read', false) // Solo no leídas
          .order('created_at', { ascending: false }); // Más recientes primero

        if (error) {
            console.error('Error al obtener notificaciones:', error.message, error.details, error.code, error);
            return; 
        }
        setNotifications(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Excepción al procesar notificaciones:', errorMessage, err);
      }
    };

    fetchUserNotifications(); // Cargar notificaciones iniciales

    // Configuración del canal de Supabase Realtime para notificaciones nuevas
    const channelName = `user-notifications-${userProfile.id}`; // Canal específico para el usuario
    const subscriptionChannel = supabase.channel(channelName);

    // Función para programar un reintento de conexión al canal con backoff exponencial
    const scheduleRetry = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current); // Limpiar timer anterior si existe
      
      if (retryAttempt < 3) { // Máximo de 3 reintentos
        const delay = 5000 * Math.pow(2, retryAttempt); // Backoff: 5s, 10s, 20s
        console.log(`[Navbar] Programando reintento de conexión #${retryAttempt + 1} para el canal ${channelName} en ${delay / 1000} segundos.`);
        retryTimerRef.current = window.setTimeout(() => {
          setRetryAttempt(prev => prev + 1); // Incrementar contador, lo que re-activará este useEffect para intentar la suscripción
        }, delay);
      } else {
        console.error(`Máximo de reintentos (3) alcanzado para el canal de notificaciones del usuario ${userProfile.id}. No se intentará más.`);
      }
    };

    subscriptionChannel
      .on(
        'postgres_changes', // Escuchar cambios en la BD
        {
          event: 'INSERT', // Específicamente inserciones
          schema: 'public',
          table: 'notificaciones', // En la tabla 'notificaciones'
          filter: `user_id=eq.${userProfile.id}`, // Solo para este usuario
        },
        (payload) => { // Callback cuando llega una nueva notificación
          // Asegurarse que la nueva notificación no esté leída y tenga ID.
          if (payload.new && typeof payload.new === 'object' && 'read' in payload.new && !payload.new.read) {
            const newNotification = payload.new as Notificacion;
            if (newNotification.id !== undefined) { // Verificar que el ID exista
                // Añadir la nueva notificación al principio y ordenar por fecha (para mantener las más nuevas arriba).
                setNotifications((prev) => 
                  [newNotification, ...prev.filter(n => n.id !== newNotification.id)] // Evitar duplicados si llega muy rápido
                  .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                );
            }
          }
        }
      )
      .subscribe((status, err) => { // Callback para el estado de la suscripción al canal
        const baseMessage = `[Navbar] Canal ${channelName} (usuario ${userProfile.id})`;
        
        let errDetails = 'Sin información adicional de error.';
        if (err) {
          const codePart = (err && 'code' in err && (err as any).code) ? `(Código: ${(err as any).code})` : '';
          errDetails = `Error: ${err.message || String(err)} ${codePart}`;
        }


        if (status === 'SUBSCRIBED') {
          console.log(`${baseMessage} suscrito exitosamente.`);
          if (retryAttempt > 0) setRetryAttempt(0); // Resetear contador de reintentos si la conexión es exitosa
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; } // Limpiar timer de reintento
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Si el canal se cierra o falla, programar un reintento.
          console.warn(`${baseMessage} ${status === 'CLOSED' ? 'fue CERRADO' : `falló: ${status}`}. ${errDetails}. Programando re-suscripción.`);
          scheduleRetry();
        } else {
          // Otros estados del canal (ej. 'CONNECTING')
          console[err ? 'error' : 'info'](`${baseMessage} estado: ${status}. ${err ? errDetails : '(Sin detalles de error específicos)'}`);
        }
      });

    return () => { // Limpieza al desmontar el componente o cuando userProfile.id cambie
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current); // Limpiar timer de reintento
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel) // Desuscribirse del canal
          .then(status => console.log(`[Navbar] Canal ${channelName} removido con estado: ${status}`))
          .catch(removeError => console.error(`Error al eliminar canal ${channelName}:`, removeError.message || String(removeError)));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, retryAttempt]); // Re-ejecutar si cambia el ID del usuario o el contador de reintento

  // Marcar una notificación como leída
  const handleMarkNotificationAsRead = async (notificationId: number): Promise<void> => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ read: true }) // Actualizar estado a leída
        .eq('id', notificationId);
      if (error) {
        console.error('Error al marcar notificación como leída:', error.message, error.details, error.code, error);
        return; 
      }
      // Remover la notificación de la lista local para actualizar la UI
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Excepción al marcar notificación como leída:', errorMessage, err);
    }
  };

  // Efecto para cerrar menús desplegables (notificaciones, perfil) si se hace clic fuera de ellos.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Si el clic fue fuera del botón de notificaciones Y su dropdown no lo contiene
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false); // Ocultar dropdown de notificaciones
      }
      // Similar para el menú de perfil
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false); // Ocultar dropdown de perfil
      }
    };
    document.addEventListener('mousedown', handleClickOutside); // Escuchar clics en todo el documento
    return () => document.removeEventListener('mousedown', handleClickOutside); // Limpiar listener
  }, []);
  
  // Manejador para el botón de la barra lateral, también registra la interacción del usuario.
  const handleToggleSidebarAndInteract = () => {
    setHasInteracted(true); // Indicar que el usuario ha interactuado con la UI principal
    onToggleSidebar(); // Abrir/cerrar la barra lateral
  };


  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md fixed w-full z-50 top-0"> {/* Navbar fija en la parte superior */}
      <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8"> {/* Contenedor principal del navbar */}
        {/* Sección Izquierda: Botón de Sidebar y Logo/Título */}
        <div className="flex items-center">
          <button
            onClick={handleToggleSidebarAndInteract} // Usar el manejador que registra interacción
            className="p-1 sm:p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none"
            aria-label="Alternar barra lateral"
          >
            <Bars3Icon className="w-6 h-6" /> {/* Ícono de hamburguesa */}
          </button>
          <Link to="/home" onClick={() => setHasInteracted(true)} className="flex-shrink-0 flex items-center ml-2 lg:ml-0">
            <img className="h-8 w-auto" src="/assets/logo_svg.svg" alt="Logo RequiSoftware" />
            <span className="hidden xl:inline ml-1 font-semibold text-xl text-gray-800 dark:text-white">RequiSoftware</span>
          </Link>
        </div>

        {/* Sección Derecha: Toggle de Tema, Notificaciones, Menú de Usuario */}
        <div className="flex items-center space-x-3 ml-auto"> {/* Alineado a la derecha */}
          <ThemeToggle /> {/* Componente para cambiar tema claro/oscuro */}

          {/* Botón y Dropdown de Notificaciones */}
          <div className="relative">
            <button
              ref={notificationRef} // Ref para detectar clics fuera
              onClick={() => { setShowNotifications(!showNotifications); setHasInteracted(true); }}
              className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none relative"
              aria-haspopup="true"
              aria-expanded={showNotifications}
              aria-label={`Notificaciones (${notifications.length} no leídas)`}
            >
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" /> {/* Ícono de campana */}
              {notifications.length > 0 && ( // Indicador de notificaciones no leídas
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-800 bg-red-500" aria-hidden="true" />
              )}
                <span className="sr-only">{notifications.length} notificaciones no leídas</span>
            </button>
            {showNotifications && ( // Dropdown de notificaciones
              <div className="origin-top-right absolute right-0 mt-2 w-80 md:w-96 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="notifications-button">
                  <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 font-semibold border-b dark:border-gray-600">
                    Notificaciones ({notifications.length})
                  </div>
                  <div className="max-h-80 overflow-y-auto"> {/* Para scroll si hay muchas notificaciones */}
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div key={notification.id} className="px-4 py-3 border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600" role="menuitem">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{notification.description}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString('es-VE')} {/* Formatear fecha */}
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

          {/* Botón y Dropdown de Perfil de Usuario */}
          <div className="relative">
            <button
              ref={profileRef} // Ref para detectar clics fuera
              onClick={() => { setShowProfileMenu(!showProfileMenu); setHasInteracted(true);}}
              className="p-1 flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-primary-500"
              aria-haspopup="true"
              aria-expanded={showProfileMenu}
              aria-label="Menú de usuario"
            >
              <span className="sr-only">Abrir menú de usuario</span>
              {userProfile?.empleado?.nombre ? ( // Mostrar iniciales si hay nombre de empleado
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-xs" aria-hidden="true">
                      {userProfile.empleado.nombre.charAt(0).toUpperCase()}
                      {userProfile.empleado.apellido ? userProfile.empleado.apellido.charAt(0).toUpperCase() : ''}
                  </div>
              ) : ( // Ícono genérico si no hay nombre
                  <UserCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              )}
            </button>
            {showProfileMenu && ( // Dropdown de perfil
              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                <div className="px-4 py-3 border-b dark:border-gray-600">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    Hola, {userProfile?.empleado?.nombre || 'Usuario'} {/* Saludo */}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={`Rol: ${userProfile?.rol || 'N/D'}`}>
                    Rol: {userProfile?.rol || 'N/D'} {/* Mostrar rol */}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onLogout(); // Ejecutar cierre de sesión
                    setShowProfileMenu(false); // Ocultar dropdown
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
