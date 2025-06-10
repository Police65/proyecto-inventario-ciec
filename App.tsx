import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import { AuthenticatedLayout } from './components/core/Layout'; 
import Login from './components/auth/Login';
import MainDashboardPage from './pages/MainDashboardPage'; 
import HomePage from './pages/HomePage'; 
import { AdminDashboardPage } from './pages/AdminDashboardPage'; 
import UserRequestsPage from './pages/UserRequestsPage'; 
import RequestFormPage from './pages/RequestFormPage';
import InventoryPage from './pages/InventoryPage';

import LoadingSpinner from './components/core/LoadingSpinner';

const App: React.FC = () => {
  const { userProfile, loading, error, logout } = useAuth();

  if (loading && !error) { 
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
              </AuthenticatedLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="home" element={<MainDashboardPage />} /> 
          
          <Route path="admin-stats-dashboard" element={userProfile?.rol === 'admin' ? <HomePage /> : <Navigate to="/home" replace />} />
          <Route path="user-activity-summary" element={userProfile?.rol === 'usuario' ? <HomePage /> : <Navigate to="/home" replace />} />

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

          {userProfile?.rol === 'admin' && (
            <>
              <Route path="inventory/*" element={<InventoryPage />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;