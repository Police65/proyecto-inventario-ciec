
import React from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserProfile } from '../../types';
import { 
  HomeIcon, ListBulletIcon, ClockIcon, DocumentTextIcon, ArchiveBoxIcon, UsersIcon, BuildingStorefrontIcon, PlusCircleIcon, Cog6ToothIcon, CircleStackIcon, SquaresPlusIcon, BuildingLibraryIcon, ArrowRightOnRectangleIcon, ChartPieIcon, UserCircleIcon as UserSummaryIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isVisible: boolean;
  userProfile: UserProfile | null;
  pendingRequestsCount: number;
  onNewRequestClick: () => void;
  onSelectTab: (tab: string) => void;
  onLogout: () => void; 
  activeUITab: string; 
  setHasInteracted: (interacted: boolean) => void; 
}

interface NavItem {
  to?: string; 
  onClick?: () => void; 
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
  userOnly?: boolean;
  tabKey?: string; 
  badgeCount?: number;
  isExternalLink?: boolean;
  subItems?: NavItem[];
  isActionButton?: boolean; 
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible, userProfile, pendingRequestsCount, onNewRequestClick, onSelectTab, onLogout, activeUITab, setHasInteracted }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const handleNavigation = (action: () => void) => {
    setHasInteracted(true);
    action();
  };

  const navItems: NavItem[] = [
    { 
      onClick: () => handleNavigation(() => navigate('/home')), 
      icon: HomeIcon, 
      label: 'Menú Principal' 
    },
    { 
      onClick: () => handleNavigation(() => navigate('/admin-stats-dashboard')), 
      icon: ChartPieIcon, 
      label: 'Dashboard Admin',
      adminOnly: true 
    },
    { 
      onClick: () => handleNavigation(() => navigate('/user-activity-summary')), 
      icon: UserSummaryIcon, 
      label: 'Mi Resumen',
      userOnly: true 
    },
    { 
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('solicitudes');
      }), 
      icon: ListBulletIcon, 
      label: 'Solicitudes', 
      tabKey: 'solicitudes', 
      badgeCount: userProfile?.rol === 'usuario' ? pendingRequestsCount : undefined
    },
    { 
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('historial-solicitudes');
      }),
      icon: ClockIcon, 
      label: 'Historial Solicitudes', 
      tabKey: 'historial-solicitudes'
    },
    { 
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('ordenes');
      }),
      icon: DocumentTextIcon, 
      label: 'Historial Órdenes', 
      adminOnly: true,
      tabKey: 'ordenes'
    },
    { 
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('ordenes-consolidadas');
      }),
      icon: ArchiveBoxIcon, 
      label: 'Órdenes Consolidadas', 
      adminOnly: true,
      tabKey: 'ordenes-consolidadas'
    },
    { 
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('usuarios');
      }),
      icon: UsersIcon, 
      label: 'Gestión de Usuarios', 
      adminOnly: true,
      tabKey: 'usuarios'
    },
    { 
      onClick: () => handleNavigation(() => navigate('/inventory')), 
      icon: BuildingStorefrontIcon, 
      label: 'Gestión de Inventario', 
      adminOnly: true,
    },
  ];
  
  const actionItems: NavItem[] = [
     { 
      onClick: () => {
        onLogout(); // No necesita handleNavigation ya que cierra sesión
      }, 
      icon: ArrowRightOnRectangleIcon, 
      label: 'Cerrar sesión',
      isActionButton: true 
    },
  ];

  const renderNavItem = (item: NavItem, index: number, isSubItem: boolean = false) => {
    if (item.adminOnly && userProfile?.rol !== 'admin') return null;
    if (item.userOnly && userProfile?.rol !== 'usuario') return null;

    let calculatedIsActive = false;
    if (item.tabKey) {
      // Activo si estamos en /solicitudes Y la pestaña activa coincide
      calculatedIsActive = currentPath.includes('/solicitudes') && activeUITab === item.tabKey;
    } else if (item.to && (item.to === '/inventory' || item.to === '/external-events')) { 
        // Para rutas con subrutas, verificar si la ruta actual *comienza* con la ruta del item
        calculatedIsActive = currentPath.startsWith(item.to);
    } else if (item.to) {
      // Para rutas exactas
      calculatedIsActive = currentPath === item.to;
    } else if (item.onClick) { 
        // Casos especiales para rutas que no tienen 'to' pero sí 'onClick' y son páginas principales
        if (item.label === "Menú Principal" && currentPath === '/home') calculatedIsActive = true;
        if (item.label === "Dashboard Admin" && currentPath === '/admin-stats-dashboard') calculatedIsActive = true;
        if (item.label === "Mi Resumen" && currentPath === '/user-activity-summary') calculatedIsActive = true;
    }
    
    const baseClasses = `flex items-center px-3 py-3 text-sm rounded-lg transition-colors duration-150 w-full text-left`;
    const activeClasses = 'bg-primary-500 text-white font-semibold';
    const inactiveClasses = item.isActionButton 
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-700 dark:hover:text-red-300' 
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700';
    
    const linkClasses = `${baseClasses} ${calculatedIsActive ? activeClasses : inactiveClasses} ${isSubItem ? 'pl-10' : 'pl-4'}`;

    const content = (
      <>
        <item.icon className={`w-5 h-5 mr-3 ${calculatedIsActive && !item.isActionButton ? 'text-white' : (item.isActionButton ? '' : 'text-gray-500 dark:text-gray-400')}`} />
        <span className="truncate">{item.label}</span>
        {item.badgeCount !== undefined && item.badgeCount > 0 && (
          <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
            {item.badgeCount}
          </span>
        )}
      </>
    );

    return (
      <li key={item.label + index} className="my-1">
        {item.onClick ? (
           <button onClick={item.onClick} className={linkClasses}>
            {content}
          </button>
        ) : null} 
      </li>
    );
  };

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-40 flex-shrink-0 w-64 overflow-y-auto bg-white dark:bg-gray-800 border-r dark:border-gray-700 transform transition-transform duration-300 ease-in-out 
        ${isVisible ? 'translate-x-0 shadow-lg' : '-translate-x-full'}
      `}
      aria-label="Barra lateral principal"
      aria-hidden={!isVisible}
    >
      <div className="py-4 text-gray-500 dark:text-gray-400 flex flex-col h-full">
        <div>
          <button onClick={() => handleNavigation(() => navigate('/home'))} className="ml-6 text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center hover:text-primary-600 dark:hover:text-primary-400">
            <Cog6ToothIcon className="w-7 h-7 mr-2 text-primary-500"/>
            RequiSoftware
          </button>
          <nav className="mt-8 px-3" aria-label="Navegación principal">
            <ul>
              {navItems.map((item, index) => renderNavItem(item, index))}
            </ul>
          </nav>
        </div>
        
        <div className="mt-auto px-3 pb-4"> 
           {userProfile?.rol === 'usuario' && (
            <div className="px-3 my-6">
              <button
                onClick={() => handleNavigation(onNewRequestClick)}
                className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium leading-5 text-white transition-colors duration-150 bg-primary-600 border border-transparent rounded-lg active:bg-primary-600 hover:bg-primary-700 focus:outline-none focus:shadow-outline-primary"
              >
                <PlusCircleIcon className="w-5 h-5 mr-2" />
                Nueva Solicitud
              </button>
            </div>
          )}
          <ul aria-label="Acciones de cuenta">
            {actionItems.map((item, index) => renderNavItem(item, index))}
          </ul>
        </div>
      </div>
    </aside>
  );
};

export { Sidebar }; // Exportar como nombrado
export default Sidebar;