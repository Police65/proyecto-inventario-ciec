
import React from 'react';
import { SolicitudCompra, SolicitudCompraEstado } from '../../types';
import { CheckCircleIcon, XCircleIcon, EyeIcon, DocumentMagnifyingGlassIcon, DocumentDuplicateIcon, TruckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

interface RequestTableProps {
  requests: SolicitudCompra[];
  withActions?: boolean; // Para acciones de admin (Aprobar/Rechazar)
  userActions?: boolean; // Para acciones de usuario (Clonar)
  onApprove?: (request: SolicitudCompra) => void;
  onReject?: (requestId: number) => void;
  onClone?: (request: SolicitudCompra) => void; // Nueva prop para clonar
  onEdit?: (request: SolicitudCompra) => void; // Nueva prop para editar
  showStatus?: boolean;
  onRowClick?: (request: SolicitudCompra) => void;
  currentEmpleadoId?: number; // ID del empleado actual para validaciones de permisos
}

const RequestTable: React.FC<RequestTableProps> = ({
  requests,
  withActions,
  userActions,
  onApprove,
  onReject,
  onClone,
  onEdit,
  showStatus = true,
  onRowClick,
  currentEmpleadoId
}) => {

  const getStatusBadge = (estado: SolicitudCompraEstado) => {
    const variants: Record<SolicitudCompraEstado, string> = {
      Pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      Aprobada: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
      Rechazada: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
    };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${variants[estado]}`}>
        {estado}
      </span>
    );
  };

  const getDeliveryStatus = (request: SolicitudCompra) => {
    if (request.estado !== 'Aprobada' || !request.ordenes || request.ordenes.length === 0) {
      return <span className="text-gray-400 dark:text-gray-500">N/A</span>;
    }

    const order = request.ordenes[0]; // Asumimos la primera orden vinculada

    if (order.fecha_entrega_real) {
      return <span className="text-green-600 dark:text-green-400">Entregado el {new Date(order.fecha_entrega_real).toLocaleDateString()}</span>;
    }

    if (order.fecha_entrega_estimada) {
      return <span className="text-blue-600 dark:text-blue-400">Estimado: {new Date(order.fecha_entrega_estimada).toLocaleDateString()}</span>;
    }

    return <span className="text-gray-500 dark:text-gray-300">Procesando...</span>;
  }

  const getDisplayDescription = (request: SolicitudCompra) => {
    // Si la descripción es válida y no es un error de IA, la mostramos tal cual
    if (request.descripcion && !request.descripcion.includes("(error en IA)") && !request.descripcion.includes("Error en IA")) {
      return request.descripcion;
    }

    // Si es un error antiguo o está vacía, generamos una descripción basada en los productos
    if (request.detalles && request.detalles.length > 0) {
      const products = request.detalles;
      const firstProd = products[0].producto?.descripcion || products[0].descripcion_producto_personalizado || 'Producto';
      const count = products.length;

      if (count === 1) return `Solicitud de ${firstProd}`;
      if (count === 2) {
        const secondProd = products[1].producto?.descripcion || products[1].descripcion_producto_personalizado || 'Producto';
        return `Solicitud de ${firstProd} y ${secondProd}`;
      }
      return `Solicitud de ${firstProd} y ${count - 1} más`;
    }

    return "Solicitud de Compra";
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-10">
        <DocumentMagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay solicitudes</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No se encontraron solicitudes para mostrar.</p>
      </div>
    );
  }


  return (
    <div className="overflow-x-auto shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden animate-slide-up">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900/50">
          <tr>
            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">ID</th>
            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Descripción</th>
            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Departamento</th>
            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Solicitante</th>
            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Productos</th>
            {showStatus && <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Estado</th>}
            {userActions && <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Entrega</th>}
            {(withActions || userActions) && <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Acciones</th>}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {requests.map(request => {
            const isOwnRequest = currentEmpleadoId === request.empleado_id;

            return (
              <tr
                key={request.id}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => typeof onRowClick === 'function' && onRowClick(request)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">#{request.codigo_visible || request.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 truncate max-w-xs">{getDisplayDescription(request)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{request.departamento?.nombre || 'N/D'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{request.empleado?.nombre} {request.empleado?.apellido}</div>
                  {isOwnRequest && withActions && <span className="text-[10px] text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full font-black uppercase tracking-widest mt-1 inline-block">Tu Solicitud</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                  {request.detalles && request.detalles.length > 0 ? (
                    <div className="space-y-1">
                      {request.detalles.slice(0, 2).map((detalle, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                          <span className="truncate max-w-[150px] opacity-80">{detalle.producto?.descripcion || detalle.descripcion_producto_personalizado || 'Producto'}</span>
                          <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">x{detalle.cantidad}</span>
                        </div>
                      ))}
                      {request.detalles.length > 2 && <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-3">+ {request.detalles.length - 2} más</div>}
                    </div>
                  ) : 'N/D'}
                </td>
                {showStatus && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getStatusBadge(request.estado)}
                  </td>
                )}
                {userActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      {request.estado === 'Aprobada' && <TruckIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                      {getDeliveryStatus(request)}
                    </div>
                  </td>
                )}
                {(withActions || userActions) && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2" onClick={(e) => e.stopPropagation()}>
                    {withActions && onApprove && onReject && (
                      <>
                        <button
                          onClick={() => {
                            if (isOwnRequest) {
                              alert("Política de Seguridad: No puedes aprobar tu propia solicitud de compra. Debe ser aprobada por otro administrador.");
                            } else {
                              onApprove(request);
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${isOwnRequest
                              ? 'text-gray-400 cursor-not-allowed opacity-50'
                              : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-700'
                            }`}
                          title={isOwnRequest ? "No puedes aprobar tu propia solicitud" : "Aprobar"}
                          disabled={isOwnRequest}
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onReject(request.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700 transition-colors"
                          title="Rechazar"
                        >
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {userActions && request.estado === 'Pendiente' && onEdit && (
                      <button
                        onClick={() => onEdit(request)}
                        className="p-1.5 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 rounded-md hover:bg-orange-100 dark:hover:bg-orange-700 transition-colors"
                        title="Editar Solicitud"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                    )}
                    {userActions && onClone && (
                      <button
                        onClick={() => onClone(request)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors"
                        title="Clonar Solicitud"
                      >
                        <DocumentDuplicateIcon className="w-5 h-5" />
                      </button>
                    )}
                    {!onRowClick && ( // Mostrar ícono de ver solo si no hay un onRowClick global
                      <button
                        onClick={() => typeof onRowClick === 'function' && onRowClick(request)} // Si hay un onRowClick dedicado para detalles
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors"
                        title="Ver Detalles"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RequestTable;
