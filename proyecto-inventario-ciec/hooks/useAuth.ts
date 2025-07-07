import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User, PostgrestSingleResponse, PostgrestError, AuthError } from '@supabase/supabase-js';
import { UserProfile, Empleado, UserProfileRol } from '../types'; // Departamento ya no se usa directamente aquí

// Tiempos de espera para operaciones asíncronas para evitar bloqueos indefinidos
const SESSION_FETCH_TIMEOUT_MS = 20000; // 20 segundos para obtener sesión
const USER_PROFILE_FETCH_TIMEOUT_MS = 30000; // REDUCIDO: 30 segundos (antes 120s) para obtener perfil de usuario
const INTERNAL_QUERY_TIMEOUT_MS = 30000; // 30 segundos para consultas internas como detalles de empleado

interface AuthHookResult {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Envuelve una promesa con un timeout. Si la promesa no se resuelve/rechaza
// en `ms` milisegundos, se rechaza con `timeoutError`.
const withTimeout = <T>(
  promise: PromiseLike<T>, // Cambiado de Promise<T> a PromiseLike<T>
  ms: number,
  timeoutError = new Error('La operación ha tardado demasiado y ha excedido el tiempo límite. Verifique la conexión de red y el estado del servicio.')
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms)),
  ]) as Promise<T>; // Se convierte a Promise<T> ya que Promise.race con PromiseLike<T> devuelve Promise<T>
};

type GetSessionResponse = { data: { session: Session | null }, error: AuthError | null };

// Verifica si hay un perfil de usuario válido almacenado en localStorage.
// Esto ayuda a mantener al usuario "logueado" visualmente mientras se verifica la sesión real.
const checkStoredSession = (): UserProfile | null => {
  const storedUser = localStorage.getItem("userProfile");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser) as UserProfile;
      // Validación robusta del perfil almacenado: debe tener id, rol (o ser null), y email (o ser null/undefined).
      if (parsedUser && typeof parsedUser.id === 'string' && (typeof parsedUser.rol === 'string' || parsedUser.rol === null) && (typeof parsedUser.email === 'string' || parsedUser.email === null || parsedUser.email === undefined)) {
        return parsedUser;
      } else {
        console.warn("[useAuth] Perfil de usuario almacenado es inválido o incompleto. Limpiando localStorage.");
        localStorage.removeItem("userProfile");
        return null;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("[useAuth] Error al analizar el perfil de usuario almacenado:", errorMsg);
      localStorage.removeItem("userProfile");
      return null;
    }
  }
  return null;
};


export function useAuth(): AuthHookResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(checkStoredSession());
  const [loading, setLoading] = useState<boolean>(true); // Inicia como true hasta que se complete la carga inicial.
  const [error, setError] = useState<Error | null>(null);
  
  // Ref para evitar procesamiento concurrente de eventos de autenticación (ej. múltiples onAuthStateChange).
  const isProcessingAuthEvent = useRef<boolean>(false);

  // Refs para acceder al valor más reciente de userProfile y session en callbacks
  // sin causar re-renders innecesarios o depender de closures obsoletas.
  const userProfileRef = useRef(userProfile);
  const sessionRef = useRef(session);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Función para obtener el perfil completo del usuario, incluyendo datos del empleado y departamento asociados.
  const fetchUserProfile = useCallback(async (userId: string, userEmail?: string | null): Promise<UserProfile | null> => {
    // El email se pasa desde la sesión de Supabase Auth, no se selecciona de la tabla user_profile.
    type SelectedUserProfileData = {
      id: string;
      rol: UserProfileRol | null;
      empleado_id: number | null;
      departamento_id: number | null;
      // Supabase puede devolver un array de un solo elemento para relaciones anidadas con .single() si la FK no es única (aunque aquí debería serlo).
      // O puede devolver el objeto directamente si la relación es correctamente inferida como uno-a-uno.
      departamento: { id: number; nombre: string } | Array<{ id: number; nombre: string }> | null; 
    };

    let basicProfileData: SelectedUserProfileData | null = null;
    let rawBasicProfileError: PostgrestError | null = null;
    let rawEmpleadoError: PostgrestError | null = null;

    try {
      // Paso 1: Obtener datos básicos del perfil y su departamento.
      const userProfileQuery = supabase
        .from("user_profile")
        .select(`
          id,
          rol,
          empleado_id,
          departamento_id,
          departamento:departamento_id (id, nombre) 
        `) 
        .eq("id", userId)
        .single<SelectedUserProfileData>(); 

      const userProfileResult = await withTimeout<PostgrestSingleResponse<SelectedUserProfileData>>( 
        userProfileQuery, 
        USER_PROFILE_FETCH_TIMEOUT_MS,
        new Error("Timeout: La obtención del perfil básico del usuario tardó demasiado. Verifique la conexión y el rendimiento de la base de datos del proyecto Supabase.")
      );

      basicProfileData = userProfileResult.data;
      rawBasicProfileError = userProfileResult.error;

      if (rawBasicProfileError) {
        const msg = String(rawBasicProfileError.message || "Error desconocido al obtener perfil básico.");
        const code = rawBasicProfileError?.code ? `(Código: ${String(rawBasicProfileError.code)})` : '';
        const details = rawBasicProfileError?.details ? `Detalles: ${String(rawBasicProfileError.details)}` : '';
        console.error(`[useAuth] Error al obtener perfil de usuario básico: ${msg} ${code} ${details}`, rawBasicProfileError);
        throw rawBasicProfileError; // Lanzar para ser capturado por el catch principal de fetchUserProfile
      }

      if (!basicProfileData) {
        console.warn("[useAuth] No se encontró perfil de usuario básico para ID:", userId);
        return null;
      }
      
      // Normalizar 'departamento': Supabase puede devolver un array incluso con .single() si la relación es compleja.
      const departamentoData = Array.isArray(basicProfileData.departamento) 
        ? basicProfileData.departamento[0] 
        : basicProfileData.departamento;

      const completeProfile: UserProfile = {
        id: basicProfileData.id,
        email: userEmail || undefined, // Poblar email desde el usuario de sesión
        rol: basicProfileData.rol,
        empleado_id: basicProfileData.empleado_id,
        departamento_id: basicProfileData.departamento_id,
        created_at: new Date().toISOString(), // Placeholder, la DB tiene el valor real
        updated_at: new Date().toISOString(), // Placeholder
        departamento: departamentoData ? { // Construir objeto Departamento si existe
             id: departamentoData.id,
             nombre: departamentoData.nombre,
             created_at: new Date().toISOString(), 
             updated_at: new Date().toISOString(), 
        } : undefined,
        empleado: undefined
      };

      // Paso 2: Si hay empleado_id, obtener detalles del empleado.
      if (completeProfile.empleado_id) {
        const empleadoQuery = supabase
          .from("empleado")
          .select(`
            id, estado, nombre, apellido, departamento_id, cargo_actual_id, cedula, firma
          `)
          .eq("id", completeProfile.empleado_id)
          .single<Partial<Empleado>>();

        const empleadoResult = await withTimeout<PostgrestSingleResponse<Partial<Empleado>>>( 
          empleadoQuery, 
          INTERNAL_QUERY_TIMEOUT_MS,
          new Error("Timeout: La obtención de los detalles del empleado tardó demasiado. Verifique la conexión y el rendimiento de la base de datos del proyecto Supabase.")
        );

        const empleadoData = empleadoResult.data;
        rawEmpleadoError = empleadoResult.error;

        if (rawEmpleadoError) {
            const msg = String(rawEmpleadoError.message || "Error desconocido al obtener detalles de empleado.");
            const code = rawEmpleadoError?.code ? `(Código: ${String(rawEmpleadoError.code)})` : '';
            const details = rawEmpleadoError?.details ? `Detalles: ${String(rawEmpleadoError.details)}` : '';
            console.error(`[useAuth] Error al obtener detalles del empleado: ${msg} ${code} ${details}`, rawEmpleadoError);
            // No lanzar error aquí, el perfil básico ya se obtuvo. Se podría retornar el perfil parcial.
        }

        if (empleadoData) {
          completeProfile.empleado = {
            ...empleadoData,
            // Rellenar campos faltantes de Empleado si es necesario para la interfaz completa
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString(), 
          } as Partial<Empleado> & { nombre: string; apellido: string; }; 
        } else if (!rawEmpleadoError) { 
            console.warn(`[useAuth] No se encontró empleado para empleado_id: ${completeProfile.empleado_id} (Usuario ${userId})`);
        }
      }
      return completeProfile;
    } catch (e) {
      const errorToLog = e instanceof Error ? e : new Error(String(e || "Error desconocido en fetchUserProfile"));
      console.error(`[useAuth] fetchUserProfile: Error procesando perfil para usuario ${userId}. Error: ${errorToLog.message}`, errorToLog);
      throw errorToLog; // Relanzar para que el llamador maneje el error
    }
  }, []);

  // Efecto para obtener la sesión inicial y el perfil del usuario al montar el hook.
  useEffect(() => {
    const getInitialSession = async () => {
      if (isProcessingAuthEvent.current) {
        console.log("[useAuth] getInitialSession: Omitido, procesamiento de autenticación en curso.");
        return;
      }
      isProcessingAuthEvent.current = true; // Bloquear para este proceso
      setLoading(true);
      setError(null);
      let loginAbortedReason = "Perfil de usuario no encontrado o carga fallida.";

      try {
        const sessionResponse = await withTimeout<GetSessionResponse>(
            supabase.auth.getSession(),
            SESSION_FETCH_TIMEOUT_MS,
            new Error("La obtención de la sesión inicial tardó demasiado.")
        );

        const currentSupabaseSession = sessionResponse.data.session;
        const sessionError = sessionResponse.error;

        if (sessionError) {
          console.error("[useAuth] Error en getInitialSession (getSession):", sessionError.message, sessionError);
          throw sessionError; // Terminar si hay error de sesión de Supabase
        }

        setSession(currentSupabaseSession);
        setUser(currentSupabaseSession?.user ?? null);

        if (currentSupabaseSession?.user) {
          let profile: UserProfile | null = null;
          try {
              // Pasar el email desde la sesión de Supabase a fetchUserProfile
              profile = await fetchUserProfile(currentSupabaseSession.user.id, currentSupabaseSession.user.email);
          } catch (fetchProfileError) {
              console.warn("[useAuth] getInitialSession: fetchUserProfile falló durante la carga inicial.", fetchProfileError);
              // No es un error fatal para la sesión de Supabase, pero sí para el perfil de la app.
          }

          if (profile && profile.empleado?.estado === 'activo') {
              setUserProfile(profile);
              localStorage.setItem("userProfile", JSON.stringify(profile));
          } else {
              const storedProfile = checkStoredSession(); 
              if (storedProfile && storedProfile.id === currentSupabaseSession.user.id && storedProfile.empleado?.estado === 'activo' && storedProfile.email === currentSupabaseSession.user.email) {
                  console.warn("[useAuth] getInitialSession: Falló la obtención del perfil en vivo / perfil inactivo. Usando perfil activo de localStorage.");
                  setUserProfile(storedProfile);
                  setError(new Error(profile ? (profile.empleado?.estado !== 'activo' ? "Usuario inactivo. Usando datos locales." : "No se pudo obtener el perfil. Usando datos locales.") : "Error al obtener perfil. Usando datos locales."));
              } else {
                  loginAbortedReason = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacte al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo.") : "No se pudo cargar el perfil de usuario.";
                  
                  // Si el perfil obtenido explícitamente es inactivo, es un error que debe cerrar sesión.
                  if (profile && profile.empleado?.estado === 'inactivo') {
                      console.warn(`[useAuth] getInitialSession: ${loginAbortedReason}. Cerrando sesión.`);
                      throw new Error(loginAbortedReason); 
                  } else {
                      // Otros casos: perfil no encontrado, error al obtenerlo, etc.
                      // La sesión de Supabase sigue siendo válida, pero el perfil de la app no.
                      console.warn(`[useAuth] getInitialSession: ${loginAbortedReason}. La sesión de Supabase sigue activa.`);
                      setError(new Error(loginAbortedReason));
                      setUserProfile(null); 
                      localStorage.removeItem("userProfile");
                  }
              }
          }
        } else { 
          // No hay sesión de Supabase activa. Intentar cargar desde localStorage si es válido.
          const storedProfile = checkStoredSession();
          if (storedProfile && storedProfile.empleado?.estado === 'activo') {
             console.warn("[useAuth] getInitialSession: No hay sesión de Supabase, pero se encontró un perfil activo almacenado. Usando perfil almacenado (podría estar desactualizado).");
             setUserProfile(storedProfile);
             // No hay sesión de Supabase, así que session y user permanecen null.
          } else {
             if(storedProfile && storedProfile.empleado?.estado !== 'activo') {
                console.warn("[useAuth] Sesión de usuario almacenada está inactiva. Limpiando localStorage.");
                localStorage.removeItem("userProfile");
             }
             setUserProfile(null); // No hay sesión de Supabase ni perfil válido en localStorage.
          }
        }
      } catch (e) { 
          const finalError = e instanceof Error ? e : new Error(String(e || "Error desconocido durante la carga inicial de sesión."));
          // Añadir registro más específico si el error es por timeout en la obtención del perfil
          if (finalError.message.includes("La obtención del perfil básico del usuario tardó demasiado")) {
            console.error("[useAuth] PROBLEMA_CRITICO_RENDIMIENTO_BD: La obtención del perfil de usuario falló por timeout. Esto indica serios problemas de rendimiento con la base de datos de Supabase o la conexión de red, lo cual también afectará a Realtime y otras funcionalidades.", finalError);
          } else {
            console.error("[useAuth] Error crítico en getInitialSession:", finalError.message, finalError);
          }
          setError(finalError);
          setUserProfile(null); setSession(null); setUser(null); 
          localStorage.removeItem("userProfile");
      } finally {
          setLoading(false);
          console.log("[useAuth] getInitialSession: Carga inicial completada. Estado de carga: false.");
          isProcessingAuthEvent.current = false; 
      }
    };

    getInitialSession();
  }, [fetchUserProfile]); // fetchUserProfile está memoizado con useCallback

  // Efecto para escuchar cambios en el estado de autenticación de Supabase (login, logout, refresh token).
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (authChangeEvent, newSession) => {
      console.log(`[useAuth] onAuthStateChange: Evento '${String(authChangeEvent)}'. Nuevo ID de sesión: ${newSession?.user?.id}, Email: ${newSession?.user?.email}`);

      // Si una operación como login/logout inició esto, habría establecido isProcessingAuthEvent.
      // Esta guarda es para prevenir el procesamiento concurrente de onAuthStateChange si múltiples eventos se disparan rápidamente
      // por razones distintas a una acción directa del usuario que ya se está manejando.
      // Sin embargo, si getInitialSession es el que establece el bloqueo, esto podría ser demasiado agresivo.
      // Para logout, la función 'logout' misma establecerá el bloqueo, y este onAuthStateChange es el seguimiento *esperado*.
      // Si el bloqueo ya está establecido por `logout`, este bloque `if` se saltaría el procesamiento de `SIGNED_OUT`.
      // Esta guarda necesita ser más matizada o eliminada si `login`/`logout` gestionan correctamente su propio ciclo de vida de `isProcessingAuthEvent`.
      // Por ahora, asumimos que esta guarda es problemática para el logout.
      // if (isProcessingAuthEvent.current) {
      //   console.log(`[useAuth] onAuthStateChange: Evento '${String(authChangeEvent)}' omitido, otro procesamiento en curso.`);
      //   return;
      // }
      // En lugar de la guarda anterior, las rutas individuales gestionarán el bloqueo.
      
      const currentLocalProfile = userProfileRef.current; 
      const currentLocalSession = sessionRef.current;   

      // Lógica para refresco de perfil en segundo plano si ya hay sesión y perfil activos.
      // Esto ocurre para eventos como TOKEN_REFRESHED, USER_UPDATED.
      // SIGNED_IN aquí podría ser redundante si un flujo de login acaba de completarse y está esperando esto.
      if (currentLocalProfile && currentLocalSession && newSession?.user &&
          (authChangeEvent === 'TOKEN_REFRESHED' || authChangeEvent === 'USER_UPDATED' || (authChangeEvent === 'SIGNED_IN' && newSession.user.id === currentLocalSession.user.id))) {
          
          if (isProcessingAuthEvent.current) {
            console.log(`[useAuth] onAuthStateChange (segundo plano): Omitido para evento '${String(authChangeEvent)}', otro procesamiento de autenticación (login/logout/initial) en curso.`);
            return;
          }
          isProcessingAuthEvent.current = true; // Lock for background refresh

          console.log(`[useAuth] onAuthStateChange: Refresco de perfil en segundo plano para usuario ${newSession.user.id}.`);
          try {
              setSession(newSession); 
              setUser(newSession.user);

              const refreshedProfile = await fetchUserProfile(newSession.user.id, newSession.user.email);
              if (refreshedProfile && refreshedProfile.empleado?.estado === 'activo') {
                  setUserProfile(refreshedProfile);
                  localStorage.setItem("userProfile", JSON.stringify(refreshedProfile));
              } else if (refreshedProfile && refreshedProfile.empleado?.estado !== 'activo') {
                  console.warn("[useAuth] onAuthStateChange (segundo plano): Usuario se volvió inactivo. Cerrando sesión.");
                  // Force a full logout sequence by calling the main logout function
                  // This ensures all state is cleaned up consistently.
                  await logout(); // Call the main logout function
                  // setError will be set by logout if needed.
              } else if (!refreshedProfile) {
                  console.warn(`[useAuth] onAuthStateChange (segundo plano): Perfil para usuario ${newSession.user.id} no encontrado tras refresco. Manteniendo perfil local (podría estar desactualizado).`);
                  setError(new Error("No se pudo actualizar la información más reciente del perfil. Se utilizarán los datos locales."));
              }
          } catch (backgroundError) {
              const bgError = backgroundError instanceof Error ? backgroundError : new Error(String(backgroundError));
              console.warn(`[useAuth] onAuthStateChange (segundo plano): Error refrescando perfil: ${bgError.message}.`);
              if(bgError.message.includes("Usuario inactivo")){ 
                  await logout(); // Call main logout
              } else { 
                  setError(new Error(`No se pudo actualizar su perfil (${bgError.message}). Usando información local.`));
              }
          } finally {
              isProcessingAuthEvent.current = false; // Release lock for background refresh
              console.log(`[useAuth] onAuthStateChange (segundo plano): Evento '${String(authChangeEvent)}' procesado.`);
          }
      } else { // This path handles INITIAL_SESSION, SIGNED_IN (new user), SIGNED_OUT
          // If isProcessingAuthEvent is already true (e.g. set by login/logout/getInitialSession),
          // this means this onAuthStateChange is part of that flow.
          // If it's false, then this is a spontaneous event, and this path will manage the lock.
          const isInitiatingNewProcess = !isProcessingAuthEvent.current;
          if (isInitiatingNewProcess) {
            isProcessingAuthEvent.current = true;
          }
          // setLoading(true) should generally be set by the initiating action (login/logout/initial)
          // onAuthStateChange's finally block will set it to false.
          // For INITIAL_SESSION, getInitialSession sets loading.
          // For SIGNED_IN (after login), login sets loading.
          // For SIGNED_OUT (after logout), logout sets loading.
          // If it's a truly spontaneous event that wasn't caught by background refresh, we might need to set loading.
          // However, this 'else' branch is also hit by initial_session, login, logout.
          // Let's ensure loading is only set true if it's not already part of an ongoing process loading state.
          if (authChangeEvent !== 'TOKEN_REFRESHED' && authChangeEvent !== 'USER_UPDATED') { // Avoid double loading for background events
             setLoading(true); 
          }


          console.log(`[useAuth] onAuthStateChange: Procesamiento completo para evento '${String(authChangeEvent)}'.`);
          setError(null);
          let authStateChangeReason = "Perfil de usuario no encontrado o carga fallida tras cambio de estado.";
          try {
              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (newSession?.user) { // SIGNED_IN or INITIAL_SESSION with user
                  const profile = await fetchUserProfile(newSession.user.id, newSession.user.email);
                  if (profile && profile.empleado?.estado === 'activo') {
                      setUserProfile(profile);
                      localStorage.setItem("userProfile", JSON.stringify(profile));
                  } else {
                      authStateChangeReason = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacte al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo tras cambio de estado.") : authStateChangeReason;
                      console.warn(`[useAuth] onAuthStateChange (completo): ${authStateChangeReason}`);
                      // For SIGNED_IN or INITIAL_SESSION, if profile is invalid, treat as logout
                      setUserProfile(null); localStorage.removeItem("userProfile"); setSession(null); setUser(null);
                      setError(new Error(authStateChangeReason));
                  }
              } else { // SIGNED_OUT or INITIAL_SESSION without user
                  setUserProfile(null);
                  localStorage.removeItem("userProfile");
                  console.log("[useAuth] onAuthStateChange (completo): SIGNED_OUT o INITIAL_SESSION sin usuario. Perfil y localStorage limpiados.");
              }
          } catch (e) {
              const finalError = e instanceof Error ? e : new Error(String(e || "Error desconocido durante cambio de estado de auth."));
              console.error("[useAuth] Error durante procesamiento de onAuthStateChange (completo):", finalError.message, finalError);
              setError(finalError);
              setUserProfile(null); setSession(null); setUser(null); localStorage.removeItem("userProfile"); 
          } finally {
              setLoading(false); 
              isProcessingAuthEvent.current = false; // Release lock. This is the main release point.
              console.log(`[useAuth] onAuthStateChange (completo): Evento '${String(authChangeEvent)}' procesado. Carga: false.`);
          }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe(); 
    };
  }, [fetchUserProfile]); 

  const login = async (email: string, password: string) => {
    if (isProcessingAuthEvent.current) {
        console.warn("[useAuth] Login: Ignorado, otro proceso de autenticación está activo.");
        throw new Error("Procesamiento de autenticación en curso. Intente de nuevo en un momento.");
    }
    isProcessingAuthEvent.current = true;
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        console.error("[useAuth] Login: Error directo de Supabase:", signInError.message, signInError);
        throw signInError; 
      }
      // Success is handled by onAuthStateChange. It will set loading=false and release isProcessingAuthEvent.
      console.log("[useAuth] Login: signInWithPassword exitoso. Esperando onAuthStateChange.");
    } catch (e) {
      const caughtLoginError = e instanceof Error ? e : new Error(String(e || "Error desconocido durante el inicio de sesión."));
      console.error("[useAuth] Login: Error en bloque catch:", caughtLoginError.message, caughtLoginError);

      let finalErrorToThrow: Error;
      if ((e as AuthError).status === 400 || caughtLoginError.message.includes("Invalid login credentials")) {
        finalErrorToThrow = new Error("Credenciales inválidas. Por favor, verifica tu email y contraseña.");
      } else {
        finalErrorToThrow = caughtLoginError; 
      }

      setError(finalErrorToThrow);
      setUserProfile(null); setSession(null); setUser(null); 
      localStorage.removeItem("userProfile");
      setLoading(false); 
      isProcessingAuthEvent.current = false; 
      throw finalErrorToThrow; 
    } 
  };

  const logout = async () => {
    if (isProcessingAuthEvent.current && sessionRef.current === null) {
        console.warn("[useAuth] Logout: Ya procesando y sesión es nula. Limpieza forzada y retorno.");
        setSession(null); setUser(null); setUserProfile(null); localStorage.removeItem("userProfile"); setLoading(false); setError(null);
        isProcessingAuthEvent.current = false;
        return;
    }
    if (isProcessingAuthEvent.current) {
        console.warn("[useAuth] Logout: Ignorado, otro proceso de autenticación ya está activo.");
        return; // Prevent concurrent logouts if one is already underway
    }
    
    console.log("[useAuth] Logout: Iniciando cierre de sesión.");
    isProcessingAuthEvent.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("[useAuth] Logout: Error en supabase.auth.signOut():", signOutError.message);
        throw signOutError; // Caught by catch block below
      }
      // onAuthStateChange (event: SIGNED_OUT) se encargará de:
      // 1. Poner session, user, userProfile a null.
      // 2. Limpiar "userProfile" de localStorage.
      // 3. Poner loading a false.
      // 4. Poner isProcessingAuthEvent.current a false.
      console.log("[useAuth] Logout: supabase.auth.signOut() exitoso. Esperando onAuthStateChange.");
    } catch (e) {
      const caughtLogoutError = e instanceof Error ? e : new Error(String(e || "Error desconocido durante el cierre de sesión."));
      console.error("[useAuth] Logout: Error en bloque catch:", caughtLogoutError.message, caughtLogoutError);
      setError(caughtLogoutError);
      // Limpieza explícita en caso de que onAuthStateChange falle o no se dispare.
      setSession(null); setUser(null); setUserProfile(null);
      localStorage.removeItem("userProfile");
      setLoading(false); 
      isProcessingAuthEvent.current = false; 
    }
  };

  return { session, user, userProfile, loading, error, login, logout };
}