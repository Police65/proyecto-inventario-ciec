import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ViewInventory from '../components/inventory/ViewInventory';
import ProductManagement from '../components/inventory/ProductManagement';
import ProviderManagement from '../components/inventory/ProviderManagement';
import InventoryStats from '../components/inventory/InventoryStats';
import DetailedStats from '../components/inventory/DetailedStats';
import AIInsights from '../components/ai/AIInsights';
import { HomeIcon, CircleStackIcon, SquaresPlusIcon, BuildingLibraryIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline';

const InventoryPage: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { key: "dashboard", path: "/inventory", label: "Dashboard Inventario", icon: HomeIcon },
    { key: "view", path: "/inventory/view", label: "Ver Inventario", icon: CircleStackIcon },
    { key: "add-product", path: "/inventory/add-product", label: "Productos", icon: SquaresPlusIcon },
    { key: "add-provider", path: "/inventory/add-provider", label: "Proveedores", icon: BuildingLibraryIcon },
    { key: "stats", path: "/inventory/stats", label: "Estadísticas Detalladas", icon: ChartBarIcon },
    { key: "ai-insights", path: "/inventory/ai-insights", label: "Análisis IA", icon: SparklesIcon },
  ];
  
  return (
    <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-6">
      <nav className="lg:w-1/4 xl:w-1/5 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 h-fit">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 dark:border-gray-700">Navegación Inventario</h2>
        <ul className="space-y-2">
          {navLinks.map(link => {
            const isActive = link.path === "/inventory"
              ? (location.pathname === "/inventory" || location.pathname === "/inventory/")
              : location.pathname === link.path;
            
            return (
              <li key={link.key}>
                <Link
                  to={link.path} 
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-primary-500 text-white' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  <link.icon className="w-5 h-5 mr-3" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <Routes>
          <Route index element={<InventoryDashboardContent />} />
          <Route path="view" element={<ViewInventory />} />
          <Route path="add-product" element={<ProductManagement />} />
          <Route path="add-provider" element={<ProviderManagement />} />
          <Route path="stats" element={<DetailedStats />} />
          <Route path="ai-insights" element={<AIInsights />} />
        </Routes>
      </div>
    </div>
  );
};


const InventoryDashboardContent: React.FC = () => (
  <div>
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard de Inventario</h1>
    <InventoryStats />
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Estadísticas Clave</h2>
            <DetailedStats />
        </div>
        <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Análisis con IA</h2>
             <AIInsights />
        </div>
    </div>
  </div>
);

export default InventoryPage;