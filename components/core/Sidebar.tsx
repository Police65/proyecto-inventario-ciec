import React from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserProfile, SolicitudCompra } from '../../types';
import { 
  HomeIcon, ListBulletIcon, ClockIcon, DocumentTextIcon, ArchiveBoxIcon, UsersIcon, BuildingStorefrontIcon, PlusCircleIcon, Cog6ToothIcon, CircleStackIcon, SquaresPlusIcon, BuildingLibraryIcon, ArrowRightOnRectangleIcon, ChartPieIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isVisible: boolean;
  userProfile: UserProfile | null;
  pendingRequestsCount: number;
  onNewRequestClick: () => void;
  onSelectTab: (tab: string) => void;
  onLogout: () => void; 
  activeUITab: string; // Added to determine active tab for specific routes
}

interface NavItem {
  to?: string; // Optional for buttons like logout
  onClick?: () => void; // For buttons like logout
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
  userOnly?: boolean;
  tabKey?: string; 
  badgeCount?: number;
  isExternalLink?: boolean;
  subItems?: NavItem[];
  isActionButton?: boolean; // To style logout differently if needed
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible, userProfile, pendingRequestsCount, onNewRequestClick, onSelectTab, onLogout, activeUITab }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const navItems: NavItem[] = [
    { to: '/home', icon: HomeIcon, label: 'Inicio' },
    { 
      to: '/solicitudes', 
      icon: ListBulletIcon, 
      label: 'Solicitudes', 
      tabKey: 'solicitudes', // For Admin: pending requests tab; For User: their pending requests
      badgeCount: userProfile?.rol === 'usuario' ? pendingRequestsCount : undefined
    },
    { 
      to: '/solicitudes', 
      icon: ClockIcon, 
      label: 'Historial Solicitudes', // For Admin: approved/rejected; For User: their history
      tabKey: 'historial-solicitudes'
    },
    // { // Removed Mis Estadísticas
    //   to: '/mis-estadisticas',
    //   icon: ChartPieIcon,
    //   label: 'Mis Estadísticas',
    //   userOnly: true, 
    // },
    // Admin specific items
    { 
      to: '/solicitudes', 
      icon: DocumentTextIcon, 
      label: 'Historial Órdenes', 
      adminOnly: true,
      tabKey: 'ordenes'
    },
    { 
      to: '/solicitudes', 
      icon: ArchiveBoxIcon, 
      label: 'Órdenes Consolidadas', 
      adminOnly: true,
      tabKey: 'ordenes-consolidadas'
    },
    { 
      to: '/solicitudes', 
      icon: UsersIcon, 
      label: 'Gestión de Usuarios', 
      adminOnly: true,
      tabKey: 'usuarios'
    },
    { 
      to: '/inventory', 
      icon: BuildingStorefrontIcon, 
      label: 'Gestión de Inventario', 
      adminOnly: true,
      subItems: [
        { to: '/inventory/view', icon: CircleStackIcon, label: 'Ver Inventario', adminOnly: true },
        { to: '/inventory/add-product', icon: SquaresPlusIcon, label: 'Añadir Producto', adminOnly: true },
        { to: '/inventory/add-provider', icon: BuildingLibraryIcon, label: 'Añadir Proveedor', adminOnly: true },
      ]
    },
  ];
  
  const actionItems: NavItem[] = [
     { 
      onClick: () => {
        onLogout();
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
    if (item.tabKey && item.to) {
      // For items that manage tabs on a page (e.g., different views under /solicitudes)
      calculatedIsActive = currentPath === item.to && activeUITab === item.tabKey;
    } else if (item.to === '/inventory' && item.subItems && item.subItems.length > 0) {
      // For the parent "Gestión de Inventario" item
      calculatedIsActive = currentPath.startsWith(item.to);
    } else if (item.to) {
      // For simple direct links (e.g., /home or sub-items like /inventory/view)
      calculatedIsActive = currentPath === item.to;
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
        ) : item.tabKey ? (
          <button 
            onClick={() => {
              if (item.to && currentPath !== item.to) {
                navigate(item.to); 
              }
              onSelectTab(item.tabKey!); 
            }} 
            className={linkClasses}
          >
            {content}
          </button>
        ) : item.to ? (
          <Link to={item.to} className={linkClasses} >
            {content}
          </Link>
        ) : null}
        {item.subItems && item.subItems.length > 0 && (
          <ul className="mt-1 space-y-1">
            {item.subItems.map((subItem, subIndex) => renderNavItem(subItem, subIndex, true))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-20 flex-shrink-0 w-64 overflow-y-auto bg-white dark:bg-gray-800 border-r dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Barra lateral principal"
    >
      <div className="py-4 text-gray-500 dark:text-gray-400 flex flex-col h-full">
        <div>
          <Link to="/home" className="ml-6 text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center">
            <Cog6ToothIcon className="w-7 h-7 mr-2 text-primary-500"/>
            RequiSoftware
          </Link>
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
                onClick={onNewRequestClick}
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

export default Sidebar;
