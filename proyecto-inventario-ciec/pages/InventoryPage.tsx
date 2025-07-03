import React from 'react';
// @ts-ignore
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import ViewInventory from '../components/inventory/ViewInventory';
import ProductManagement from '../components/inventory/ProductManagement';
import ProviderManagement from '../components/inventory/ProviderManagement';
import InventoryStats from '../components/inventory/InventoryStats'; // Estadísticas generales para el panel
import DetailedStats from '../components/inventory/DetailedStats';
import { AIInsights } from '../components/ai/AIInsights';
import { HomeIcon, CircleStackIcon, SquaresPlusIcon, BuildingLibraryIcon, ChartBarIcon, SparklesIcon, ArrowRightIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
// ExternalEventsPage ya no se enruta dentro de InventoryPage, sino que se enlaza a una ruta raíz

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, description, icon: Icon, path, color = 'bg-primary-500' }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="group bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex flex-col justify-between items-start w-full text-left h-full"
      aria-label={`Acceder a ${title}`}
    >
      <div>
        <div className={`p-3 rounded-lg ${color} text-white inline-block mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {description}
        </p>
      </div>
      <div className="flex items-center text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:underline mt-auto pt-1">
        Ir a la sección
        <ArrowRightIcon className="w-3 h-3 ml-1.5 transform group-hover:translate-x-0.5 transition-transform duration-300" />
      </div>
    </button>
  );
};


// Contenido para la ruta principal /inventory (ruta índice)
const InventoryDashboardContent: React.FC = () => {
  const dashboardCards: DashboardCardProps[] = [
    {
      title: "Ver Inventario",
      description: "Consulta el estado actual de todos los productos en el inventario.",
      icon: CircleStackIcon,
      path: "/inventory/view",
      color: "bg-blue-500",
    },
    {
      title: "Gestionar Productos",
      description: "Añade, edita o elimina productos del catálogo general.",
      icon: SquaresPlusIcon,
      path: "/inventory/add-product",
      color: "bg-green-500",
    },
    {
      title: "Gestionar Proveedores",
      description: "Administra la información y categorías de tus proveedores.",
      icon: BuildingLibraryIcon,
      path: "/inventory/add-provider",
      color: "bg-yellow-500",
    },
    {
      title: "Estadísticas Detalladas",
      description: "Visualiza gráficos de gastos, consumo y tendencias de productos.",
      icon: ChartBarIcon,
      path: "/inventory/stats",
      color: "bg-purple-500",
    },
    {
      title: "Análisis con IA",
      description: "Obtén perspectivas inteligentes sobre gastos, proveedores y consumo.",
      icon: SparklesIcon,
      path: "/inventory/ai-insights",
      color: "bg-pink-500",
    },
    { 
      title: "Eventos Externos",
      description: "Visualiza eventos y registra el consumo asociado de productos.",
      icon: GlobeAltIcon,
      path: "/external-events", // Esta ruta es absoluta, definida en App.tsx
      color: "bg-cyan-500",
    },
  ];

  return (
  <div>
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Panel de Control de Inventario</h1>
    <p className="text-gray-600 dark:text-gray-400 mb-6">
      Resumen general del estado del inventario y accesos directos a las funcionalidades clave.
    </p>
    <InventoryStats /> {/* Tarjetas de estadísticas generales en la parte superior */}
    
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Secciones de Gestión</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardCards.map(card => <DashboardCard key={card.path} {...card} />)}
      </div>
    </div>
  </div>
  );
};


const InventoryPage: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { key: "dashboard", path: "/inventory", label: "Panel Principal", icon: HomeIcon },
    { key: "view", path: "/inventory/view", label: "Ver Inventario", icon: CircleStackIcon },
    { key: "add-product", path: "/inventory/add-product", label: "Productos", icon: SquaresPlusIcon },
    { key: "add-provider", path: "/inventory/add-provider", label: "Proveedores", icon: BuildingLibraryIcon },
    { key: "stats", path: "/inventory/stats", label: "Estadísticas Detalladas", icon: ChartBarIcon },
    { key: "ai-insights", path: "/inventory/ai-insights", label: "Análisis IA", icon: SparklesIcon },
    { key: "external-events", path: "/external-events", label: "Eventos Externos", icon: GlobeAltIcon }, // Enlace a la página de eventos externos a nivel raíz
  ];
  
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[max-content_1fr] space-y-6 lg:space-y-0 lg:gap-x-6 h-full">
      <nav className="lg:w-64 xl:w-72 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 h-fit lg:h-full lg:overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 dark:border-gray-700">Navegación Inventario</h2>
        <ul className="space-y-1.5">
          {navLinks.map(link => {
            // Lógica para determinar si el enlace está activo:
            // Para "/inventory", está activo si la ruta actual es exactamente "/inventory" o "/inventory/".
            // Para "/external-events", está activo si la ruta actual es exactamente "/external-events".
            // Para otras sub-rutas de /inventory (ej. "/inventory/view"), está activo si la ruta actual comienza con link.path.
            const isActive = 
              link.path === "/inventory" 
                ? (location.pathname === "/inventory" || location.pathname === "/inventory/") 
                : link.path === "/external-events"
                  ? location.pathname === "/external-events"
                  : location.pathname.startsWith(link.path);
            
            return (
              <li key={link.key}>
                <Link
                  to={link.path} 
                  className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-primary-600 text-white shadow-sm' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  <link.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 bg-transparent p-0 md:p-0 lg:p-0 min-w-0">
        <Routes>
          <Route index element={<InventoryDashboardContent />} />
          <Route path="view" element={<ViewInventory />} />
          <Route path="add-product" element={<ProductManagement />} />
          <Route path="add-provider" element={<ProviderManagement />} />
          <Route path="stats" element={<DetailedStats />} />
          <Route path="ai-insights" element={<AIInsights />} />
          {/* Nota: La ruta para ExternalEventsPage se maneja en App.tsx a nivel raíz */}
          {/* Este componente InventoryPage no renderiza ExternalEventsPage directamente a través de sus Routes */}
        </Routes>
      </div>
    </div>
  );
};

export default InventoryPage;
