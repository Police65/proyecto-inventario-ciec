import React, { useState } from 'react';
import { OrdenCompra, OrdenCompraEstado, ProductoNoRecibido, OrdenCompraDetalle, Producto } from '../../types'; // Added OrdenCompraDetalle and Producto
import { supabase } from '../../supabaseClient';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface OrderCompletionFormProps {
  show: boolean;
  onHide: () => void;
  order: OrdenCompra;
  onComplete: (updatedOrder: OrdenCompra) => void;
}


interface ProductReceptionStatus {
  id: number; 
  producto_id: number; 
  cantidad: number; 
  precio_unitario: number; 
  producto?: Producto; 
  cantidadRecibida: number;
  cantidadFaltante: number;
  motivoFaltante?: string;
}

export const OrderCompletionForm: React.FC<OrderCompletionFormProps> = ({ show, onHide, order, onComplete }) => {
  const [productStatuses, setProductStatuses] = useState<ProductReceptionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facturaNumero, setFacturaNumero] = useState<string>('');
  const [facturaDocumento, setFacturaDocumento] = useState<File | null>(null); 

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
    setLoading(true);
    setError(null);

    try {

      const { data: updatedOrderData, error: orderUpdateError } = await supabase
        .from('ordencompra')
        .update({ estado: 'Completada', fecha_modificacion: new Date().toISOString() })
        .eq('id', order.id)
        .select()
        .single();

      if (orderUpdateError) throw orderUpdateError;
      if (!updatedOrderData) throw new Error('Failed to update order status.');

   
      for (const pStatus of productStatuses) {

        if (pStatus.cantidadRecibida > 0) {
          const { data: invItem, error: invError } = await supabase
            .from('inventario')
            .select('id, existencias')
            .eq('producto_id', pStatus.producto_id)
            .single();

          if (invError && invError.code !== 'PGRST116') { 
            console.warn(`Error fetching inventory for product ${pStatus.producto_id}: ${invError.message}`);
            continue; 
          }
          if (invItem) {
            await supabase
              .from('inventario')
              .update({ 
                existencias: (invItem.existencias || 0) + pStatus.cantidadRecibida,
                fecha_actualizacion: new Date().toISOString()
              })
              .eq('id', invItem.id);
          } else {
             await supabase.from('inventario').insert({
                producto_id: pStatus.producto_id,
                existencias: pStatus.cantidadRecibida,
                ubicacion: 'Almacén Principal (Entrada OC)', 
                fecha_actualizacion: new Date().toISOString(),
             });
          }
        }
      }
      

      const missingProductsPayload: Omit<ProductoNoRecibido, 'id'>[] = productStatuses
        .filter(p => p.cantidadFaltante > 0) 
        .map(p => ({
            orden_compra_id: order.id,
            producto_id: p.producto_id, 
            cantidad_faltante: p.cantidadFaltante,
            motivo: p.motivoFaltante || 'No especificado',
        }));

      if (missingProductsPayload.length > 0) {
        const { error: missingError } = await supabase.from('productos_no_recibidos').insert(missingProductsPayload);
        if (missingError) console.warn("Error recording missing products:", missingError.message);
      }
      

      if (facturaNumero.trim()) {
          await supabase.from('facturas_orden').insert({
            orden_compra_id: order.id,
            numero_factura: facturaNumero.trim(),
            fecha_recepcion: new Date().toISOString(),
            total_recepcionado: productStatuses.reduce((acc, curr) => acc + (curr.cantidadRecibida * curr.precio_unitario), 0)
          });
      }

      onComplete(updatedOrderData as OrdenCompra);
      onHide();

    } catch (err) {
      console.error('Error completing order:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Completar Orden #{order.id}</h3>
          <button onClick={onHide} disabled={loading} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5">
          {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</div>}
          
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Recepción de Productos</h4>
            {productStatuses.map(item => (
              <div key={item.id} className="p-3 border dark:border-gray-600 rounded-md space-y-2 bg-gray-50 dark:bg-gray-700/60">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.producto?.descripcion} (Ordenado: {item.cantidad})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor={`recibido-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">Cantidad Recibida:</label>
                        <input type="number" id={`recibido-${item.id}`} value={item.cantidadRecibida}
                               onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                               min="0" max={item.cantidad}
                               className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                     {item.cantidadFaltante > 0 && (
                        <div>
                           <label htmlFor={`motivo-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">Motivo (faltan {item.cantidadFaltante}):</label>
                           <input type="text" id={`motivo-${item.id}`} value={item.motivoFaltante || ''}
                                  onChange={(e) => handleMotivoChange(item.id, e.target.value)}
                                  placeholder="Ej: Dañado, no enviado"
                                  className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                     )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="facturaNumero" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número de Factura (Opcional)</label>
            <input type="text" id="facturaNumero" value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)}
                   className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          {/* 
          <div>
            <label htmlFor="facturaDocumento" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Documento Factura (Opcional)</label>
            <input type="file" id="facturaDocumento" onChange={(e) => setFacturaDocumento(e.target.files ? e.target.files[0] : null)}
                   className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-700 file:text-primary-700 dark:file:text-primary-100 hover:file:bg-primary-100 dark:hover:file:bg-primary-600"/>
          </div>
          */}

          <div className="pt-5 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 py-3 z-10 border-t dark:border-gray-700">
            <button type="button" onClick={onHide} disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
              {loading ? <LoadingSpinner size="sm"/> : <CheckCircleIcon className="w-5 h-5 mr-1.5 -ml-1" />}
              {loading ? "Procesando..." : "Confirmar Completitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
