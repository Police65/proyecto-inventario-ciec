// hooks/useGuidedTour.ts
import { useEffect } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';

declare const Shepherd: any; // Declarar Shepherd para que TypeScript no se queje

interface UseGuidedTourProps {
  userProfile: UserProfile;
}

export const useGuidedTour = ({ userProfile }: UseGuidedTourProps) => {
  useEffect(() => {
    if (!userProfile?.id) return;

    // Se comprueba el perfil del usuario desde la BD en lugar de localStorage
    if (userProfile.has_completed_tour) {
      return;
    }
    
    // Función para marcar el tour como completado en la base de datos
    const markTourAsCompletedInDB = async () => {
      if (!userProfile?.id) return;
      try {
        const { error } = await (supabase
          // FIX: Cast from() to any to resolve 'never' type inference error on the update method.
          .from('user_profile') as any)
          .update({ has_completed_tour: true })
          .eq('id', userProfile.id);
        if (error) {
          console.error("Error al actualizar el estado del tour en la base de datos:", error);
        }
      } catch (e) {
        console.error("Excepción al intentar actualizar el estado del tour:", e);
      }
    };

    // Esperar un poco para que la UI se renderice completamente
    const timeoutId = setTimeout(() => {
        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shadow-xl bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-600',
                scrollTo: true,
                cancelIcon: {
                    enabled: true
                },
            },
        });
        
        // Al completar o cancelar, se llama a la función de la BD
        tour.on('complete', markTourAsCompletedInDB);
        tour.on('cancel', markTourAsCompletedInDB);

        const commonSteps = [
            {
                id: 'welcome',
                title: `¡Bienvenido a RequiSoftware, ${userProfile.empleado?.nombre || 'Usuario'}!`,
                text: 'Este es un breve tour para mostrarte las funciones principales. Puedes usar las flechas para navegar y cerrar el tour en cualquier momento.',
                buttons: [
                    {
                        text: 'Siguiente',
                        action: tour.next,
                        classes: 'px-4 py-2 bg-primary-600 text-white rounded-md',
                    },
                ],
            },
            {
                id: 'sidebar-toggle',
                title: 'Navegación Principal',
                text: 'Usa este botón para mostrar u ocultar el menú lateral, donde encontrarás todas las secciones de la aplicación.',
                attachTo: {
                    element: '[data-tour-id="navbar-sidebar-toggle"]',
                    on: 'bottom',
                },
                buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
            },
        ];

        if (userProfile.rol === 'admin') {
            tour.addSteps([
                ...commonSteps,
                {
                    id: 'admin-dashboard',
                    title: 'Dashboard Principal',
                    text: 'Aquí en el dashboard administrativo, tienes una vista rápida de las estadísticas clave del sistema, como las solicitudes pendientes.',
                    attachTo: { element: '[data-tour-id="admin-stat-card-pending"]', on: 'bottom' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'admin-inventory',
                    title: 'Gestión de Inventario',
                    text: 'Desde esta sección en el menú lateral, puedes administrar todo el catálogo de productos y la lista de proveedores.',
                    attachTo: { element: '[data-tour-id="sidebar-inventory-management"]', on: 'right' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'admin-users',
                    title: 'Gestión de Usuarios',
                    text: 'Aquí puedes añadir, editar y gestionar los empleados y sus perfiles de acceso al sistema.',
                    attachTo: { element: '[data-tour-id="sidebar-user-management"]', on: 'right' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'finish',
                    title: '¡Todo Listo!',
                    text: 'Has completado el tour. Ya puedes empezar a explorar y gestionar la aplicación.',
                    buttons: [ { text: 'Finalizar', action: tour.complete, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
            ]);
        } else { // Rol 'usuario'
             tour.addSteps([
                ...commonSteps,
                 {
                    id: 'user-new-request',
                    title: 'Crear Solicitudes',
                    text: 'Este es el botón más importante para ti. Haz clic aquí para crear una nueva solicitud de compra.',
                    attachTo: { element: '[data-tour-id="sidebar-new-request"]', on: 'right' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'user-pending-requests',
                    title: 'Seguimiento de Solicitudes',
                    text: 'En esta sección del menú, puedes ver todas tus solicitudes que están pendientes de aprobación por un administrador.',
                    attachTo: { element: '[data-tour-id="sidebar-pending-requests"]', on: 'right' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'user-history',
                    title: 'Historial',
                    text: 'Aquí puedes consultar el historial de todas tus solicitudes pasadas, tanto las aprobadas como las rechazadas.',
                    attachTo: { element: '[data-tour-id="sidebar-history-requests"]', on: 'right' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Siguiente', action: tour.next, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
                {
                    id: 'user-menu',
                    title: 'Menú de Usuario',
                    text: 'Finalmente, desde este ícono puedes ver tu rol y cerrar tu sesión de forma segura.',
                    attachTo: { element: '[data-tour-id="navbar-user-menu"]', on: 'bottom' },
                    buttons: [ { text: 'Anterior', action: tour.back, classes: 'text-sm' }, { text: 'Finalizar', action: tour.complete, classes: 'px-4 py-2 bg-primary-600 text-white rounded-md' } ],
                },
             ]);
        }

        tour.start();

    }, 2000); // 2 segundos de retraso para asegurar que la UI esté lista

    return () => clearTimeout(timeoutId);

  }, [userProfile]);
};
