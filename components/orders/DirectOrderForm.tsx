import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, SolicitudCompra, OrdenCompraFormData } from '../../types';
import { XMarkIcon, CheckIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';


interface DirectProductLineItem {
  id: string; // UUID for local state key
  producto_id: number | null;
  descripcion?: string; // For display if product is selected
  customDescripcion?: string; // For manually entered description
  quantity: number;
  precio_unitario: number;
}

interface DirectOrderFormProps {
  show: boolean;
  onHide: () => void;
  userProfile: UserProfile;
  onSuccess: (newOrder: OrdenCompra) => void;
}

const DirectOrderForm: React.FC<DirectOrderFormProps> = ({ show, onHide, userProfile, onSuccess }) => {
  const [productos, setProductos] = useState<DirectProductLineItem[]>([{ id: uuidv4(), producto_id: null, quantity: 1, precio_unitario: 0 }]);
  const [proveedores, setProveedores] = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]);
  
  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: null,
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

  useEffect(() => {
    if (show) {
      setLoading(true);
      const loadInitialData = async () => {
        try {
          const { data: provData, error: provError } = await supabase.from('proveedor').select('id, nombre');
          if (provError) throw provError;
          setProveedores(provData || []);

          const { data: dbProdData, error: dbProdError } = await supabase.from('producto').select('id, descripcion');
          if (dbProdError) throw dbProdError;
          setFetchedDbProducts(dbProdData || []);

        } catch (err) {
          setError("Error cargando datos iniciales.");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadInitialData();
    } else {
      // Reset form when hidden
      setProductos([{ id: uuidv4(), producto_id: null, quantity: 1, precio_unitario: 0 }]);
      setFormData({ proveedor_id: null, unidad: 'Bs', retencion_porcentaje: 75, sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0, estado: 'Pendiente', observaciones: '' });
      setError(null);
    }
  }, [show]);
  
  const calcularTotales = useCallback((currentProductos: DirectProductLineItem[], retencionPct: number) => {
    const subtotal = currentProductos.reduce((acc, p) => acc + (Number(p.quantity) * Number(p.precio_unitario)), 0);
    const iva = subtotal * 0.16;
    const retencionIva = iva * (retencionPct / 100);
    const neto = subtotal + iva - retencionIva;
    setFormData(prev => ({ ...prev, sub_total: subtotal, iva, ret_iva: retencionIva, neto_a_pagar: neto }));
  }, []);

  useEffect(() => {
    calcularTotales(productos, formData.retencion_porcentaje || 75);
  }, [productos, formData.retencion_porcentaje, calcularTotales]);


  const handleAddProductLine = () => {
    setProductos(prev => [...prev, { id: uuidv4(), producto_id: null, quantity: 1, precio_unitario: 0 }]);
  };

  const handleRemoveProductLine = (id: string) => {
    if (productos.length > 1) {
      setProductos(prev => prev.filter(p => p.id !== id));
    } else {
      // If it's the last one, reset it instead of removing
      setProductos([{ id: uuidv4(), producto_id: null, quantity: 1, precio_unitario: 0 }]);
    }
  };

  const handleProductLineChange = (id: string, field: keyof DirectProductLineItem, value: any) => {
    setProductos(prev => prev.map(p => {
      if (p.id === id) {
        const updatedProduct = { ...p, [field]: value };
        if (field === 'producto_id') {
          const selectedDbProduct = fetchedDbProducts.find(dbP => dbP.id === Number(value));
          updatedProduct.descripcion = selectedDbProduct?.descripcion;
          updatedProduct.customDescripcion = ''; // Clear custom if DB product selected
        }
        if (field === 'customDescripcion') {
             updatedProduct.producto_id = null; // Clear DB product if custom description is typed
             updatedProduct.descripcion = value;
        }
        return updatedProduct;
      }
      return p;
    }));
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

    if (!userProfile.empleado_id || !userProfile.departamento_id) {
        setError("Perfil de empleado incompleto."); setLoading(false); return;
    }
    if (!formData.proveedor_id) {
        setError("Debe seleccionar un proveedor."); setLoading(false); return;
    }
    if (productos.length === 0 || productos.some(p => (!p.producto_id && !p.customDescripcion?.trim()) || p.quantity <= 0 || p.precio_unitario < 0)) {
        setError("Asegúrese de que todos los productos tengan descripción (seleccionada o manual), cantidad positiva y precio no negativo.");
        setLoading(false); return;
    }

    try {
      // 1. Create a dummy SolicitudCompra as OrdenCompra requires solicitud_compra_id
      const { data: solicitudData, error: solError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: `Orden Directa - ${formData.observaciones || new Date().toLocaleDateString()}`,
          estado: 'Aprobada', // Direct orders are implicitly approved by creation
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id,
          fecha_solicitud: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (solError) throw solError;
      if (!solicitudData) throw new Error("No se pudo crear la solicitud base para la orden directa.");
      const solicitudBaseId = solicitudData.id;

      // 2. Create OrdenCompra
      const ordenPayload: Omit<OrdenCompra, 'id'|'fecha_modificacion'|'detalles'|'empleado'|'proveedor'|'solicitud_compra' | 'factura'> = {
        solicitud_compra_id: solicitudBaseId,
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
        precio_unitario: 0, 
        changed_by: userProfile.empleado_id
      };
      const { data: ordenData, error: ordenError } = await supabase
        .from('ordencompra')
        .insert(ordenPayload)
        .select()
        .single();
      if (ordenError) throw ordenError;
      if (!ordenData) throw new Error("No se pudo crear la orden de compra.");
      const ordenId = ordenData.id;

      // 3. Handle Productos: Create new ones if custom, then link all to OrdenCompraDetalle
      const detallesOrdenPayload = await Promise.all(productos.map(async p => {
        let productoRealId = p.producto_id;
        if (!productoRealId && p.customDescripcion?.trim()) {
          // Create a new product for custom descriptions
          const { data: newProd, error: newProdError } = await supabase
            .from('producto')
            .insert({ descripcion: p.customDescripcion.trim(), categoria_id: null /* Or a default/selectable one */ })
            .select('id')
            .single();
          if (newProdError) throw new Error(`Error creando producto personalizado '${p.customDescripcion}': ${newProdError.message}`);
          if (!newProd) throw new Error(`No se pudo crear el producto personalizado '${p.customDescripcion}'.`);
          productoRealId = newProd.id;
        }
        if (!productoRealId) throw new Error("Producto inválido en la línea de orden.");
        
        return {
          orden_compra_id: ordenId,
          producto_id: productoRealId,
          cantidad: Number(p.quantity),
          precio_unitario: Number(p.precio_unitario),
        };
      }));

      const { error: detallesError } = await supabase.from('ordencompra_detalle').insert(detallesOrdenPayload);
      if (detallesError) throw detallesError;
      
      // 4. Link Orden y Solicitud (dummy)
      await supabase.from('orden_solicitud').insert({ ordencompra_id: ordenId, solicitud_id: solicitudBaseId });

      onSuccess(ordenData as OrdenCompra);
      onHide();

    } catch (err) {
      console.error("Error creating direct order:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al crear la orden directa.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Orden de Compra Directa</h3>
          <button onClick={onHide} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {loading && productos.length === 1 && !productos[0].producto_id && !productos[0].customDescripcion ? <div className="p-10 flex-grow flex items-center justify-center"><LoadingSpinner message="Cargando formulario..." /></div> : (
          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5">
            {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proveedor and Unidad Monetaria (same as OrderForm) */}
               <div>
                <label htmlFor="direct_proveedor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
                <select id="direct_proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleFormInputChange} required
                    className="w-full px-3 py-2 border input-field">
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor="direct_unidad" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad Monetaria</label>
                <select id="direct_unidad" name="unidad" value={formData.unidad} onChange={handleFormInputChange}
                    className="w-full px-3 py-2 border input-field">
                    <option value="Bs">Bolívares (Bs)</option>
                    <option value="USD">Dólares (USD)</option>
                </select>
                </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Productos a Ordenar</h4>
              {productos.map((item, index) => (
                <div key={item.id} className="p-3 border dark:border-gray-700 rounded-md space-y-2 bg-gray-50 dark:bg-gray-900/40 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                        <label htmlFor={`d_prod_sel_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Producto (Existente)</label>
                        <select id={`d_prod_sel_${item.id}`} value={item.producto_id || ''} 
                                onChange={(e) => handleProductLineChange(item.id, 'producto_id', e.target.value ? Number(e.target.value) : null)}
                                className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm"
                                disabled={!!item.customDescripcion} >
                            <option value="">-- Seleccionar o escribir abajo --</option>
                            {fetchedDbProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                        </select>
                    </div>
                     <div className="sm:col-span-4">
                        <label htmlFor={`d_prod_custom_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">O Descripción Manual</label>
                        <input type="text" id={`d_prod_custom_${item.id}`} value={item.customDescripcion || ''}
                               onChange={(e) => handleProductLineChange(item.id, 'customDescripcion', e.target.value)}
                               placeholder="Ej: Tornillos especiales 3mm"
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm"
                               disabled={!!item.producto_id} />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor={`d_qty_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cantidad</label>
                        <input type="number" id={`d_qty_${item.id}`} value={item.quantity} min="1"
                               onChange={(e) => handleProductLineChange(item.id, 'quantity', Number(e.target.value))}
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" required />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor={`d_price_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Precio Unit.</label>
                        <input type="number" id={`d_price_${item.id}`} value={item.precio_unitario} step="0.01" min="0"
                               onChange={(e) => handleProductLineChange(item.id, 'precio_unitario', Number(e.target.value))}
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" required />
                    </div>
                    {productos.length > 0 && ( // Allow removing even if it's the only one, it will reset
                        <button type="button" onClick={() => handleRemoveProductLine(item.id)} 
                                className="sm:col-span-12 md:col-span-1 p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900 self-center mt-1 md:mt-0" title="Eliminar producto">
                            <TrashIcon className="w-5 h-5 mx-auto" />
                        </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddProductLine}
                className="mt-2 flex items-center px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none">
                <PlusCircleIcon className="w-5 h-5 mr-2" />Añadir Otro Producto
              </button>
            </div>
            
            {/* Resumen de Pago (same as OrderForm) */}
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
                <label htmlFor="direct_retencion_porcentaje" className="whitespace-nowrap mr-2">Retención IVA (%):</label>
                <input type="number" id="direct_retencion_porcentaje" name="retencion_porcentaje" 
                        value={formData.retencion_porcentaje || 0} min="0" max="100" onChange={handleFormInputChange}
                        className="w-20 px-2 py-1 border input-field text-sm" />
                <span className="ml-auto">{formData.ret_iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
                </div>
                <div className="flex justify-between text-md font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600">
                <span>Neto a Pagar:</span>
                <span>{formData.neto_a_pagar?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span>
                </div>
            </div>

            {/* Observaciones (same as OrderForm) */}
            <div>
                <label htmlFor="direct_observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
                <textarea id="direct_observaciones" name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={3}
                className="w-full px-3 py-2 border input-field"
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
                {loading ? "Creando..." : "Crear Orden Directa"}
              </button>
            </div>
          </form>
        )}
      </div>
       <style>{`
        .input-field {
          display: block;
          width: 100%;
          /* padding: 0.5rem 0.75rem; already there */
          font-size: 0.875rem;
          line-height: 1.25rem;
          border-width: 1px;
          border-radius: 0.375rem;
          box-shadow: sm;
        }
        .dark .input-field {
          background-color: #374151; /* gray-700 */
          border-color: #4B5563; /* gray-600 */
          color: #F3F4F6; /* gray-100 */
        }
        .dark .input-field::placeholder {
            color: #9CA3AF; /* gray-400 */
        }
      `}</style>
    </div>
  );
};

export default DirectOrderForm;