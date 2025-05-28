import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import { AuthenticatedLayout } from './components/core/Layout';
import Login from './components/auth/Login';
import { HomePage } from './pages/HomePage'; // Changed to named import
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { UserRequestsPage } from './pages/UserRequestsPage'; // Changed to named import
import { RequestFormPage } from './pages/RequestFormPage'; // Changed to named import
import { InventoryPage } from './pages/InventoryPage'; // Changed to named import

import LoadingSpinner from './components/core/LoadingSpinner';

const App: React.FC = () => {
  const { userProfile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner message="Cargando aplicación..." size="lg" />
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!userProfile ? <Login /> : <Navigate to="/home" replace />} />

        <Route
          path="/*"
          element={
            userProfile ? (
              <AuthenticatedLayout userProfile={userProfile} onLogout={logout}>
                {/* Outlet is implicitly handled by defining nested routes below */}
              </AuthenticatedLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Routes accessible only when authenticated and rendered within AuthenticatedLayout */}
          <Route path="home" element={<HomePage />} />
          
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
          
          <Route path="new-request" element={userProfile?.rol === 'usuario' ? <RequestFormPage /> : <Navigate to="/home" replace />} />

          {/* Admin-only routes */}
          {userProfile?.rol === 'admin' && (
            <>
              <Route path="inventory/*" element={<InventoryPage />} />
            </>
          )}

          {/* Fallback for any other authenticated route not matched above */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;