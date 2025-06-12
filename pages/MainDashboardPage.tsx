
import React from 'react';
// @ts-ignore
import { useOutletContext, useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import {
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  ChartPieIcon,
  PlusCircleIcon,
  EnvelopeOpenIcon,
  ClockIcon,
  UserCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface MainDashboardContext {
  userProfile: UserProfile;
  setActiveUITab: (tab: string) => void;
  setHasInteracted: (interacted: boolean) => void; // Add setHasInteracted
}

interface MenuCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  color?: string; 
}

const MenuCard: React.FC<MenuCardProps> = ({ title, description, icon: Icon, onClick, color = 'bg-primary-500' }) => (
  <button
    onClick={onClick}
    className="group bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex flex-col justify-between items-start w-full text-left h-full" // Added h-full
    aria-label={`Acceder a ${title}`}
  >
    <div>
      <div className={`p-3 rounded-lg ${color} text-white inline-block mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {description}
      </p>
    </div>
    <div className="flex items-center text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline mt-auto pt-2"> {/* Added mt-auto and pt-2 for spacing */}
      Acceder
      <ArrowRightIcon className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" />
    </div>
  </button>
);

const MainDashboardPage: React.FC = () => {
  const { userProfile, setActiveUITab, setHasInteracted } = useOutletContext<MainDashboardContext>();
  const navigate = useNavigate();

  const handleNavigation = (path: string, tab?: string) => {
    setHasInteracted(true);
    if (tab) {
      setActiveUITab(tab);
    }
    navigate(path);
  };

  const adminMenuItems: MenuCardProps[] = [
    {
      title: 'Gestionar Solicitudes',
      description: 'Revisa, aprueba o rechaza solicitudes de compra pendientes.',
      icon: ClipboardDocumentListIcon,
      onClick: () => handleNavigation('/solicitudes', 'solicitudes'),
      color: 'bg-yellow-500',
    },
    {
      title: 'Historial de Órdenes',
      description: 'Consulta todas las órdenes de compra generadas y su estado.',
      icon: ArchiveBoxIcon,
      onClick: () => handleNavigation('/solicitudes', 'ordenes'),
      color: 'bg-blue-500',
    },
    {
      title: 'Gestión de Inventario',
      description: 'Administra productos, proveedores y visualiza el inventario.',
      icon: BuildingStorefrontIcon,
      onClick: () => handleNavigation('/inventory'),
      color: 'bg-green-500',
    },
    {
      title: 'Gestión de Usuarios',
      description: 'Administra empleados y sus perfiles de acceso al sistema.',
      icon: UsersIcon,
      onClick: () => handleNavigation('/solicitudes', 'usuarios'),
      color: 'bg-purple-500',
    },
    {
      title: 'Dashboard Administrativo',
      description: 'Visualiza estadísticas globales y resúmenes de actividad.',
      icon: ChartPieIcon,
      onClick: () => handleNavigation('/admin-stats-dashboard'),
      color: 'bg-indigo-500',
    },
  ];

  const userMenuItems: MenuCardProps[] = [
    {
      title: 'Crear Nueva Solicitud',
      description: 'Genera una nueva solicitud de compra de productos o servicios.',
      icon: PlusCircleIcon,
      onClick: () => handleNavigation('/new-request'),
      color: 'bg-green-500',
    },
    {
      title: 'Mis Solicitudes Pendientes',
      description: 'Revisa el estado de tus solicitudes de compra enviadas.',
      icon: EnvelopeOpenIcon,
      onClick: () => handleNavigation('/solicitudes', 'solicitudes'),
      color: 'bg-yellow-500',
    },
    {
      title: 'Mi Historial de Solicitudes',
      description: 'Consulta tus solicitudes aprobadas y rechazadas.',
      icon: ClockIcon,
      onClick: () => handleNavigation('/solicitudes', 'historial-solicitudes'),
      color: 'bg-blue-500',
    },
    {
      title: 'Mi Resumen de Actividad',
      description: 'Visualiza tus estadísticas personales y datos relevantes.',
      icon: UserCircleIcon,
      onClick: () => handleNavigation('/user-activity-summary'),
      color: 'bg-indigo-500',
    },
  ];

  const menuItems = userProfile?.rol === 'admin' ? adminMenuItems : userMenuItems;

  return (
    <div className="space-y-8 h-full flex flex-col"> {/* Ensure h-full and flex for content */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          ¡Bienvenido, {userProfile?.empleado?.nombre || 'Usuario'}!
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          {userProfile?.rol === 'admin' ? 'Panel de Administración RequiSoftware' : 'Sistema de Gestión de Compras RequiSoftware'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow"> {/* Added flex-grow */}
        {menuItems.map((item) => (
          <MenuCard
            key={item.title}
            title={item.title}
            description={item.description}
            icon={item.icon}
            onClick={item.onClick}
            color={item.color}
          />
        ))}
      </div>
    </div>
  );
};

export default MainDashboardPage;