
// hooks/useRealtimeSubscription.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient, RealtimePostgresChangesFilter, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/supabase-js';

const MAX_RETRY_ATTEMPTS = 5; // Máximo de intentos antes de rendirse

interface UseRealtimeSubscriptionProps<
  T extends { [key: string]: any }
> {
  channelName: string; // Nombre de canal único, ej: `user-notifications-${userId}`
  tableName: string;
  schema?: string; // Por defecto 'public'
  filter?: string; // ej: `user_id=eq.${userId}` (filtro RLS)
  event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT; // El evento específico a escuchar
  onNewPayload: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean; // Por defecto true. Si es false, no se intentará la suscripción.
  customSupabaseClient?: SupabaseClient; // Opcional: si se usa una instancia de cliente diferente
}

interface UseRealtimeSubscriptionReturn {
  isSubscribed: boolean;
  error: string | null;
}

export function useRealtimeSubscription<
  T extends { [key: string]: any }
>({
  channelName,
  tableName,
  schema = 'public',
  filter: rlsFilter, // Renombrado para evitar conflicto con la clave del objeto filter
  event,
  onNewPayload,
  enabled = true,
  customSupabaseClient,
}: UseRealtimeSubscriptionProps<T>): UseRealtimeSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  
  const retryTimerRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewPayloadRef = useRef(onNewPayload);

  useEffect(() => {
    onNewPayloadRef.current = onNewPayload;
  }, [onNewPayload]);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    if (retryAttempt < MAX_RETRY_ATTEMPTS) {
      const delay = Math.min(3000 * Math.pow(1.8, retryAttempt), 60000); 
      console.warn(`[useRealtimeSubscription] Canal '${channelName}' (Tabla: ${schema}.${tableName}): Programando reintento #${retryAttempt + 1} en ${Math.round(delay / 1000)}s.`);
      retryTimerRef.current = window.setTimeout(() => {
        setRetryAttempt(prev => prev + 1);
      }, delay);
    } else {
      const maxRetryError = `[useRealtimeSubscription] Canal '${channelName}': Se alcanzó el máximo de reintentos (${MAX_RETRY_ATTEMPTS}). La suscripción falló para la tabla '${schema}.${tableName}'.

PASOS CRÍTICOS PARA DEPURACIÓN:
1. VERIFIQUE LA CONEXIÓN A INTERNET Y CUALQUIER FIREWALL/PROXY LOCAL.
2. ASEGÚRESE DE QUE LA REPLICACIÓN DE TABLAS ESTÉ HABILITADA para '${schema}.${tableName}' en el panel de su proyecto Supabase (Base de Datos > Replicación). Esta es la causa más común de fallos de Realtime si el código del cliente parece correcto.
3. REVISE LAS POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (RLS) en '${schema}.${tableName}' para asegurar que el usuario autenticado tiene permisos de SELECT para las filas de las que espera recibir actualizaciones (si RLS está habilitado).
4. REVISE EL ESTADO DEL PROYECTO SUPABASE (status.supabase.com) y la salud del servicio Realtime (verifique si hay alertas en el panel de su proyecto).
5. REVISE LOS LOGS DEL PANEL DE SUPABASE (Logs del Proyecto > Logs de Realtime) para errores del lado del servidor relacionados con este canal o tabla. "Unable to connect to project database" a menudo indica problemas de backend en Supabase.

No se realizarán más intentos automáticos de re-suscripción para este canal.`;
      console.error(maxRetryError);
      setError(maxRetryError); // Establecer el error final y detallado aquí
      setIsSubscribed(false);
    }
  }, [channelName, retryAttempt, schema, tableName]);

  useEffect(() => {
    if (!enabled || !channelName || !tableName) {
      if (channelRef.current) {
        const client = customSupabaseClient || supabase;
        client.removeChannel(channelRef.current)
          .then(status => console.log(`[useRealtimeSubscription] Canal ${channelName} eliminado (deshabilitado/parámetros cambiados) con estado: ${status}`))
          .catch(err => console.error(`[useRealtimeSubscription] Error eliminando canal ${channelName} (deshabilitado/parámetros cambiados):`, err));
        channelRef.current = null;
      }
      setIsSubscribed(false);
      setError(null);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      setRetryAttempt(0); 
      return;
    }

    if (channelRef.current && channelRef.current.state !== 'closed') {
        console.log(`[useRealtimeSubscription] Intentando eliminar el canal existente ${channelName} antes de una nueva suscripción.`);
        const client = customSupabaseClient || supabase;
        client.removeChannel(channelRef.current)
          .catch(err => console.error(`[useRealtimeSubscription] Error eliminando el canal anterior ${channelName} antes de una nueva suscripción:`, err));
    }
    
    const client = customSupabaseClient || supabase;
    const newChannel = client.channel(channelName, {
      config: {
        broadcast: { ack: true },
      },
    });
    channelRef.current = newChannel;

    const callback = (payload: RealtimePostgresChangesPayload<T>) => {
      onNewPayloadRef.current(payload);
    };

    const filterOptions = {
      schema,
      table: tableName,
      ...(rlsFilter !== undefined && { filter: rlsFilter }),
    };

    let changes: RealtimeChannel;
    // Using a switch statement to narrow the type of 'event' for TypeScript's overload resolution.
    // This resolves the issue where a union type for 'event' in the filter object fails to match specific overloads.
    switch (event) {
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT:
            changes = newChannel.on('postgres_changes', { event, ...filterOptions }, callback);
            break;
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE:
            changes = newChannel.on('postgres_changes', { event, ...filterOptions }, callback);
            break;
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE:
            changes = newChannel.on('postgres_changes', { event, ...filterOptions }, callback);
            break;
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL:
            changes = newChannel.on('postgres_changes', { event, ...filterOptions }, callback);
            break;
        default:
            // This case should be unreachable due to the prop's type, but it's good for type safety.
            console.error(`Unhandled Realtime event type: ${event}`);
            return;
    }

    changes.subscribe((status, err) => {
      const baseMessage = `[useRealtimeSubscription] Canal '${channelName}' (Tabla: ${schema}.${tableName})`;
      
      let errDetails = 'Sin información adicional de error.';
      if (err) {
        const errorObject = err as any; 
        const codePart = errorObject.code ? `(Código: ${errorObject.code})` : '';
        const messagePart = errorObject.message || String(err);
        errDetails = `Error: "${messagePart}" ${codePart}`;
        if (messagePart.includes("Realtime was unable to connect to the project database")) {
            console.error( // Añadir log específico para este error común
              `[useRealtimeSubscription] Error específico para el canal '${channelName}': Realtime no pudo conectarse a la base de datos del proyecto. ` +
              `Asegúrese de que la replicación de tablas esté habilitada para '${schema}.${tableName}' en su panel de Supabase (Base de Datos > Replicación).`
            );
            errDetails += " Esto suele ser un problema interno o de configuración de Supabase (como la Replicación de Tablas).";
        }
      }

      if (status === 'SUBSCRIBED') {
        console.log(`${baseMessage}: SUSCRITO exitosamente.`);
        setIsSubscribed(true);
        setError(null); // Limpiar errores previos en una suscripción exitosa
        if (retryAttempt > 0) setRetryAttempt(0); 
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const logMethod = status === 'CLOSED' && !err ? console.warn : console.error;
        logMethod(`${baseMessage}: El estado es ${status}. ${errDetails}. Intentando re-suscribir si quedan intentos.`);
        setIsSubscribed(false);
        // No establecer el estado de 'error' principal aquí para reintentos intermedios.
        // scheduleRetry establecerá el error final si se alcanza MAX_RETRY_ATTEMPTS.
        scheduleRetry();
      } else {
        // Para otros estados como 'joining', 'connected', etc.
        console.info(`${baseMessage}: El estado es ${status}. ${err ? errDetails : '(Sin detalles de error específicos)'}`);
        setIsSubscribed(false); 
      }
    });

    return () => {
      if (channelRef.current) {
        const clientToClean = customSupabaseClient || supabase;
        clientToClean.removeChannel(channelRef.current)
          .then(removeStatus => console.log(`[useRealtimeSubscription] Canal ${channelName} eliminado en limpieza con estado: ${removeStatus}`))
          .catch(removeError => console.error(`[useRealtimeSubscription] Error eliminando canal ${channelName} en limpieza:`, removeError));
        channelRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setIsSubscribed(false);
    };
  }, [channelName, tableName, schema, rlsFilter, event, enabled, retryAttempt, scheduleRetry, customSupabaseClient]);

  return { isSubscribed, error };
}
