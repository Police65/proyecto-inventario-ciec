import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { UserProfile, Empleado, UserProfileRol } from '../types';

interface AuthHookResult {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Se mueve fuera del hook para asegurar que sea una función estable y no se recree en cada render.
const fetchUserProfile = async (userId: string, userEmail?: string | null): Promise<UserProfile | null> => {
  const fetchPromise = (async () => {
    try {
      type SelectedUserProfileData = {
        id: string;
        rol: UserProfileRol | null;
        empleado_id: number | null;
        departamento_id: number | null;
        departamento: { id: number; nombre: string; estado: 'activo' | 'inactivo'; } | null;
      };

      const { data: basicProfileData, error: rawBasicProfileError } = await supabase
        .from("user_profile")
        .select(`id, rol, empleado_id, departamento_id, departamento:departamento_id(id, nombre, estado)`)
        .eq("id", userId)
        .single<SelectedUserProfileData>();

      if (rawBasicProfileError) throw rawBasicProfileError;
      if (!basicProfileData) return null;
      
      const completeProfile: UserProfile = {
        id: basicProfileData.id, email: userEmail || undefined, rol: basicProfileData.rol,
        empleado_id: basicProfileData.empleado_id, departamento_id: basicProfileData.departamento_id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        departamento: basicProfileData.departamento ? {
          ...basicProfileData.departamento,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        } : undefined,
        empleado: undefined,
      };

      if (completeProfile.empleado_id) {
        const { data: empleadoData, error: rawEmpleadoError } = await supabase
          .from("empleado")
          .select(`id, estado, nombre, apellido, departamento_id, cargo_actual_id, cedula, firma, telefono`)
          .eq("id", completeProfile.empleado_id)
          .single<Partial<Empleado>>();

        if (rawEmpleadoError) console.error(`[useAuth] Error al obtener detalles del empleado:`, rawEmpleadoError);
        else if (empleadoData) completeProfile.empleado = { ...empleadoData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Empleado;
      }
      return completeProfile;
    } catch (e: any) {
        console.error(`[useAuth] fetchUserProfile (dentro de Promise.race): Error procesando perfil para usuario ${userId}.`, e);
        throw e;
    }
  })();

  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("La obtención del perfil de usuario tardó demasiado. Por favor, recargue la página.")), 60000)
  );

  try {
      return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
      console.error(`[useAuth] fetchUserProfile: Error o timeout procesando perfil para usuario ${userId}.`, e);
      throw e;
  }
};


export function useAuth(): AuthHookResult {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // EFECTO 1: Manejar cambios de estado de autenticación de Supabase.
  // Su única responsabilidad es mantener el estado `session` sincronizado.
  useEffect(() => {
    // Para la carga inicial, obtenemos la sesión inmediatamente.
    // Esto evita un parpadeo y acelera la carga.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      // El segundo efecto se encargará de la lógica de carga y perfil.
    });

    // Escuchamos cambios futuros (login, logout, refresh de token).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(`[useAuth] onAuthStateChange event: '${_event}'`);
      setSession(session);
    });

    // Limpieza al desmontar el componente.
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // EFECTO 2: Reaccionar a los cambios en `session`.
  // Se encarga de buscar el perfil de usuario y gestionar los estados de carga y error.
  useEffect(() => {
    // Si hay una sesión, intentamos buscar el perfil del usuario.
    if (session?.user) {
      // Solo mostramos el spinner de carga si aún no tenemos un perfil para este usuario.
      // Esto previene un parpadeo de "cargando" durante un simple refresco de token.
      if (!userProfile || userProfile.id !== session.user.id) {
          setLoading(true);
      }
      setError(null);
      
      fetchUserProfile(session.user.id, session.user.email)
        .then(profile => {
          if (profile?.empleado?.estado === 'activo') {
            setUserProfile(profile);
            sessionStorage.setItem("userProfile", JSON.stringify(profile));
            setError(null); // Limpiar errores previos
          } else {
            const reason = profile ? "Su cuenta de empleado está inactiva." : "No se encontró un perfil de usuario válido.";
            setError(new Error(reason));
            setUserProfile(null);
            sessionStorage.removeItem("userProfile");
          }
        })
        .catch(fetchError => {
          setError(fetchError instanceof Error ? fetchError : new Error("No se pudo cargar su perfil de usuario."));
          setUserProfile(null);
          sessionStorage.removeItem("userProfile");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // Si no hay sesión (logout o sesión expirada), limpiamos el perfil y detenemos la carga.
      setUserProfile(null);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // Este efecto depende únicamente del objeto `session`.

  const user = session?.user ?? null;

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // La actualización de estado se manejará por el listener de onAuthStateChange.
    } catch (e) {
      const authError = e as AuthError;
      const errorMessage = authError.message.includes("Invalid login credentials")
        ? "Credenciales inválidas. Por favor, verifica tu email y contraseña."
        : authError.message || "Error desconocido durante el inicio de sesión.";
      setError(new Error(errorMessage));
      setLoading(false); 
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
       // La limpieza de estado se manejará por el listener de onAuthStateChange.
    } catch (e) {
      const error = e as Error;
      setError(error);
    } finally {
        setLoading(false);
    }
  };

  return { session, user, userProfile, loading, error, login, logout };
}