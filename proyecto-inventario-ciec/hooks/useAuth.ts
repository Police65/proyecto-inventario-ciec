import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User, PostgrestSingleResponse, PostgrestError, AuthError } from '@supabase/supabase-js';
import { UserProfile, Empleado, UserProfileRol } from '../types';

const USER_PROFILE_FETCH_TIMEOUT_MS = 30000;
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

export function useAuth(): AuthHookResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Iniciar en estado de carga hasta que se determine el estado de autenticación inicial
  const [error, setError] = useState<Error | null>(null);

  const fetchUserProfile = useCallback(async (userId: string, userEmail?: string | null): Promise<UserProfile | null> => {
    type SelectedUserProfileData = {
      id: string;
      rol: UserProfileRol | null;
      empleado_id: number | null;
      departamento_id: number | null;
      departamento: { id: number; nombre: string } | null;
    };

    try {
      const userProfileQuery = supabase
        .from("user_profile")
        .select(`id, rol, empleado_id, departamento_id, departamento:departamento_id(id, nombre)`)
        .eq("id", userId)
        .single<SelectedUserProfileData>();
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: La obtención del perfil básico del usuario tardó demasiado.")), USER_PROFILE_FETCH_TIMEOUT_MS)
      );

      const { data: basicProfileData, error: rawBasicProfileError } = await Promise.race([
        userProfileQuery,
        timeoutPromise,
      ]);

      if (rawBasicProfileError) {
        throw rawBasicProfileError;
      }

      if (!basicProfileData) {
        return null;
      }

      const completeProfile: UserProfile = {
        id: basicProfileData.id,
        email: userEmail || undefined,
        rol: basicProfileData.rol,
        empleado_id: basicProfileData.empleado_id,
        departamento_id: basicProfileData.departamento_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departamento: basicProfileData.departamento ? {
          ...basicProfileData.departamento,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } : undefined,
        empleado: undefined,
      };

      if (completeProfile.empleado_id) {
        const empleadoQuery = supabase
          .from("empleado")
          .select(`id, estado, nombre, apellido, departamento_id, cargo_actual_id, cedula, firma, telefono`)
          .eq("id", completeProfile.empleado_id)
          .single<Partial<Empleado>>();

        const timeoutPromiseEmpleado = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: La obtención de detalles del empleado tardó demasiado.")), INTERNAL_QUERY_TIMEOUT_MS)
        );

        const { data: empleadoData, error: rawEmpleadoError } = await Promise.race([
          empleadoQuery,
          timeoutPromiseEmpleado,
        ]);

        if (rawEmpleadoError) {
          console.error(`[useAuth] Error al obtener detalles del empleado:`, rawEmpleadoError);
        } else if (empleadoData) {
          completeProfile.empleado = {
            ...empleadoData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Empleado;
        }
      }
      return completeProfile;
    } catch (e) {
      console.error(`[useAuth] fetchUserProfile: Error procesando perfil para usuario ${userId}.`, e);
      throw e;
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange es la única fuente de verdad para los cambios de autenticación.
    // Dispara un evento 'INITIAL_SESSION' al cargar la página, que maneja la verificación inicial.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[useAuth] onAuthStateChange event: '${event}'`);

      if (currentSession) {
        // Este bloque maneja SIGNED_IN y INITIAL_SESSION (si existe una sesión)
        setSession(currentSession);
        setUser(currentSession.user);

        // Se busca el perfil del usuario.
        try {
          const profile = await fetchUserProfile(currentSession.user.id, currentSession.user.email);
          if (profile?.empleado?.estado === 'activo') {
            setUserProfile(profile);
            localStorage.setItem("userProfile", JSON.stringify(profile));
            setError(null);
          } else {
            const reason = profile ? "Su cuenta de empleado está inactiva." : "No se encontró un perfil de usuario válido.";
            setError(new Error(reason));
            setUserProfile(null);
            localStorage.removeItem("userProfile");
          }
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError : new Error("No se pudo cargar su perfil de usuario."));
          setUserProfile(null);
          localStorage.removeItem("userProfile");
        } finally {
            // CRITICAL FIX: Set loading to false only after the profile fetch attempt is complete.
            // This prevents a race condition in App.tsx where session is set but profile is not,
            // which was causing an infinite redirect loop.
            setLoading(false);
        }
      } else {
        // Este bloque maneja SIGNED_OUT y INITIAL_SESSION (si no existe sesión)
        setSession(null);
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem("userProfile");
        setError(null);
        setLoading(false); // Finish loading when no session is found.
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]); // El array de dependencias SOLO debe contener 'fetchUserProfile' que es estable.

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // El éxito es manejado por onAuthStateChange.
    } catch (e) {
      const authError = e as AuthError;
      const errorMessage = authError.message.includes("Invalid login credentials")
        ? "Credenciales inválidas. Por favor, verifica tu email y contraseña."
        : authError.message || "Error desconocido durante el inicio de sesión.";
      setError(new Error(errorMessage));
      setLoading(false); // Establecer manualmente la carga a falso en caso de fallo de inicio de sesión
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      // onAuthStateChange se encargará de la limpieza del estado.
    } catch (e) {
      const error = e as Error;
      setError(error);
      setLoading(false); // Establecer manualmente la carga a falso en caso de fallo al cerrar sesión
    }
  };

  return { session, user, userProfile, loading, error, login, logout };
}
