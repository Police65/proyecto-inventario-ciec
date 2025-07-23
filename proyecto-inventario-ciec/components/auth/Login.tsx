
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth'; 
// @ts-ignore: useNavigate is no longer used for redirection, but keeping import just in case, or remove if linting complains.
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { LIGHT_MODE_LOGO_URL, DARK_MODE_LOGO_URL } from '../../assets/paths';


const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // The main App component now handles all redirection logic based on session state.
  // This simplifies the Login component and prevents race conditions.
  const { login: authLogin } = useAuth(); 

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authLogin(email, password);
      // Navigation is now handled declaratively in App.tsx based on session state change.
      // This prevents race conditions where navigation occurred before the auth state was fully propagated.
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Error de inicio de sesión. Verifica tus credenciales.");
      } else {
        setError("Ocurrió un error desconocido durante el inicio de sesión.");
      }
      console.error("Falló el inicio de sesión (componente Login):", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-2xl">
        <div>
          {/* Logos dinámicos */}
          <img
              className="mx-auto h-16 w-auto block dark:hidden"
              src={LIGHT_MODE_LOGO_URL}
              alt="Logo RequiSoftware"
          />
          <img
              className="mx-auto h-16 w-auto hidden dark:block"
              src={DARK_MODE_LOGO_URL}
              alt="Logo RequiSoftware"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Accede a tu cuenta de RequiSoftware
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && ( // Mostrar mensaje de error si existe
            <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
              <p>{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px"> {/* Contenedor para inputs */}
            <div>
              <label htmlFor="email-address" className="sr-only"> {/* Etiqueta para accesibilidad */}
                Correo Electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Correo Electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingrese su correo electrónico.')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
            </div>
            <div className="relative"> {/* Contenedor para input de contraseña y botón de mostrar/ocultar */}
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"} // Cambiar tipo para mostrar/ocultar
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingrese su contraseña.')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
              <button
                type="button" // Evitar que envíe el formulario
                onClick={() => setShowPassword(!showPassword)} // Alternar visibilidad
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Recordarme {/* Funcionalidad de "Recordarme" podría requerir lógica adicional con localStorage/cookies */}
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                ¿Olvidaste tu contraseña? {/* Enlace a recuperación de contraseña (no implementado) */}
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading} // Deshabilitar si está cargando
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:bg-primary-300 dark:disabled:bg-primary-800"
            >
              {loading ? ( // Mostrar ícono de carga si `loading` es true
                <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
              ) : (
                "Ingresar"
              )}
            </button>
          </div>
        </form>
         <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Cámara de Industriales del Estado Carabobo. Todos los derechos reservados.
          </p>
      </div>
    </div>
  );
};

export default Login;
