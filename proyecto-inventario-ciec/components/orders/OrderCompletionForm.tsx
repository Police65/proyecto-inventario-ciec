import React, { useState } from 'react';
import { OrdenCompra, OrdenCompraEstado, ProductoNoRecibido, OrdenCompraDetalle, Producto, NotificacionInsert } from '../../types'; 
import { supabase } from '../../supabaseClient';
import { XMarkIcon, CheckCircleIcon, ArrowPathIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'; 
import { createNotifications, fetchAdminUserIds, fetchUserAuthIdByEmpleadoId } from '../../services/notificationService';

interface OrderCompletionFormProps {
  show: boolean;
  onHide: () => void;
  order: OrdenCompra;
  onComplete: (updatedOrder: OrdenCompra) => void;
}

interface ProductReceptionStatus {
  id: number; // detalle_id
  producto_id: number; 
  cantidad: number; // Cantidad original en la orden
  precio_unitario: number; 
  producto?: Producto; 
  cantidadRecibida: number;
  cantidadFaltante: number;
  motivoFaltante?: string;
}

export const OrderCompletionForm: React.FC<OrderCompletionFormProps> = ({ show, onHide, order, onComplete }) => {
  const [productStatuses, setProductStatuses] = useState<ProductReceptionStatus[]>([]);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facturaNumero, setFacturaNumero] = useState<string>('');
  const [fechaEntregaReal, setFechaEntregaReal] = useState<string>(new Date().toISOString().split('T')[0]); 


  React.useEffect(() => {
    if (order && order.detalles) {
      const validDetails = order.detalles.filter(
        (d): d is OrdenCompraDetalle & { producto_id: number } => d.producto_id != null
      );

      setProductStatuses(
        validDetails.map(d => ({
          id: d.id,
          producto_id: d.producto_id, 
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          producto: d.producto,
          cantidadRecibida: d.cantidad, 
          cantidadFaltante: 0,
          motivoFaltante: '',
        }))
      );
      setFechaEntregaReal(order.fecha_entrega_real ? new Date(order.fecha_entrega_real).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    }
  }, [order]);

  if (!show) return null;

  const handleQuantityChange = (detalleId: number, received: number) => {
    setProductStatuses(prev =>
      prev.map(p => {
        if (p.id === detalleId) {
          const originalCantidad = p.cantidad;
          const cantidadRecibida = Math.max(0, Math.min(originalCantidad, received)); 
          return {
            ...p,
            cantidadRecibida: cantidadRecibida,
            cantidadFaltante: originalCantidad - cantidadRecibida,
          };
        }
        return p;
      })
    );
  };

  const handleMotivoChange = (detalleId: number, motivo: string) => {
     setProductStatuses(prev =>
      prev.map(p => (p.id === detalleId ? { ...p, motivoFaltante: motivo } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingCompletion(true);
    setError(null);

    if (facturaNumero.trim() && facturaNumero.trim().length < 3) {
        setError("El número de factura debe tener al menos 3 caracteres si se proporciona.");
        setSubmittingCompletion(false);
        return;
    }
    if (!fechaEntregaReal) {
      setError("La fecha de entrega real es obligatoria.");
      setSubmittingCompletion(false);
      return;
    }

    // --- New Validation for Unique Invoice ---
    if (facturaNumero.trim()) {
      try {
        const { data: existingFactura, error: checkError } = await supabase
          .from('facturas_orden')
          .select('id, orden_compra_id')
          .eq('numero_factura', facturaNumero.trim())
          .limit(1)
          .maybeSingle(); // Use maybeSingle to not error on no rows
        
        if (checkError) {
          throw new Error(`Error al verificar la factura: ${checkError.message}`);
        }
  
        if (existingFactura) {
          setError(`El número de factura '${facturaNumero.trim()}' ya ha sido registrado para la orden de compra #${existingFactura.orden_compra_id}.`);
          setSubmittingCompletion(false);
          return;
        }
      } catch (checkErr) {
        setError((checkErr as Error).message);
        setSubmittingCompletion(false);
        return;
      }
    }
    // --- End of New Validation ---

    const notificationsToCreate: NotificacionInsert[] = [];
    const adminUserIds = await fetchAdminUserIds();

    try {
      // Mark order as completed
      const { data: updatedOrderData, error: orderUpdateError } = await supabase
        .from('ordencompra')
        .update({ 
            estado: 'Completada' as OrdenCompraEstado, 
            fecha_modificacion: new Date().toISOString(),
            fecha_entrega_real: fechaEntregaReal 
        })
        .eq('id', order.id)
        .select('*, solicitud_compra:solicitud_compra_id(empleado_id)')
        .single();

      if (orderUpdateError) throw orderUpdateError;
      if (!updatedOrderData) throw new Error('Failed to update order status.');

      // Notify admins about order completion
      if (adminUserIds.length > 0) {
        notificationsToCreate.push(...adminUserIds.map(adminId => ({
          user_id: adminId,
          title: 'Orden Completada',
          description: `La orden de compra #${order.id} (Proveedor: ${order.proveedor?.nombre || 'N/D'}) ha sido marcada como completada.`,
          type: 'orden_completada',
          // related_id: order.id, // Removed
        })));
      }
      
      // Notify original requester (if from a solicitud)
      const solicitudEmpleadoId = (updatedOrderData.solicitud_compra as any)?.empleado_id;
      if (solicitudEmpleadoId) {
        const requesterAuthId = await fetchUserAuthIdByEmpleadoId(solicitudEmpleadoId);
        if (requesterAuthId) {
          notificationsToCreate.push({
            user_id: requesterAuthId,
            title: 'Proceso de Solicitud Completado',
            description: `La orden de compra #${order.id}, generada a partir de tu solicitud, ha sido completada.`,
            type: 'solicitud_procesada_orden_completada', // New type
            // related_id: order.id, // Removed
          });
        }
      }

      // 1. Handle missing products (productos_no_recibidos)
      const productosNoRecibidosDbPayload: Omit<ProductoNoRecibido, 'id' | 'created_at' | 'updated_at' | 'producto' | 'orden_compra'>[] = [];
      for (const status of productStatuses) {
        if (status.cantidadFaltante > 0) {
          productosNoRecibidosDbPayload.push({
            orden_compra_id: order.id,
            producto_id: status.producto_id,
            cantidad_faltante: status.cantidadFaltante,
            motivo: status.motivoFaltante || 'No especificado',
          });
        }
      }
      if (productosNoRecibidosDbPayload.length > 0) {
        const { error: noRecibidosError } = await supabase.from('productos_no_recibidos').insert(productosNoRecibidosDbPayload);
        if (noRecibidosError) console.error('Error guardando productos no recibidos:', noRecibidosError);

        if (adminUserIds.length > 0) {
            notificationsToCreate.push(...adminUserIds.map(adminId => ({
                user_id: adminId,
                title: 'Productos Faltantes en Orden Completada',
                description: `La orden #${order.id} se completó con ${productosNoRecibidosDbPayload.length} tipo(s) de producto(s) faltante(s). Revisar detalles.`,
                type: 'productos_faltantes_orden',
                // related_id: order.id, // Removed
            })));
        }
      }

      // 2. Handle invoice (facturas_orden) if numero_factura is provided
      if (facturaNumero.trim()) {
        const { error: facturaError } = await supabase.from('facturas_orden').insert({
          orden_compra_id: order.id,
          numero_factura: facturaNumero.trim(),
          fecha_recepcion: fechaEntregaReal,
          total_recepcionado: order.neto_a_pagar 
        });
        if (facturaError) console.error('Error guardando factura:', facturaError);
      }

      // 3. Update inventory for received products
      for (const status of productStatuses) {
        if (status.cantidadRecibida > 0 && status.producto_id) {
          const { data: currentInventory, error: invFetchError } = await supabase
            .from('inventario')
            .select('id, existencias')
            .eq('producto_id', status.producto_id)
            .single();

          if (invFetchError && invFetchError.code !== 'PGRST116') {
            console.error(`Error fetching inventory for product ${status.producto_id}:`, invFetchError);
            continue; 
          }

          const newExistencias = (currentInventory?.existencias || 0) + status.cantidadRecibida;

          if (currentInventory?.id) {
            const { error: invUpdateError } = await supabase
              .from('inventario')
              .update({ existencias: newExistencias, fecha_actualizacion: new Date().toISOString() })
              .eq('id', currentInventory.id);
            if (invUpdateError) console.error(`Error updating inventory for product ${status.producto_id}:`, invUpdateError);
          } else {
            const { error: invInsertError } = await supabase
              .from('inventario')
              .insert({
                producto_id: status.producto_id,
                existencias: newExistencias,
                ubicacion: 'Almacén Principal', 
                fecha_actualizacion: new Date().toISOString(),
              });
            if (invInsertError) console.error(`Error inserting inventory for product ${status.producto_id}:`, invInsertError);
          }

          const { data: productDetails, error: productDetailsError } = await supabase
            .from('producto')
            .select('stock_minimo, descripcion')
            .eq('id', status.producto_id)
            .single();

          if (productDetailsError) {
            console.error(`Error fetching product details for stock alert (ID: ${status.producto_id}):`, productDetailsError);
          } else if (productDetails && productDetails.stock_minimo !== null && newExistencias < productDetails.stock_minimo) {
            if (adminUserIds.length > 0) {
                notificationsToCreate.push(...adminUserIds.map(adminId => ({
                  user_id: adminId,
                  title: 'Alerta de Bajo Stock',
                  description: `El producto "${productDetails.descripcion || 'ID ' + status.producto_id}" tiene bajo stock (${newExistencias} uds) tras recepción de orden #${order.id}. Mínimo: ${productDetails.stock_minimo}.`,
                  type: 'alerta_bajo_stock',
                  // related_id: status.producto_id, // Removed
                })));
            }
          }
        }
      }
      
      if (notificationsToCreate.length > 0) {
        await createNotifications(notificationsToCreate);
      }

      onComplete(updatedOrderData as OrdenCompra);
      onHide();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Error al completar la orden: ${errorMessage}`);
      console.error(err);
    } finally {
      setSubmittingCompletion(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Completar Orden de Compra #{order.id}</h3>
          <button onClick={onHide} disabled={submittingCompletion} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 space-y-4">
          {error && <div className="p-2 text-sm text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-600 rounded-md">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="facturaNumero" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nº Factura (Opcional)</label>
                <input type="text" name="facturaNumero" id="facturaNumero" value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
                <label htmlFor="fechaEntregaReal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Entrega Real <span className="text-red-500">*</span></label>
                <div className="relative mt-1">
                    <input type="date" name="fechaEntregaReal" id="fechaEntregaReal" value={fechaEntregaReal} onChange={(e) => setFechaEntregaReal(e.target.value)} required
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-8"
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingrese la fecha de entrega real.')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    />
                    <CalendarDaysIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
            </div>
          </div>

          <h4 className="text-md font-medium text-gray-800 dark:text-gray-100 mb-2">Estado de Recepción de Productos</h4>
          <div className="space-y-3 max-h-72 overflow-y-auto border dark:border-gray-600 rounded-md p-3">
            {productStatuses.map(p => (
                <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-700/60 rounded-md shadow-sm">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{p.producto?.descripcion || `Producto ID: ${p.producto_id}`}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad Original: {p.cantidad}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div>
                            <label htmlFor={`recibida-${p.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">Cantidad Recibida</label>
                            <input type="number" id={`recibida-${p.id}`} value={p.cantidadRecibida}
                                onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value))}
                                min="0" max={p.cantidad}
                                className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        {p.cantidadFaltante > 0 && (
                            <div>
                                <label htmlFor={`motivo-${p.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">Motivo Faltante ({p.cantidadFaltante} uds.)</label>
                                <input type="text" id={`motivo-${p.id}`} value={p.motivoFaltante || ''}
                                    onChange={(e) => handleMotivoChange(p.id, e.target.value)}
                                    className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Ej: Dañado, No enviado"
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}
          </div>

          <div className="pt-5 flex justify-end space-x-3 border-t dark:border-gray-700">
            <button type="button" onClick={onHide} disabled={submittingCompletion}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
              Cancelar
            </button>
            <button type="submit" disabled={submittingCompletion}
              className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
              {submittingCompletion ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-1.5 -ml-1" />}
              {submittingCompletion ? "Procesando..." : "Marcar como Completada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
