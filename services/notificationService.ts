// services/notificationService.ts
import { supabase } from '../supabaseClient';
import { NotificacionInsert, UserProfileRol } from '../types';

/**
 * Fetches all admin user IDs (auth.users UUIDs).
 * @returns {Promise<string[]>} A promise that resolves to an array of admin user IDs.
 */
export const fetchAdminUserIds = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('id') // This 'id' is the auth.users UUID from user_profile table
      .eq('rol', 'admin' as UserProfileRol);

    if (error) {
      console.error('Error fetching admin user IDs:', error.message, error.details, error.code);
      return [];
    }
    return (data || []).map(profile => profile.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Exception in fetchAdminUserIds:', errorMessage, err);
    return [];
  }
};

/**
 * Fetches the auth user ID (UUID) for a given empleado_id.
 * @param {number} empleadoId - The ID of the employee.
 * @returns {Promise<string | null>} A promise that resolves to the user's auth ID or null if not found/error.
 */
export const fetchUserAuthIdByEmpleadoId = async (empleadoId: number): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('id') // This 'id' is the auth.users UUID
      .eq('empleado_id', empleadoId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is a valid case (null)
      console.error(`Error fetching user auth ID for empleado ID ${empleadoId}:`, error.message, error.details, error.code);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Exception in fetchUserAuthIdByEmpleadoId for empleado ID ${empleadoId}:`, errorMessage, err);
    return null;
  }
};

/**
 * Creates one or more notifications.
 * @param {NotificacionInsert[]} notificationsPayload - An array of notification objects to insert.
 * @returns {Promise<{ success: boolean; error?: any }>} An object indicating success or failure.
 */
export const createNotifications = async (
  notificationsPayload: NotificacionInsert[]
): Promise<{ success: boolean; error?: any }> => {
  if (!notificationsPayload || notificationsPayload.length === 0) {
    console.warn("[NotificationService] No notification payloads provided to createNotifications.");
    return { success: true }; // No-op is a success
  }

  // Enrich with default values for fields managed by DB or that should always be set
  const enrichedPayloads = notificationsPayload.map(n => ({
    ...n,
    // created_at is handled by DB default trigger
    read: false, // Notifications are unread by default
    // 'user_id', 'title', 'description', 'type', 'related_id' are expected in NotificacionInsert
  }));

  try {
    const { error } = await supabase.from('notificaciones').insert(enrichedPayloads);

    if (error) {
      console.error('Error creating notifications in Supabase:', error.message, error.details, error.code, error);
      return { success: false, error };
    }
    console.log(`[NotificationService] Successfully created ${enrichedPayloads.length} notification(s).`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Exception in createNotifications:', errorMessage, err);
    return { success: false, error: err };
  }
};
