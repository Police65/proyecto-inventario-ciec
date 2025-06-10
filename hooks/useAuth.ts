
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User, PostgrestSingleResponse, PostgrestError, AuthError } from '@supabase/supabase-js';
import { UserProfile, Empleado, Departamento, UserProfileRol } from '../types';

// Tiempos de espera ajustados para las operaciones de autenticación y perfil.
const SESSION_FETCH_TIMEOUT_MS = 20000; 
const USER_PROFILE_FETCH_TIMEOUT_MS = 90000; 
const INTERNAL_QUERY_TIMEOUT_MS = 30000;

interface AuthHookResult {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error('La operación ha tardado demasiado.')
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms)),
  ]);
};

type GetSessionResponse = { data: { session: Session | null }, error: AuthError | null };

const checkStoredSession = (): UserProfile | null => {
  const storedUser = localStorage.getItem("userProfile");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser) as UserProfile;
      if (parsedUser && typeof parsedUser.id === 'string' && (typeof parsedUser.rol === 'string' || parsedUser.rol === null)) { 
        return parsedUser;
      } else {
        console.warn("El perfil de usuario almacenado es inválido o incompleto. Limpiando.");
        localStorage.removeItem("userProfile");
        return null;
      }
    } catch (e) {
      console.error("Error al analizar el perfil de usuario almacenado:", e instanceof Error ? e.message : String(e));
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const isProcessingAuthEvent = useRef<boolean>(false);

  const userProfileRef = useRef(userProfile);
  const sessionRef = useRef(session);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);


  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    type SelectedUserProfileData = {
      id: string;
      rol: UserProfileRol | null;
      empleado_id: number | null;
      departamento_id: number | null;
      departamento: { id: number; nombre: string } | null;
    };

    let basicProfileData: SelectedUserProfileData | null = null;
    let rawBasicProfileError: PostgrestError | null = null;
    let rawEmpleadoError: PostgrestError | null = null;

    let msgErrorBasicProfile: string;
    let codePartErrorBasicProfile: string;
    let detailsPartErrorBasicProfile: string;

    let msgErrorEmpleado: string;
    let codePartErrorEmpleado: string;
    let detailsPartErrorEmpleado: string;

    try {
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
        Promise.resolve(userProfileQuery), // Wrapped with Promise.resolve()
        USER_PROFILE_FETCH_TIMEOUT_MS,
        new Error("Error al obtener perfil base: tiempo de espera excedido para datos básicos del perfil.")
      );

      basicProfileData = userProfileResult.data;
      rawBasicProfileError = userProfileResult.error;

      if (rawBasicProfileError) {
        msgErrorBasicProfile = String(rawBasicProfileError.message || "Error desconocido al obtener perfil básico.");
        codePartErrorBasicProfile = (rawBasicProfileError as any).code ? `(Código: ${String((rawBasicProfileError as any).code)})` : '';
        detailsPartErrorBasicProfile = (rawBasicProfileError as any).details ? `Detalles: ${String((rawBasicProfileError as any).details)}` : '';
        console.error(`Error al obtener perfil de usuario básico: ${msgErrorBasicProfile} ${codePartErrorBasicProfile} ${detailsPartErrorBasicProfile}`, rawBasicProfileError);
        throw rawBasicProfileError;
      }

      if (!basicProfileData) {
        console.warn("No se encontró perfil de usuario básico para ID:", userId);
        return null;
      }

      const completeProfile: UserProfile = {
        id: basicProfileData.id,
        rol: basicProfileData.rol as UserProfileRol | null,
        empleado_id: basicProfileData.empleado_id,
        departamento_id: basicProfileData.departamento_id,
        departamento: basicProfileData.departamento ? {
             id: basicProfileData.departamento.id,
             nombre: basicProfileData.departamento.nombre
        } : undefined,
        empleado: undefined,
      };

      if (completeProfile.empleado_id) {
        const empleadoQuery = supabase
          .from("empleado")
          .select(`
            id,
            estado,
            nombre,
            apellido,
            departamento_id,
            cargo_actual_id,
            cedula,
            firma
          `)
          .eq("id", completeProfile.empleado_id)
          .single<Partial<Empleado>>();

        const empleadoResult = await withTimeout<PostgrestSingleResponse<Partial<Empleado>>>(
          Promise.resolve(empleadoQuery), // Wrapped with Promise.resolve()
          INTERNAL_QUERY_TIMEOUT_MS,
          new Error("Error al obtener detalles del empleado: tiempo de espera excedido.")
        );

        const empleadoData = empleadoResult.data; 
        rawEmpleadoError = empleadoResult.error;

        if (rawEmpleadoError) {
            msgErrorEmpleado = String(rawEmpleadoError.message || "Error desconocido al obtener detalles de empleado.");
            codePartErrorEmpleado = (rawEmpleadoError as any).code ? `(Código: ${String((rawEmpleadoError as any).code)})` : '';
            detailsPartErrorEmpleado = (rawEmpleadoError as any).details ? `Detalles: ${String((rawEmpleadoError as any).details)}` : '';
            console.error(`Error al obtener detalles del empleado: ${msgErrorEmpleado} ${codePartErrorEmpleado} ${detailsPartErrorEmpleado}`, rawEmpleadoError);
        }

        if (empleadoData) {
          completeProfile.empleado = empleadoData;
        } else if (!rawEmpleadoError) {
            console.warn(`No se encontró empleado para empleado_id: ${completeProfile.empleado_id} asociado con el usuario ${userId}`);
        }
      }
      return completeProfile;
    } catch (e) {
      let errorToLog: Error;
      if (e instanceof Error) {
        errorToLog = e;
      } else {
        errorToLog = new Error(String(e || "Error desconocido en fetchUserProfile"));
      }
      console.error("[useAuth] fetchUserProfile: Error procesando perfil para usuario " + userId + ". Error: " + errorToLog.message, errorToLog);
      throw errorToLog;
    }
    // This line was originally reported as unreachable, which is correct.
    // console.error("[useAuth] fetchUserProfile: Código inalcanzable alcanzado después del bloque try/catch.");
    // return null; 
  }, []);

  useEffect(() => {
    const getInitialSession = async () => {
      if (isProcessingAuthEvent.current) {
        console.log("[useAuth] getInitialSession: Omitido debido a un procesamiento de autenticación en curso.");
        return;
      }
      isProcessingAuthEvent.current = true;
      setLoading(true);
      setError(null);
      let loginAbortedReasonForGetInitial = "Perfil de usuario no encontrado o carga fallida.";

      try {
        const sessionResponse = await withTimeout<GetSessionResponse>(
            supabase.auth.getSession(),
            SESSION_FETCH_TIMEOUT_MS,
            new Error("La obtención de la sesión inicial ha tardado demasiado.")
        );

        const currentSupabaseSession = sessionResponse.data.session;
        const sessionError = sessionResponse.error;

        if (sessionError) {
          console.error("Error en getInitialSession (getSession):", sessionError.message, sessionError);
          throw sessionError;
        }

        setSession(currentSupabaseSession);
        setUser(currentSupabaseSession?.user ?? null);

        if (currentSupabaseSession?.user) {
          let profile: UserProfile | null = null;
          try {
              profile = await fetchUserProfile(currentSupabaseSession.user.id);
          } catch (e) {
              console.warn("[useAuth] getInitialSession: Falló fetchUserProfile durante la carga inicial.", e);
          }
      
          if (profile && profile.empleado?.estado === 'activo') {
              setUserProfile(profile);
              localStorage.setItem("userProfile", JSON.stringify(profile));
          } else {
              const stored = checkStoredSession();
              if (stored && stored.id === currentSupabaseSession.user.id && stored.empleado?.estado === 'activo') {
                  console.warn("[useAuth] getInitialSession: Falló la obtención del perfil en vivo/inactivo, usando perfil activo almacenado.");
                  setUserProfile(stored);
                  setError(new Error(profile ? (profile.empleado?.estado !== 'activo' ? "Usuario inactivo. Usando datos locales." : "No se pudo obtener el perfil. Usando datos locales.") : "Error al obtener perfil. Usando datos locales."));
              } else {
                  loginAbortedReasonForGetInitial = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacte al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo.") : "No se pudo cargar el perfil de usuario.";
                  
                  if (profile && profile.empleado?.estado === 'inactivo') {
                      console.warn(`[useAuth] getInitialSession: ${loginAbortedReasonForGetInitial}. Cerrando sesión.`);
                      throw new Error(loginAbortedReasonForGetInitial); 
                  } else {
                      console.warn(`[useAuth] getInitialSession: ${loginAbortedReasonForGetInitial}. La sesión de Supabase sigue siendo válida.`);
                      setError(new Error(loginAbortedReasonForGetInitial));
                      setUserProfile(null);
                      localStorage.removeItem("userProfile");
                  }
              }
          }
        } else { 
          const stored = checkStoredSession();
          if (stored && stored.empleado?.estado === 'activo') {
             console.warn("[useAuth] getInitialSession: No hay sesión de Supabase, pero se encontró perfil activo almacenado. Usando perfil almacenado (podría estar desactualizado).");
             setUserProfile(stored);
          } else {
             if(stored && stored.empleado?.estado !== 'activo') {
                console.warn("La sesión de usuario almacenada está inactiva. Limpiando.");
                localStorage.removeItem("userProfile");
             }
             setUserProfile(null); 
          }
        }
      } catch (e) { 
          let finalErrorForInitialSession: Error;
          if (e instanceof Error) {
            finalErrorForInitialSession = e;
          } else {
            finalErrorForInitialSession = new Error(String(e || "Error desconocido durante la carga inicial de sesión."));
          }
          console.error("Error crítico en getInitialSession:", finalErrorForInitialSession.message, finalErrorForInitialSession);
          setError(finalErrorForInitialSession);
          setUserProfile(null);
          setSession(null); 
          setUser(null);    
          localStorage.removeItem("userProfile");
      } finally {
          setLoading(false);
          console.log("[useAuth] getInitialSession: Bloque finally. Carga establecida a false.");
          isProcessingAuthEvent.current = false;
      }
    };

    getInitialSession();
  }, [fetchUserProfile]); 


  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (authChangeEvent, newSession) => {
      console.log(`[useAuth] onAuthStateChange: Evento ${String(authChangeEvent)} recibido. Nuevo ID de usuario de sesión: ${newSession?.user?.id}`);
      
      if (isProcessingAuthEvent.current) {
        console.log(`[useAuth] onAuthStateChange: Evento ${String(authChangeEvent)} omitido debido a un procesamiento de autenticación en curso.`);
        return;
      }
      isProcessingAuthEvent.current = true;
      
      const currentLocalProfile = userProfileRef.current;
      const currentLocalSession = sessionRef.current;

      if (currentLocalProfile && currentLocalSession && newSession?.user &&
          (authChangeEvent === 'SIGNED_IN' || authChangeEvent === 'TOKEN_REFRESHED' || authChangeEvent === 'USER_UPDATED')) {
          
          console.log(`[useAuth] onAuthStateChange: Actualización de perfil en segundo plano para usuario ${newSession.user.id}. ID de perfil actual: ${currentLocalProfile.id}`);
          try {
              setSession(newSession); 
              setUser(newSession.user);

              const refreshedProfile = await fetchUserProfile(newSession.user.id);
              if (refreshedProfile && refreshedProfile.empleado?.estado === 'activo') {
                  setUserProfile(refreshedProfile);
                  localStorage.setItem("userProfile", JSON.stringify(refreshedProfile));
              } else if (refreshedProfile && refreshedProfile.empleado?.estado !== 'activo') {
                  console.warn("[useAuth] onAuthStateChange (segundo plano): Usuario se volvió inactivo. Cerrando sesión.");
                  throw new Error("Usuario inactivo. Contacte al administrador."); 
              } else if (!refreshedProfile) {
                  console.warn(`[useAuth] onAuthStateChange (segundo plano): Perfil para usuario ${newSession.user.id} no encontrado. Manteniendo perfil actual. Esto podría indicar un problema de datos.`);
                  setError(new Error("No se pudo actualizar la información más reciente del perfil. Se utilizarán los datos locales."));
              }
          } catch (backgroundError) {
              const bgError = backgroundError instanceof Error ? backgroundError : new Error(String(backgroundError));
              console.warn(`[useAuth] onAuthStateChange (segundo plano): Error actualizando perfil: ${bgError.message}.`);
              if(bgError.message.includes("Usuario inactivo")){ 
                  setError(bgError);
                  setUserProfile(null); setSession(null); setUser(null); localStorage.removeItem("userProfile");
              } else {
                  setError(new Error(`No se pudo actualizar su perfil en este momento (${bgError.message}). Se está utilizando la información local.`));
              }
          } finally {
              isProcessingAuthEvent.current = false;
              console.log(`[useAuth] onAuthStateChange (segundo plano): Evento ${String(authChangeEvent)} procesado.`);
          }
      } else { 
          console.log(`[useAuth] onAuthStateChange: Procesamiento completo para evento ${String(authChangeEvent)}.`);
          setLoading(true);
          setError(null); 
          let authStateChangeReasonForHandler = "Perfil de usuario no encontrado o carga fallida tras cambio de estado.";
          try {
              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (newSession?.user) {
                  const profile = await fetchUserProfile(newSession.user.id);
                  if (profile && profile.empleado?.estado === 'activo') {
                      setUserProfile(profile);
                      localStorage.setItem("userProfile", JSON.stringify(profile));
                  } else {
                      authStateChangeReasonForHandler = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacte al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo tras cambio de estado.") : authStateChangeReasonForHandler;
                      console.warn(`[useAuth] onAuthStateChange (completo): ${authStateChangeReasonForHandler}`);
                      throw new Error(authStateChangeReasonForHandler);
                  }
              } else { 
                  setUserProfile(null);
                  localStorage.removeItem("userProfile");
              }
          } catch (e) {
              let finalErrorForAuthStateChange: Error;
              if (e instanceof Error) {
                  finalErrorForAuthStateChange = e;
              } else {
                  finalErrorForAuthStateChange = new Error(String(e || "Error desconocido durante el cambio de estado de autenticación."));
              }
              console.error("[useAuth] Error durante el procesamiento de onAuthStateChange (completo):", finalErrorForAuthStateChange.message, finalErrorForAuthStateChange);
              setError(finalErrorForAuthStateChange);
              setUserProfile(null); setSession(null); setUser(null); localStorage.removeItem("userProfile");
          } finally {
              setLoading(false);
              isProcessingAuthEvent.current = false;
              console.log(`[useAuth] onAuthStateChange (completo): Evento ${String(authChangeEvent)} procesado. Carga establecida a false.`);
          }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
      isProcessingAuthEvent.current = false; 
    };
  }, [fetchUserProfile]); 

  const login = async (email: string, password: string) => {
    if (isProcessingAuthEvent.current) {
        console.warn("[useAuth] login: Intento mientras otro evento de autenticación estaba en proceso.");
        throw new Error("Procesamiento de autenticación en curso. Intente de nuevo en un momento.");
    }
    isProcessingAuthEvent.current = true;
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Error de inicio de sesión (directo de Supabase):", signInError.message, signInError);
        throw signInError; 
      }
    } catch (e) {
      let caughtLoginError: Error;
      if (e instanceof Error) {
        caughtLoginError = e;
      } else {
        caughtLoginError = new Error(String(e || "Error desconocido durante el inicio de sesión."));
      }
      console.error("Error de inicio de sesión (captura del hook):", caughtLoginError.message, caughtLoginError);

      let finalErrorToThrow: Error;
      if ((e as AuthError).status === 400 || caughtLoginError.message.includes("Invalid login credentials")) {
        finalErrorToThrow = new Error("Credenciales inválidas. Por favor, verifica tu email y contraseña.");
      } else {
        finalErrorToThrow = caughtLoginError;
      }
      
      setError(finalErrorToThrow);
      setUserProfile(null); 
      setSession(null);
      setUser(null);
      localStorage.removeItem("userProfile");
      throw finalErrorToThrow;
    } finally {
      setLoading(false); 
      isProcessingAuthEvent.current = false;
    }
  };

  const logout = async () => {
    if (isProcessingAuthEvent.current && sessionRef.current === null) { 
        console.warn("[useAuth] logout: Intento mientras otro evento de autenticación estaba en proceso Y la sesión ya es nula. Limpiando estado.");
        setSession(null); setUser(null); setUserProfile(null); localStorage.removeItem("userProfile"); setLoading(false); setError(null);
        isProcessingAuthEvent.current = false; 
        return;
    }
    isProcessingAuthEvent.current = true; 

    setLoading(true); 
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("[useAuth] logout: Error durante supabase.auth.signOut():", signOutError.message);
        throw signOutError; 
      }
      setSession(null);
      setUser(null);
      setUserProfile(null); 
      localStorage.removeItem("userProfile"); 
    } catch (e) {
      let caughtLogoutError: Error;
       if (e instanceof Error) {
        caughtLogoutError = e;
      } else {
        caughtLogoutError = new Error(String(e || "Error desconocido durante el cierre de sesión."));
      }
      console.error("[useAuth] logout: Bloque catch. Error:", caughtLogoutError.message, caughtLogoutError);
      setError(caughtLogoutError);
      setSession(null);
      setUser(null);
      setUserProfile(null);
      localStorage.removeItem("userProfile");
    } finally {
      setLoading(false); 
      isProcessingAuthEvent.current = false; 
    }
  };

  return { session, user, userProfile, loading, error, login, logout };
}
