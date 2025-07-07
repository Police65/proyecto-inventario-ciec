
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'; // Outlet ya no se importa aquí directamente
import { useAuth } from './hooks/useAuth';

import { AuthenticatedLayout } from './components/core/Layout'; 
import Login from './components/auth/Login';
import MainDashboardPage from './pages/MainDashboardPage'; 
import HomePage from './pages/HomePage'; 
import { AdminDashboardPage } from './pages/AdminDashboardPage'; 
import UserRequestsPage from './pages/UserRequestsPage'; 
import RequestFormPage from './pages/RequestFormPage';
import InventoryPage from './pages/InventoryPage';
import ExternalEventsPage from './pages/ExternalEventsPage'; // Página para eventos externos

import LoadingSpinner from './components/core/LoadingSpinner';

const App: React.FC = () => {
  const { userProfile, loading, error, logout } = useAuth();

  // Mientras se verifica el estado de autenticación y no hay error, mostrar spinner.
  if (loading && !error) { 
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner message="Cargando aplicación..." size="lg" />
      </div>
    );
  }
  // Si hay un error durante la carga inicial de autenticación (ej. Supabase no disponible),
  // se podría mostrar un mensaje de error global aquí antes de intentar renderizar rutas.
  // if (error && !userProfile) { ... } -> Esto se maneja mejor en ErrorBoundary o Login si es un error de credenciales.

  return (
    <HashRouter>
      <Routes>
        {/* Ruta de Login: si no hay perfil de usuario, muestra Login, sino redirige a /home */}
        <Route path="/login" element={!userProfile ? <Login /> : <Navigate to="/home" replace />} />

        {/* Rutas Protegidas: requieren un perfil de usuario válido. */}
        {/* AuthenticatedLayout ahora maneja el Outlet para sus rutas anidadas. */}
        <Route
          path="/*" // Cualquier otra ruta no definida explícitamente arriba
          element={
            userProfile ? (
              // Si hay perfil, renderiza el Layout Autenticado que a su vez contiene el Outlet para rutas hijas.
              <AuthenticatedLayout userProfile={userProfile} onLogout={logout} />
            ) : (
              // Si no hay perfil, redirige a login.
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
                    // Caso improbable: usuario autenticado pero sin rol admin/usuario asignado correctamente.
                    // Idealmente, esto se manejaría en la lógica de login o perfil para asignar un rol por defecto o mostrar error.
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
              {/* InventoryPage ahora maneja sus propias sub-rutas con <Routes> anidadas */}
              <Route path="inventory/*" element={<InventoryPage />} /> 
              <Route path="external-events" element={<ExternalEventsPage />} />
              {/* Aquí se podrían añadir más rutas solo para admin, por ejemplo: */}
              {/* <Route path="provider-performance" element={<ProviderPerformancePage />} /> */}
            </>
          )}

          {/* Redirección por defecto para cualquier otra ruta autenticada no reconocida */}
          {/* Esto asegura que si se entra a una ruta como /app/ruta-inexistente, se redirija a /home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;