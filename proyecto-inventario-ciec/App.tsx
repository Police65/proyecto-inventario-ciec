
import React from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'; // Outlet ya no se importa aquí directamente
import { useAuth } from './hooks/useAuth';

import { AuthenticatedLayout } from './components/core/Layout'; 
import Login from './components/auth/Login';
import MainDashboardPage from './pages/MainDashboardPage'; 
import HomePage from './pages/HomePage'; 
import { AdminDashboardPage } from './pages/AdminDashboardPage'; 
import { UserRequestsPage } from './pages/UserRequestsPage'; 
import RequestFormPage from './pages/RequestFormPage';
import InventoryPage from './pages/InventoryPage';
import ExternalEventsPage from './pages/ExternalEventsPage'; // Página para eventos externos

import LoadingSpinner from './components/core/LoadingSpinner';

const App: React.FC = () => {
  const { session, userProfile, loading, error, logout } = useAuth();

  // Mientras se verifica el estado de autenticación inicial, mostrar spinner.
  if (loading) { 
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner message="Cargando aplicación..." size="lg" />
      </div>
    );
  }

  // Nuevo estado de error: si hay sesión pero el perfil no se pudo cargar, es un error crítico para el usuario.
  if (session && !userProfile && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-center p-4">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Error al Cargar Perfil</h1>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
              Hay una sesión activa, pero no se pudo cargar su perfil de usuario. Esto puede deberse a un problema de conexión o de configuración de la cuenta.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Error: {error.message}</p>
          <div className="flex space-x-4 mt-6">
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
                  Recargar Página
              </button>
              <button onClick={logout} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                  Cerrar Sesión
              </button>
          </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        {/* Ruta de Login: si no hay sesión, muestra Login. Si la hay, redirige a /home. */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/home" replace />} />

        {/* Rutas Protegidas: requieren sesión y perfil de usuario válidos. */}
        <Route
          path="/*" // Cualquier otra ruta no definida explícitamente arriba
          element={
            session && userProfile ? (
              // Si hay sesión y perfil, renderiza el Layout Autenticado.
              <AuthenticatedLayout userProfile={userProfile} onLogout={logout} />
            ) : (
              // Si no hay sesión, redirige a login. El caso de sesión sin perfil ya fue manejado.
              <Navigate to="/login" replace /> 
            )
          }
        >
          {/* Rutas anidadas que se renderizarán dentro de AuthenticatedLayout */}
          <Route path="home" element={<MainDashboardPage />} /> 
          
          {/* Rutas específicas por rol, usando el perfil del usuario para condicionales */}
          <Route 
            path="admin-stats-dashboard" 
            element={userProfile?.rol === 'admin' ? <HomePage /> : <Navigate to="/home" replace />} 
          />
          <Route 
            path="user-activity-summary" 
            element={userProfile?.rol === 'usuario' ? <HomePage /> : <Navigate to="/home" replace />} 
          />

          <Route 
            path="solicitudes" 
            element={
              userProfile?.rol === 'admin' 
                ? <AdminDashboardPage /> 
                : (userProfile?.rol === 'usuario' 
                    ? <UserRequestsPage /> 
                    : <Navigate to="/home" replace />) 
            } 
          />
          
          <Route 
            path="new-request" 
            element={userProfile?.rol === 'usuario' ? <RequestFormPage /> : <Navigate to="/home" replace />} 
          />

          {/* Rutas solo para admin */}
          {userProfile?.rol === 'admin' && (
            <>
              <Route path="inventory/*" element={<InventoryPage />} /> 
              <Route path="external-events" element={<ExternalEventsPage />} />
            </>
          )}

          {/* Redirección por defecto para cualquier otra ruta autenticada no reconocida */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
