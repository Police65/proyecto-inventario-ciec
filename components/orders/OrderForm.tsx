import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData } from '../../types';
import { XMarkIcon, CheckIcon, MinusCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface ProductLineItem {
  id: number | string; 
  producto_id: number | null;
  descripcion: string;
  quantity: number;
  precio_unitario: number;
  seleccionado: boolean;
  motivoRechazo?: string;
}

interface OrderFormProps {
  show: boolean;
  onHide: () => void;
  userProfile: UserProfile;
  onSuccess: (newOrder: OrdenCompra) => void;
  initialProducts?: { producto_id: number | null; descripcion: string; quantity: number; precio_unitario: number }[];
  proveedorId?: number | null; 
  solicitudesIds?: number[];
}

const OrderForm: React.FC<OrderFormProps> = ({ 
  show, onHide, userProfile, onSuccess, 
  initialProducts = [], proveedorId = null, solicitudesIds = [] 
}) => {
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductLineItem[]>([]);
  const [proveedores, setProveedores] = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([]); // Changed type
  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: proveedorId,
    unidad: 'Bs',
    retencion_porcentaje: 75, 
    sub_total: 0,
    iva: 0,
    ret_iva: 0,
    neto_a_pagar: 0,
    estado: 'Pendiente',
    observaciones: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatInitialProducts = useCallback(() => {
    return initialProducts.map((p, index) => ({
      id: p.producto_id || `new-${index}-${Date.now()}`, 
      producto_id: p.producto_id,
      descripcion: p.descripcion,
      quantity: Number(p.quantity) || 1,
      precio_unitario: Number(p.precio_unitario) || 0,
      seleccionado: true, 
      motivoRechazo: '',
    }));
  }, [initialProducts]);

  useEffect(() => {
    if (show) {
      setLoading(true);
      const cargarDatos = async () => {
        try {
          const { data: proveedoresData, error: provError } = await supabase
            .from('proveedor')
            .select('id, nombre')
            .returns<Pick<Proveedor, 'id' | 'nombre'>[]>(); // Ensure correct type for fetched data
          if (provError) throw provError;
          setProveedores(proveedoresData || []);
          
          const formatted = formatInitialProducts();
          setProductosSeleccionados(formatted);
          setFormData(prev => ({
            ...prev,
            proveedor_id: proveedorId,
            retencion_porcentaje: prev.retencion_porcentaje || 75, 
            unidad: prev.unidad || 'Bs',
            estado: prev.estado || 'Pendiente',
            observaciones: prev.observaciones || ''
          }));
          // Pass formData.retencion_porcentaje directly, as formData state update might not be immediate
          calcularTotales(formatted, formData.retencion_porcentaje || 75);


        } catch (err) {
          console.error("Error loading data for order form:", err);
          setError("Error al cargar datos necesarios.");
        } finally {
          setLoading(false);
        }
      };
      cargarDatos();
    } else {
      setProductosSeleccionados([]);
      setFormData({
        proveedor_id: null, unidad: 'Bs', retencion_porcentaje: 75, sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0, estado: 'Pendiente', observaciones: '',
      });
      setError(null);
    }

  }, [show, proveedorId, formatInitialProducts]); 
  const calcularTotales = useCallback((productos: ProductLineItem[], retencionPct: number) => {
    const subtotal = productos
      .filter(p => p.seleccionado)
      .reduce((acc, p) => acc + (Number(p.quantity) * Number(p.precio_unitario)), 0);
    const iva = subtotal * 0.16;
    const retencionIva = iva * (retencionPct / 100);
    const neto = subtotal + iva - retencionIva;
    setFormData(prev => ({ ...prev, sub_total: subtotal, iva, ret_iva: retencionIva, neto_a_pagar: neto }));
  }, []);
  
  useEffect(() => {
    calcularTotales(productosSeleccionados, formData.retencion_porcentaje || 75);
  }, [productosSeleccionados, formData.retencion_porcentaje, calcularTotales]);


  const handleProductChange = (id: number | string, field: keyof ProductLineItem, value: any) => {
    const newProductos = productosSeleccionados.map(p =>
      p.id === id ? { ...p, [field]: (field === 'quantity' || field === 'precio_unitario') ? Number(value) : value } : p
    );
    setProductosSeleccionados(newProductos);
  };
  
  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['retencion_porcentaje', 'proveedor_id'];
    setFormData(prev => ({ ...prev, [name]: numericFields.includes(name) ? (value ? Number(value) : null) : value }));
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!userProfile.empleado_id) {
        setError("Perfil de empleado no encontrado.");
        setLoading(false);
        return;
    }
    if (!formData.proveedor_id) {
        setError("Debe seleccionar un proveedor.");
        setLoading(false);
        return;
    }
    const productosFinales = productosSeleccionados.filter(p => p.seleccionado);
    if (productosFinales.length === 0) {
        setError("Debe seleccionar al menos un producto para la orden.");
        setLoading(false);
        return;
    }
    if (productosFinales.some(p => !p.producto_id || p.quantity <= 0 || p.precio_unitario < 0)) {
      setError("Verifique que todos los productos seleccionados tengan ID, cantidad positiva y precio no negativo.");
      setLoading(false);
      return;
    }

    try {
        const ordenPayload: Omit<OrdenCompra, 'id'|'fecha_modificacion'|'detalles'|'empleado'|'proveedor'|'solicitud_compra' | 'factura'> = { 
            solicitud_compra_id: solicitudesIds[0] || null,
            proveedor_id: Number(formData.proveedor_id),
            fecha_orden: new Date().toISOString(),
            estado: formData.estado || 'Pendiente',
            sub_total: formData.sub_total || 0,
            iva: formData.iva || 0,
            ret_iva: formData.ret_iva || 0,
            neto_a_pagar: formData.neto_a_pagar || 0,
            unidad: formData.unidad as OrdenCompraUnidad || 'Bs',
            observaciones: formData.observaciones || null,
            empleado_id: userProfile.empleado_id,
            retencion_porcentaje: formData.retencion_porcentaje || 0,
            // Campos requeridos por DB que pueden no estar en el form directamente
            precio_unitario: 0, 
            changed_by: userProfile.empleado_id 
        };

        const { data: ordenData, error: ordenError } = await supabase
            .from('ordencompra')
            .insert(ordenPayload)
            .select()
            .single();
        
        if (ordenError) throw ordenError;
        if (!ordenData) throw new Error("No se pudo crear la orden.");

        const ordenId = ordenData.id;

        const detallesOrden = productosFinales.map(p => ({
            orden_compra_id: ordenId,
            producto_id: p.producto_id,
            cantidad: Number(p.quantity),
            precio_unitario: Number(p.precio_unitario),
        }));
        const { error: detallesError } = await supabase.from('ordencompra_detalle').insert(detallesOrden);
        if (detallesError) throw detallesError;

        const productosRezagados = productosSeleccionados.filter(p => !p.seleccionado && p.producto_id);
        if (productosRezagados.length > 0) {
            const rezagadosPayload = productosRezagados.map(p => ({
                orden_compra_id: ordenId,
                producto_id: p.producto_id,
                cantidad: Number(p.quantity),
                motivo: p.motivoRechazo || 'No especificado',
                solicitud_id: solicitudesIds.length > 0 ? solicitudesIds[0] : null, // Link to the first solicitud if consolidating
            }));
            await supabase.from('productos_rezagados').insert(rezagadosPayload);
            
        }

        if (solicitudesIds.length > 0) {
            const ordenSolicitudLinks = solicitudesIds.map(solId => ({
                ordencompra_id: ordenId,
                solicitud_id: solId,
            }));
            await supabase.from('orden_solicitud').insert(ordenSolicitudLinks);
           
            await supabase.from('solicitudcompra').update({ estado: 'Aprobada' }).in('id', solicitudesIds);
        }
        
        onSuccess(ordenData as OrdenCompra);
        onHide();

    } catch (err) {
        console.error("Error creating order:", err);
        setError(err instanceof Error ? err.message : "Error desconocido al crear la orden.");
    } finally {
        setLoading(false);
    }
  };


  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Orden de Compra</h3>
          <button onClick={onHide} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {(loading && !productosSeleccionados.length) ? <div className="p-10 flex-grow flex items-center justify-center"><LoadingSpinner message="Cargando formulario..." /></div> : (
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5">
          {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proveedor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
              <select id="proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleFormInputChange} required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="unidad" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad Monetaria</label>
              <select id="unidad" name="unidad" value={formData.unidad} onChange={handleFormInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="Bs">Bolívares (Bs)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Productos</h4>
            {productosSeleccionados.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos iniciales. Si es una orden directa, añada productos.</p>}
            {productosSeleccionados.map((item) => (
              <div key={item.id} className="p-3 border dark:border-gray-700 rounded-md space-y-3 bg-gray-50 dark:bg-gray-900/40 shadow-sm">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-grow mr-2 truncate" title={item.descripcion}>{item.descripcion || `Producto ID: ${item.producto_id || 'Nuevo'}`}</p>
                    <div className="flex items-center">
                        <label htmlFor={`seleccionado-${item.id}`} className="mr-2 text-xs text-gray-600 dark:text-gray-400">Incluir</label>
                        <input type="checkbox" id={`seleccionado-${item.id}`} checked={item.seleccionado} 
                               onChange={(e) => handleProductChange(item.id, 'seleccionado', e.target.checked)}
                               className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor={`quantity-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cantidad</label>
                        <input type="number" id={`quantity-${item.id}`} value={item.quantity} min="1"
                               onChange={(e) => handleProductChange(item.id, 'quantity', e.target.value)}
                               className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor={`precio-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Precio Unit. ({formData.unidad})</label>
                        <input type="number" id={`precio-${item.id}`} value={item.precio_unitario} step="0.01" min="0"
                               onChange={(e) => handleProductChange(item.id, 'precio_unitario', e.target.value)}
                               className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                </div>
                {!item.seleccionado && (
                    <div>
                        <label htmlFor={`motivo-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Motivo de no inclusión</label>
                        <input type="text" id={`motivo-${item.id}`} value={item.motivoRechazo || ''}
                               onChange={(e) => handleProductChange(item.id, 'motivoRechazo', e.target.value)}
                               placeholder="Ej: Stock agotado, se comprará después"
                               className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                )}
                 <p className="text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Producto: {(item.quantity * item.precio_unitario).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.unidad}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg space-y-2 border dark:border-gray-600">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-2">Resumen de Pago</h4>
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
              <span>Subtotal:</span>
              <span>{formData.sub_total?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
              <span>IVA (16%):</span>
              <span>{formData.iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
              <label htmlFor="retencion_porcentaje" className="whitespace-nowrap mr-2">Retención IVA (%):</label>
              <input type="number" id="retencion_porcentaje" name="retencion_porcentaje" 
                     value={formData.retencion_porcentaje || 0} min="0" max="100" onChange={handleFormInputChange}
                     className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <span className="ml-auto">{formData.ret_iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
            </div>
            <div className="flex justify-between text-md font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600">
              <span>Neto a Pagar:</span>
              <span>{formData.neto_a_pagar?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
            </div>
          </div>

          <div>
            <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
            <textarea id="observaciones" name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Condiciones de pago, tiempo de entrega, etc."/>
          </div>
        
            <div className="pt-5 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 py-3 z-10 border-t dark:border-gray-700">
              <button type="button" onClick={onHide}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
                {loading ? <LoadingSpinner size="sm"/> : <CheckIcon className="w-5 h-5 mr-1.5 -ml-1" />}
                {loading ? "Creando..." : "Crear Orden"}
              </button>
            </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default OrderForm;