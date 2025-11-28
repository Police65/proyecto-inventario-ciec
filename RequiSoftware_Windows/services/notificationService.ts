
// services/notificationService.ts
import { supabase } from '../supabaseClient';
import { NotificacionInsert, UserProfileRol } from '../types';

/**
 * Obtiene todos los IDs de usuarios administradores (UUIDs de auth.users).
 * @returns {Promise<string[]>} Una promesa que resuelve a un array de IDs de administradores.
 */
export const fetchAdminUserIds = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('id') // Este 'id' es el UUID de auth.users desde la tabla user_profile
      .eq('rol', 'admin' as UserProfileRol);

    if (error) {
      console.error('Error obteniendo IDs de administradores:', error.message, error.details, error.code);
      return [];
    }
    return (data || []).map(profile => profile.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Excepción en fetchAdminUserIds:', errorMessage, err);
    return [];
  }
};

/**
 * Obtiene el ID de autenticación (UUID) para un empleado_id dado.
 * @param {number} empleadoId - El ID del empleado.
 * @returns {Promise<string | null>} Una promesa que resuelve al ID de autenticación o null si no se encuentra.
 */
export const fetchUserAuthIdByEmpleadoId = async (empleadoId: number): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('id') // Este 'id' es el UUID de auth.users
      .eq('empleado_id', empleadoId)
      .returns<{id: string}>()
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 significa que no hay filas, lo cual es un caso válido (null)
      console.error(`Error obteniendo auth ID para empleado ID ${empleadoId}:`, error.message, error.details, error.code);
      return null;
    }
    return (data as { id: string } | null)?.id || null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Excepción en fetchUserAuthIdByEmpleadoId para empleado ID ${empleadoId}:`, errorMessage, err);
    return null;
  }
};

/**
 * Crea una o más notificaciones.
 * @param {NotificacionInsert[]} notificationsPayload - Array de objetos de notificación para insertar.
 * @returns {Promise<{ success: boolean; error?: any }>} Objeto indicando éxito o fallo.
 */
export const createNotifications = async (
  notificationsPayload: NotificacionInsert[]
): Promise<{ success: boolean; error?: any }> => {
  if (!notificationsPayload || notificationsPayload.length === 0) {
    console.warn("[NotificationService] No se proporcionaron payloads de notificación.");
    return { success: true };
  }

  const enrichedPayloads = notificationsPayload.map(n => ({
    ...n,
    // created_at es manejado por el default de la BD
    read: false, // Las notificaciones son no leídas por defecto
  }));

  try {
    const { error } = await supabase.from('notificaciones').insert(enrichedPayloads);

    if (error) {
      console.error('Error creando notificaciones en Supabase:', error.message, error.details, error.code, error);
      return { success: false, error };
    }
    console.log(`[NotificationService] Creadas exitosamente ${enrichedPayloads.length} notificación(es).`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Excepción en createNotifications:', errorMessage, err);
    return { success: false, error: err };
  }
};
