import React from 'react';
import { SolicitudCompra, OrdenCompra } from '../../types';
import { CheckCircleIcon, ClockIcon, DocumentTextIcon, TruckIcon, XCircleIcon, ArchiveBoxIcon } from '@heroicons/react/24/solid';

interface TimelineItem {
  title: string;
  date?: string | null;
  status: 'completed' | 'current' | 'upcoming' | 'rejected';
  icon: React.ElementType;
}

interface RequestStatusTimelineProps {
  request: SolicitudCompra;
  order: Pick<OrdenCompra, 'id' | 'fecha_orden' | 'estado' | 'fecha_entrega_real' | 'updated_at'> | null;
}

const RequestStatusTimeline: React.FC<RequestStatusTimelineProps> = ({ request, order }) => {
  const items: TimelineItem[] = [];

  // 1. Solicitud Enviada
  items.push({
    title: 'Solicitud Enviada',
    date: request.fecha_solicitud ? new Date(request.fecha_solicitud).toLocaleString('es-VE') : null,
    status: 'completed',
    icon: DocumentTextIcon,
  });
  
  // 2. Aprobación / Rechazo
  if (request.estado === 'Rechazada') {
    items.push({
      title: 'Solicitud Rechazada',
      date: request.updated_at ? new Date(request.updated_at).toLocaleString('es-VE') : null,
      status: 'rejected',
      icon: XCircleIcon,
    });
  } else {
    items.push({
      title: 'Solicitud Aprobada',
      date: order?.fecha_orden ? new Date(order.fecha_orden).toLocaleString('es-VE') : (request.estado === 'Aprobada' ? new Date(request.updated_at).toLocaleString('es-VE') : null),
      status: request.estado === 'Aprobada' || !!order ? 'completed' : 'upcoming',
      icon: CheckCircleIcon,
    });
  }
  
  // 3. Orden de Compra Generada (Solo si no fue rechazada)
  if (request.estado !== 'Rechazada') {
    items.push({
      title: order ? `Orden de Compra #${order.id} Generada` : 'Generación de Orden de Compra',
      date: order?.fecha_orden ? new Date(order.fecha_orden).toLocaleString('es-VE') : null,
      status: !!order ? 'completed' : 'upcoming',
      icon: ArchiveBoxIcon,
    });
  }
  
  // 4. Orden Completada (Solo si hay orden)
  if (order) {
    items.push({
      title: 'Orden Completada / Productos Recibidos',
      date: order.estado === 'Completada' ? (order.fecha_entrega_real ? new Date(order.fecha_entrega_real).toLocaleString('es-VE') : new Date(order.updated_at).toLocaleString('es-VE')) : null,
      status: order.estado === 'Completada' ? 'completed' : 'upcoming',
      icon: TruckIcon,
    });
  }

  const getStatusClasses = (status: TimelineItem['status'], isLast: boolean) => {
    let classes = {
      iconBg: 'bg-gray-300 dark:bg-gray-600',
      iconText: 'text-gray-600 dark:text-gray-400',
      titleText: 'text-gray-500 dark:text-gray-400',
      dateText: 'text-gray-400 dark:text-gray-500',
      line: 'bg-gray-300 dark:bg-gray-600'
    };
    if (status === 'completed') {
      classes = {
        iconBg: 'bg-green-500', iconText: 'text-white',
        titleText: 'text-gray-800 dark:text-white font-semibold',
        dateText: 'text-gray-500 dark:text-gray-400',
        line: 'bg-green-500'
      };
    } else if (status === 'rejected') {
        classes = {
        iconBg: 'bg-red-500', iconText: 'text-white',
        titleText: 'text-gray-800 dark:text-white font-semibold',
        dateText: 'text-gray-500 dark:text-gray-400',
        line: 'bg-red-500'
      };
    } else if (status === 'current') {
        classes = {
        iconBg: 'bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-700', iconText: 'text-white',
        titleText: 'text-blue-600 dark:text-blue-400 font-semibold',
        dateText: 'text-gray-500 dark:text-gray-400',
        line: 'bg-gray-300 dark:bg-gray-600'
      };
    }
    
    if (isLast) {
      classes.line = 'bg-transparent';
    }

    return classes;
  };


  return (
    <div>
        <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mt-4 mb-3">Línea de Tiempo del Proceso</h4>
        <ol className="relative border-l border-gray-300 dark:border-gray-600">
        {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const { iconBg, iconText, titleText, dateText, line } = getStatusClasses(item.status, isLast);
            const Icon = item.icon;

            return (
            <li key={index} className="mb-6 ml-6">
                <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${iconBg}`}>
                    <Icon className={`w-5 h-5 ${iconText}`} />
                </span>
                <div className={`absolute w-0.5 h-full top-10 -left-[13px] ${line}`} />
                <h5 className={`text-base ${titleText}`}>{item.title}</h5>
                {item.date && (
                <p className={`text-sm ${dateText} flex items-center`}>
                    <ClockIcon className="w-4 h-4 mr-1.5"/>
                    {item.date}
                </p>
                )}
            </li>
            );
        })}
        </ol>
    </div>
  );
};

export default RequestStatusTimeline;
