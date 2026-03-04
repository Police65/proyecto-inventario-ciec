
import React from 'react';
// @ts-ignore
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import ViewInventory from '../components/inventory/ViewInventory';
import ProductManagement from '../components/inventory/ProductManagement';
import ProviderManagement from '../components/inventory/ProviderManagement';
import InventoryStats from '../components/inventory/InventoryStats'; // Estadísticas generales para el panel
import DetailedStats from '../components/inventory/DetailedStats';
import ConsumptionRegistry from '../components/inventory/ConsumptionRegistry'; // Nueva importación
import { AIInsights } from '../components/ai/AIInsights';
import { HomeIcon, CircleStackIcon, SquaresPlusIcon, BuildingLibraryIcon, ChartBarIcon, SparklesIcon, ArrowRightIcon, GlobeAltIcon, ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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
      className="group bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800 rounded-3xl p-8 hover:shadow-2xl hover:shadow-primary-500/10 transform hover:-translate-y-2 transition-all duration-500 ease-out flex flex-col justify-between items-start w-full text-left h-full active:scale-[0.98] relative overflow-hidden"
      aria-label={`Acceder a ${title}`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-100/20 dark:bg-primary-900/10 blur-3xl -mr-12 -mt-12 group-hover:bg-primary-500/20 transition-colors duration-500" />
      <div className="relative z-10 w-full">
        <div className={`p-4 rounded-2xl ${color} text-white inline-block mb-6 shadow-lg shadow-current/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>
      </div>
      <div className="relative z-10 flex items-center text-[10px] uppercase tracking-widest font-black text-primary-600 dark:text-primary-400 group-hover:underline mt-auto pt-4 border-t border-slate-50 dark:border-slate-800/50 w-full">
        Acceder
        <ArrowRightIcon className="w-3 h-3 ml-2 transform group-hover:translate-x-1 transition-transform duration-500" />
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
      title: "Registrar Consumo",
      description: "Registra salidas de productos para uso interno o eventos externos.",
      icon: ArrowDownTrayIcon,
      path: "/inventory/consumption",
      color: "bg-orange-500",
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
  const [isNavOpen, setIsNavOpen] = React.useState(false);

  const navLinks = [
    { key: "dashboard", path: "/inventory", label: "Panel Principal", icon: HomeIcon },
    { key: "consumption", path: "/inventory/consumption", label: "Registrar Consumo", icon: ArrowDownTrayIcon },
    { key: "view", path: "/inventory/view", label: "Ver Inventario", icon: CircleStackIcon },
    { key: "add-product", path: "/inventory/add-product", label: "Productos", icon: SquaresPlusIcon },
    { key: "add-provider", path: "/inventory/add-provider", label: "Proveedores", icon: BuildingLibraryIcon },
    { key: "stats", path: "/inventory/stats", label: "Estadísticas Detalladas", icon: ChartBarIcon },
    { key: "ai-insights", path: "/inventory/ai-insights", label: "Análisis IA", icon: SparklesIcon },
    { key: "external-events", path: "/external-events", label: "Eventos Externos", icon: GlobeAltIcon },
  ];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[max-content_1fr] space-y-6 lg:space-y-0 lg:gap-x-6 h-full">
      <nav className={`bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-fit transition-all duration-500 ease-in-out ${isNavOpen ? 'lg:w-64 xl:w-72' : 'lg:w-auto'}`}>
        <button
          onClick={() => setIsNavOpen(!isNavOpen)}
          className="w-full flex items-center justify-between group focus:outline-none mb-2"
        >
          <h2 className="text-sm font-display font-black text-slate-900 dark:text-white uppercase tracking-wider group-hover:text-primary-600 transition-colors">Navegación</h2>
          <div className={`p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-all duration-300 ${isNavOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>

        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isNavOpen ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
          <ul className="space-y-2">
            {navLinks.map(link => {
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
                    className={`flex items-center px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300
                      ${isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25 translate-x-1'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <link.icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="flex-1 bg-transparent p-0 md:p-0 lg:p-0 min-w-0">
        <Routes>
          <Route index element={<InventoryDashboardContent />} />
          <Route path="view" element={<ViewInventory />} />
          <Route path="consumption" element={<ConsumptionRegistry />} /> {/* Nueva Ruta */}
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
