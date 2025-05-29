import React from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import { AuthenticatedLayout } from './components/core/Layout'; 
import Login from './components/auth/Login';
import HomePage from './pages/HomePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage'; 
import UserRequestsPage from './pages/UserRequestsPage'; 
import RequestFormPage from './pages/RequestFormPage';
import InventoryPage from './pages/InventoryPage';


import LoadingSpinner from './components/core/LoadingSpinner';


const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
    <p className="mt-2 text-gray-600 dark:text-gray-400">Esta página está en construcción.</p>
  </div>
);


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
                {/* Outlet will render nested routes here */}
              </AuthenticatedLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Routes accessible only when authenticated */}
          <Route path="home" element={<HomePage />} />
          
          {/* Conditional routing for /solicitudes */}
          <Route 
            path="solicitudes" 
            element={
              userProfile?.rol === 'admin' 
                ? <AdminDashboardPage /> 
                : (userProfile?.rol === 'usuario' 
                    ? <UserRequestsPage /> 
                    : <Navigate to="/home" replace />) // Fallback if role is undefined
            } 
          />
          
          <Route path="new-request" element={userProfile?.rol === 'usuario' ? <RequestFormPage /> : <Navigate to="/home" replace />} />
          {/* <Route path="mis-estadisticas" element={userProfile?.rol === 'usuario' ? <UserStatsPage /> : <Navigate to="/home" replace />} /> */}


          {/* Admin-only routes */}
          {userProfile?.rol === 'admin' && (
            <>
              <Route path="inventory/*" element={<InventoryPage />} />
              {/* UserManagement is part of AdminDashboardPage or its own route */}
              {/* <Route path="user-management" element={<UserManagementPage />} />  */}
            </>
          )}

          {/* Fallback for any other authenticated route */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;