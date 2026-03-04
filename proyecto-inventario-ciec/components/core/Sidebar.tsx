import React from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserProfile } from '../../types';
import {
  HomeIcon, ListBulletIcon, ClockIcon, DocumentTextIcon, ArchiveBoxIcon, UsersIcon, BuildingStorefrontIcon, PlusCircleIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, ChartPieIcon, UserCircleIcon as UserSummaryIcon, BuildingOffice2Icon
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
  tourId?: string;
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
      badgeCount: userProfile?.rol === 'usuario' ? pendingRequestsCount : undefined,
      tourId: 'sidebar-pending-requests' // ID for user tour
    },
    {
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('historial-solicitudes');
      }),
      icon: ClockIcon,
      label: 'Historial Solicitudes',
      tabKey: 'historial-solicitudes',
      tourId: 'sidebar-history-requests' // ID for user tour
    },
    {
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('mis-solicitudes');
      }),
      icon: UserSummaryIcon,
      label: 'Mis Solicitudes',
      adminOnly: true,
      tabKey: 'mis-solicitudes'
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
      tabKey: 'usuarios',
      tourId: 'sidebar-user-management' // ID for admin tour
    },
    {
      onClick: () => handleNavigation(() => {
        if (currentPath !== '/solicitudes') navigate('/solicitudes');
        onSelectTab('departamentos');
      }),
      icon: BuildingOffice2Icon,
      label: 'Gestión Deptos.',
      adminOnly: true,
      tabKey: 'departamentos'
    },
    {
      onClick: () => handleNavigation(() => navigate('/inventory')),
      icon: BuildingStorefrontIcon,
      label: 'Gestión de Inventario',
      adminOnly: true,
      tourId: 'sidebar-inventory-management' // ID for admin tour
    },
    {
      to: '/products',
      icon: ArchiveBoxIcon,
      label: 'Catálogo de Productos',
      userOnly: true,
    },
    {
      to: '/suppliers',
      icon: BuildingStorefrontIcon,
      label: 'Proveedores',
      userOnly: true,
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
    } else if (item.to && (item.to === '/inventory' || item.to === '/external-events' || item.to === '/suppliers' || item.to === '/products')) {
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

    const baseClasses = `flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-150 w-full text-left`;
    const activeClasses = 'bg-primary-500 text-white font-semibold';
    const inactiveClasses = item.isActionButton
      ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100';

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
      <li key={item.label + index} className="my-1" data-tour-id={item.tourId}>
        {item.to ? (
          <Link to={item.to} onClick={() => handleNavigation(() => { })} className={linkClasses}>
            {content}
          </Link>
        ) : item.onClick ? (
          <button onClick={item.onClick} className={linkClasses}>
            {content}
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex-shrink-0 w-64 overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-in-out 
        ${isVisible ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}
      aria-label="Barra lateral principal"
      aria-hidden={!isVisible}
    >
      <div className="py-4 text-gray-500 dark:text-gray-400 flex flex-col h-full">
        <div className="px-6 py-8">
          <button onClick={() => handleNavigation(() => navigate('/home'))} className="text-xl font-display font-black tracking-tight text-slate-800 dark:text-white flex items-center group transition-all duration-300">
            <div className="p-2 bg-primary-600 rounded-xl mr-3 shadow-lg shadow-primary-500/30 group-hover:rotate-12 transition-transform">
              <Cog6ToothIcon className="w-6 h-6 text-white" />
            </div>
            <span>RequiSoftware</span>
          </button>
        </div>
        <nav className="mt-8 px-3" aria-label="Navegación principal">
          <ul>
            {navItems.map((item, index) => renderNavItem(item, index))}
          </ul>
        </nav>
      </div>

      <div className="mt-auto px-3 pb-4">
        {(userProfile?.rol === 'usuario' || userProfile?.rol === 'admin') && (
          <div className="px-3 my-6" data-tour-id="sidebar-new-request">
            <button
              onClick={() => handleNavigation(onNewRequestClick)}
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold leading-5 text-white transition-all duration-300 bg-primary-600 border border-transparent rounded-2xl shadow-lg shadow-primary-500/25 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-95"
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
    </aside>
  );
};

export { Sidebar }; // Exportar como nombrado
export default Sidebar;