
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, ProductSelectionItem } from '../../types';
import { XMarkIcon, CheckIcon, ArrowPathIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { useOrderCalculations } from '../../hooks/useOrderCalculations';
import { v4 as uuidv4 } from 'uuid';

interface OrderFormProductLineItem {
  id: string;
  original_producto_id: number | null;
  isNewProductMode: boolean;
  selected_producto_id: number | null; 
  display_descripcion: string; 
  quantity: number;
  precio_unitario: number;
  seleccionado: boolean; 
}

interface OrderFormProps {
  show: boolean;
  onHide: () => void;
  userProfile: UserProfile;
  onSuccess: (newOrderInfo: Pick<OrdenCompra, 'id'>) => void;
  initialProducts?: ProductSelectionItem[];
  proveedorId?: number | null;
  solicitudesIds?: number[];
}

export const OrderForm: React.FC<OrderFormProps> = ({
  show, onHide, userProfile, onSuccess,
  initialProducts = [], proveedorId = null, solicitudesIds = []
}) => {
  const [productosParaOrden, setProductosParaOrden] = useState<OrderFormProductLineItem[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]);

  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: proveedorId === null ? undefined : proveedorId, 
    unidad: 'Bs', 
    retencion_porcentaje: 75,
    estado: 'Pendiente', 
    observaciones: '', 
    fecha_entrega_estimada: null,
  });

  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const formatInitialProductsToLineItems = useCallback(() => {
    return initialProducts.map((p: any) => ({
      id: p.id?.toString() || uuidv4(),
      original_producto_id: p.id || null,
      isNewProductMode: p.isNewProduct || false,
      selected_producto_id: p.isNewProduct ? null : (p.id || null),
      display_descripcion: p.descripcion,
      quantity: Number(p.quantity) || 1,
      precio_unitario: Number(p.precio_unitario) || 0,
      seleccionado: p.selected !== undefined ? p.selected : true,
    }));
  }, [initialProducts]);

  const productsForCalculation = productosParaOrden.filter(p => p.seleccionado).map(p => ({
    quantity: p.quantity,
    precio_unitario: p.precio_unitario,
  }));
  
  const calculatedTotals = useOrderCalculations(productsForCalculation, formData.retencion_porcentaje);
  
  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      const cargarDatos = async () => {
        try {
          const { data: pData } = await supabase.from('proveedor').select('*');
          setProveedores(pData || []);
          const { data: dbPData } = await supabase.from('producto').select('id, descripcion');
          setFetchedDbProducts(dbPData || []);
          setProductosParaOrden(formatInitialProductsToLineItems());
          setFormData(prev => ({ ...prev, proveedor_id: proveedorId || undefined }));
        } catch (err) { console.error(err); } finally { setLoadingInitialData(false); }
      };
      cargarDatos();
    }
  }, [show, proveedorId, formatInitialProductsToLineItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.proveedor_id || !userProfile.empleado_id) return;
    setSubmittingOrder(true);
    try {
      const orderPayload = {
        solicitud_compra_id: solicitudesIds[0] || null,
        proveedor_id: Number(formData.proveedor_id),
        estado: 'Pendiente',
        sub_total: calculatedTotals.sub_total,
        iva: calculatedTotals.iva,
        ret_iva: calculatedTotals.ret_iva,
        neto_a_pagar: calculatedTotals.neto_a_pagar,
        unidad: formData.unidad,
        empleado_id: userProfile.empleado_id,
        retencion_porcentaje: formData.retencion_porcentaje,
        fecha_orden: new Date().toISOString()
      };
      const { data: oData, error: oErr } = await (supabase.from('ordencompra') as any).insert(orderPayload).select('id').single();
      if (oErr) throw oErr;
      const orderId = (oData as any).id;
      const details = productosParaOrden.filter(p => p.seleccionado).map(p => ({
        orden_compra_id: orderId,
        producto_id: p.selected_producto_id,
        cantidad: p.quantity,
        precio_unitario: p.precio_unitario,
        descripcion_producto_personalizado: p.isNewProductMode ? p.display_descripcion : null
      }));
      await (supabase.from('ordencompra_detalle') as any).insert(details);
      if (solicitudesIds.length) await (supabase.from('solicitudcompra') as any).update({ estado: 'Aprobada' }).in('id', solicitudesIds);
      onSuccess({ id: orderId });
    } catch (err) { 
        console.error(err);
        alert("Error al crear la orden.");
    } finally { setSubmittingOrder(false); }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900/50">
            <h3 className="text-xl font-semibold">Generar Orden de Compra</h3>
            <button onClick={onHide}><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">Proveedor</label>
                  <select value={formData.proveedor_id || ''} onChange={(e) => setFormData({...formData, proveedor_id: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700">
                      <option value="">Seleccionar Proveedor...</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded flex justify-between items-center">
                  <span className="text-sm font-bold">Total a Pagar:</span>
                  <span className="text-lg font-black text-primary-700 dark:text-primary-400">{calculatedTotals.neto_a_pagar?.toLocaleString()} {formData.unidad}</span>
                </div>
            </div>
            <div className="space-y-2 border-t dark:border-gray-700 pt-4">
                <p className="text-sm font-bold mb-2">Detalle de Productos:</p>
                {productosParaOrden.map(p => (
                    <div key={p.id} className="p-3 border dark:border-gray-700 rounded flex flex-wrap md:flex-nowrap gap-3 items-center bg-gray-50 dark:bg-gray-700/30">
                        <div className="flex-grow min-w-[200px]">
                          <p className="text-sm font-bold">{p.display_descripcion}</p>
                          <p className="text-xs text-gray-500">Cantidad: {p.quantity}</p>
                        </div>
                        <div className="w-full md:w-32">
                          <label className="text-[10px] uppercase font-bold text-gray-400">Precio Unitario</label>
                          <input type="number" step="0.01" value={p.precio_unitario} onChange={(e) => setProductosParaOrden(prev => prev.map(item => item.id === p.id ? {...item, precio_unitario: Number(e.target.value)} : item))} className="w-full p-1.5 border rounded dark:bg-gray-800 text-sm" placeholder="Precio" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                <button type="button" onClick={onHide} className="px-6 py-2 border rounded font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={submittingOrder || !formData.proveedor_id} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center">
                    {submittingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                    Finalizar y Crear Orden
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};
