// hooks/useRealtimeSubscription.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient, RealtimePostgresChangesFilter, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/supabase-js';

const MAX_RETRY_ATTEMPTS = 5; // Max attempts before giving up

interface UseRealtimeSubscriptionProps<
  T extends { [key: string]: any },
  E extends REALTIME_POSTGRES_CHANGES_LISTEN_EVENT // E is the specific event type
> {
  channelName: string; // Unique channel name, e.g., `user-notifications-${userId}`
  tableName: string;
  schema?: string; // Defaults to 'public'
  filter?: string; // e.g., `user_id=eq.${userId}` (RLS filter)
  event: E;       // The specific event to listen to, now required and of type E
  onNewPayload: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean; // Defaults to true. If false, subscription won't be attempted.
  customSupabaseClient?: SupabaseClient; // Optional: if using a different client instance
}

interface UseRealtimeSubscriptionReturn {
  isSubscribed: boolean;
  error: string | null;
}

export function useRealtimeSubscription<
  T extends { [key: string]: any },
  E extends REALTIME_POSTGRES_CHANGES_LISTEN_EVENT // E is the specific event type
>({
  channelName,
  tableName,
  schema = 'public',
  filter: rlsFilter, // Renamed to avoid conflict with the filter object key
  event, // This is now of type E, passed directly from props
  onNewPayload,
  enabled = true,
  customSupabaseClient,
}: UseRealtimeSubscriptionProps<T, E>): UseRealtimeSubscriptionReturn {
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
      console.warn(`[useRealtimeSubscription] Channel '${channelName}' (Table: ${schema}.${tableName}): Scheduling retry #${retryAttempt + 1} in ${Math.round(delay / 1000)}s.`);
      retryTimerRef.current = window.setTimeout(() => {
        setRetryAttempt(prev => prev + 1);
      }, delay);
    } else {
      const maxRetryError = `[useRealtimeSubscription] Channel '${channelName}': Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Subscription failed for table '${schema}.${tableName}'.

CRITICAL DEBUGGING STEPS:
1. VERIFY INTERNET CONNECTION AND ANY LOCAL FIREWALLS/PROXIES.
2. ENSURE TABLE REPLICATION IS ENABLED for '${schema}.${tableName}' in your Supabase project dashboard (Database > Replication). This is the most common cause of Realtime failures if client-side code seems correct.
3. CHECK ROW LEVEL SECURITY (RLS) POLICIES on '${schema}.${tableName}' to ensure the authenticated user has SELECT permissions for the rows they expect to receive updates for (if RLS is enabled).
4. REVIEW SUPABASE PROJECT STATUS (status.supabase.com) and Realtime service health (check your project's dashboard for any alerts).
5. CHECK SUPABASE DASHBOARD LOGS (Project Logs > Realtime logs) for server-side errors related to this channel or table. "Unable to connect to project database" often indicates backend issues within Supabase.

No further automatic re-subscription attempts will be made for this channel.`;
      console.error(maxRetryError);
      setError(maxRetryError);
      setIsSubscribed(false);
    }
  }, [channelName, retryAttempt, schema, tableName]);

  useEffect(() => {
    if (!enabled || !channelName || !tableName) {
      if (channelRef.current) {
        const client = customSupabaseClient || supabase;
        client.removeChannel(channelRef.current)
          .then(status => console.log(`[useRealtimeSubscription] Channel ${channelName} removed (disabled/params changed) with status: ${status}`))
          .catch(err => console.error(`[useRealtimeSubscription] Error removing channel ${channelName} (disabled/params changed):`, err));
        channelRef.current = null;
      }
      setIsSubscribed(false);
      setError(null);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      setRetryAttempt(0); 
      return;
    }

    if (channelRef.current && channelRef.current.state !== 'closed') {
        console.log(`[useRealtimeSubscription] Attempting to remove existing channel ${channelName} before new subscription.`);
        const client = customSupabaseClient || supabase;
        client.removeChannel(channelRef.current)
          .catch(err => console.error(`[useRealtimeSubscription] Error removing previous channel ${channelName} before new subscription:`, err));
    }
    
    const client = customSupabaseClient || supabase;
    const newChannel = client.channel(channelName, {
      config: {
        broadcast: { ack: true },
      },
    });
    channelRef.current = newChannel;

    const postgresChangesFilter: RealtimePostgresChangesFilter<E> = {
      event: event, 
      schema: schema,
      table: tableName,
    };
    if (rlsFilter !== undefined) { 
      postgresChangesFilter.filter = rlsFilter;
    }

    const changes = newChannel.on(
      'postgres_changes',
      postgresChangesFilter,
      (payload: RealtimePostgresChangesPayload<any>) => { // Use 'any' initially for wider compatibility
        onNewPayloadRef.current(payload as RealtimePostgresChangesPayload<T>); // Cast to specific type for callback
      }
    );

    changes.subscribe((status, err) => {
      const baseMessage = `[useRealtimeSubscription] Channel '${channelName}' (Table: ${schema}.${tableName})`;
      
      let errDetails = 'No additional error information.';
      if (err) {
        const errorObject = err as any; 
        const codePart = errorObject.code ? `(Code: ${errorObject.code})` : '';
        const messagePart = errorObject.message || String(err);
        errDetails = `Error: "${messagePart}" ${codePart}`;
        if (messagePart.includes("Realtime was unable to connect to the project database")) {
            console.error( // Add specific log for this common error
              `[useRealtimeSubscription] Specific error for channel '${channelName}': Realtime was unable to connect to the project database. ` +
              `Ensure table replication is enabled for '${schema}.${tableName}' in your Supabase dashboard (Database > Replication).`
            );
            errDetails += " This is often a Supabase internal or configuration issue (like Table Replication).";
        }
      }

      if (status === 'SUBSCRIBED') {
        console.log(`${baseMessage}: Successfully SUBSCRIBED.`);
        setIsSubscribed(true);
        setError(null);
        if (retryAttempt > 0) setRetryAttempt(0); 
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const logMethod = status === 'CLOSED' && !err ? console.warn : console.error;
        logMethod(`${baseMessage}: Status is ${status}. ${errDetails} . Attempting to re-subscribe.`);
        setIsSubscribed(false);
        setError(`Subscription failed with status ${status}. ${errDetails}`);
        scheduleRetry();
      } else {
        console.info(`${baseMessage}: Status is ${status}. ${err ? errDetails : '(No specific error details)'}`);
        setIsSubscribed(false); 
      }
    });

    return () => {
      if (channelRef.current) {
        const clientToClean = customSupabaseClient || supabase;
        clientToClean.removeChannel(channelRef.current)
          .then(removeStatus => console.log(`[useRealtimeSubscription] Channel ${channelName} removed on cleanup with status: ${removeStatus}`))
          .catch(removeError => console.error(`[useRealtimeSubscription] Error removing channel ${channelName} on cleanup:`, removeError));
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