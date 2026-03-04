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
  setHasInteracted: (interacted: boolean) => void; // Añadir setHasInteracted
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
    className="group bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none dark:border dark:border-slate-800 rounded-3xl p-8 hover:shadow-2xl hover:shadow-primary-500/10 transform hover:-translate-y-2 transition-all duration-500 ease-out flex flex-col justify-between items-start w-full text-left h-full active:scale-[0.98] relative overflow-hidden"
    aria-label={`Acceder a ${title}`}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/20 dark:bg-primary-900/10 blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/20 transition-colors duration-500" />
    <div className="relative z-10 w-full">
      <div className={`p-4 rounded-2xl ${color} text-white inline-block mb-6 shadow-lg shadow-current/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title}
      </h3>
      <p className="text-base text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
        {description}
      </p>
    </div>
    <div className="relative z-10 flex items-center text-sm font-bold text-primary-600 dark:text-primary-400 group-hover:underline mt-auto pt-4 border-t border-slate-50 dark:border-slate-800/50 w-full">
      <span className="uppercase tracking-widest">Acceder</span>
      <ArrowRightIcon className="w-4 h-4 ml-2 transform group-hover:translate-x-2 transition-transform duration-500" />
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
      title: 'Crear Solicitud',
      description: 'Genera una nueva solicitud de compra para tu departamento.',
      icon: PlusCircleIcon,
      onClick: () => handleNavigation('/new-request'),
      color: 'bg-green-500',
    },
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
      color: 'bg-teal-500', // Changed color for better distinction
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
      title: 'Crear Solicitud de Readquisición',
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
    <div className="space-y-10 h-full flex flex-col py-4 animate-slide-up">
      <div className="relative">
        <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight">
          ¡Hola, <span className="text-primary-600 dark:text-primary-400">{userProfile?.empleado?.nombre || 'Usuario'}</span>!
        </h1>
        <p className="mt-3 text-xl text-slate-600 dark:text-slate-400 max-w-2xl font-light">
          {userProfile?.rol === 'admin' ? 'Sistema de Readquisición: Órdenes de Compra, Gestión de Inventario y Proveedores' : 'Te damos la bienvenida a tu portal de gestión de compras.'}
        </p>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary-100/30 dark:bg-primary-900/20 blur-3xl -z-10 rounded-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow"> {/* Añadido flex-grow */}
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