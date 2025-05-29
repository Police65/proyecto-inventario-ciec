import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { UserProfile, Empleado, Departamento, UserProfileRol } from '../types';

interface AuthHookResult {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const checkStoredSession = (): UserProfile | null => {
  const storedUser = localStorage.getItem("userProfile");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser) as UserProfile;
      if (parsedUser.id && parsedUser.rol) { 
        return parsedUser;
      }
    } catch (e) {
      console.error("Failed to parse stored user profile:", e instanceof Error ? e.message : String(e));
      localStorage.removeItem("userProfile");
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

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: basicProfileData, error: rawBasicProfileError } = await supabase
        .from("user_profile")
        .select(`
          id,
          rol,
          empleado_id,
          departamento_id,
          departamento:departamento_id (id, nombre)
        `)
        .eq("id", userId)
        .single();

      if (rawBasicProfileError) {
        const codePart = rawBasicProfileError.code ? `(Code: ${rawBasicProfileError.code})` : '';
        const detailsPart = rawBasicProfileError.details ? `Details: ${rawBasicProfileError.details}` : '';
        console.error(`Error fetching basic user profile: ${rawBasicProfileError.message} ${codePart} ${detailsPart}`, rawBasicProfileError);
        setError(new Error(`Error al obtener perfil base: ${rawBasicProfileError.message} ${codePart}`.trim()));
        return null;
      }

      if (!basicProfileData) {
        console.warn("No basic user profile found for ID:", userId);
        setError(new Error("Perfil de usuario base no encontrado."));
        return null;
      }
      
     
      let completeProfile: UserProfile = {
        id: basicProfileData.id,
        rol: basicProfileData.rol as UserProfileRol | null,
        empleado_id: basicProfileData.empleado_id,
        departamento_id: basicProfileData.departamento_id,
        departamento: basicProfileData.departamento ? {
             id: basicProfileData.departamento.id,
             nombre: basicProfileData.departamento.nombre,
        } : undefined,
        empleado: undefined, 
      };

      if (completeProfile.empleado_id) {
        const { data: empleadoData, error: rawEmpleadoError } = await supabase
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

        if (rawEmpleadoError) {
          const codePart = rawEmpleadoError.code ? `(Code: ${rawEmpleadoError.code})` : '';
          const detailsPart = rawEmpleadoError.details ? `Details: ${rawEmpleadoError.details}` : '';
          console.error(`Error fetching empleado details: ${rawEmpleadoError.message} ${codePart} ${detailsPart}`, rawEmpleadoError);
          
          return completeProfile; 
        }
        if (empleadoData) {
          completeProfile.empleado = empleadoData;
        } else {
            console.warn(`No empleado found for empleado_id: ${completeProfile.empleado_id} associated with user ${userId}`);
        }
      }
      
      return completeProfile;

    } catch (e) {
      let localErrorMessage = "Unknown error in fetchUserProfile";
      if (e instanceof Error) {
        localErrorMessage = e.message;
      } else {
        localErrorMessage = String(e);
      }
      console.error(`fetchUserProfile caught error: ${localErrorMessage}`, e);
      setError(e instanceof Error ? e : new Error(localErrorMessage));
      return null;
    }
  }, []);


  useEffect(() => {
    const getInitialSession = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Error in getInitialSession (getSession):", sessionError.message, sessionError);
          setError(sessionError);
     
          return; 
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user.id);
          let loginAbortedReason = "Perfil de usuario no encontrado."; 
          if (profile && profile.empleado?.estado === 'activo') {
            setUserProfile(profile);
            localStorage.setItem("userProfile", JSON.stringify(profile));
          } else {
             loginAbortedReason = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacta al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo.") : "Perfil de usuario no encontrado.";
             console.warn(`Login aborted: ${loginAbortedReason}`);
             setError(new Error(loginAbortedReason));
             if(currentSession) await supabase.auth.signOut(); 
             setUserProfile(null);
             localStorage.removeItem("userProfile");
          }
        } else {
          const stored = checkStoredSession();
          if (stored && stored.empleado?.estado === 'activo') { // Also check stored user activity
             setUserProfile(stored); 
          } else {
             if(stored && stored.empleado?.estado !== 'activo') {
                console.warn("Stored user session is inactive. Clearing.");
                localStorage.removeItem("userProfile");
             }
             setUserProfile(null); 
          }
        }
      } catch (e) {
          console.error("Critical error in getInitialSession:", e);
          setError(e instanceof Error ? e : new Error(String(e)));
          setUserProfile(null); 
          localStorage.removeItem("userProfile");
      } finally {
          setLoading(false);
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setLoading(true);
      setError(null); 
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const profile = await fetchUserProfile(newSession.user.id);
        let authStateChangeReason = "Perfil de usuario no encontrado tras cambio de estado."; 
         if (profile && profile.empleado?.estado === 'activo') {
          setUserProfile(profile);
          localStorage.setItem("userProfile", JSON.stringify(profile));
        } else {
          authStateChangeReason = profile ? (profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacta al administrador." : "Perfil de usuario no encontrado, incompleto o empleado inactivo tras cambio de estado.") : "Perfil de usuario no encontrado tras cambio de estado.";
          console.warn(`Auth state change: ${authStateChangeReason}`);
          setUserProfile(null);
          localStorage.removeItem("userProfile");
          if (profile && profile.empleado?.estado === 'inactivo') {
            setError(new Error("Usuario inactivo. Contacta al administrador."));
          } else if (!profile && newSession?.user) { 
            setError(new Error(authStateChangeReason));
          }
        }
      } else { 
        setUserProfile(null);
        localStorage.removeItem("userProfile");
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchUserProfile]); 

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Sign-in error:", signInError.message, signInError);
        throw signInError;
      }
      if (!data.user) throw new Error("Login failed, user object not returned.");
      
      const profile = await fetchUserProfile(data.user.id); 
      if (!profile) {
        await supabase.auth.signOut(); 
        throw new Error("Perfil de usuario no encontrado.");
      }
      if (profile.empleado?.estado !== 'activo') {
        await supabase.auth.signOut(); 
        throw new Error(profile.empleado?.estado === 'inactivo' ? "Usuario inactivo. Contacta al administrador." : "El empleado asociado al perfil no está activo.");
      }
     
      setUserProfile(profile); 
      localStorage.setItem("userProfile", JSON.stringify(profile));
 

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Login error hook:", errorMessage, e);
      const displayMessage = errorMessage.includes("Invalid login credentials") ? "Credenciales inválidas. Por favor, verifica tu email y contraseña." : errorMessage;
      setError(new Error(displayMessage));
      setUserProfile(null); 
      localStorage.removeItem("userProfile");
      throw e; 
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Logout error:", signOutError.message, signOutError);
        throw signOutError;
      }
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Logout error:", errorMessage, e);
      setError(e instanceof Error ? e : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  return { session, user, userProfile, loading, error, login, logout };
}
