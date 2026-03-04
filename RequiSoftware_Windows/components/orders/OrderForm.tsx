
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, ProductSelectionItem, CategoriaProveedor } from '../../types';
import { XMarkIcon, CheckIcon, ArrowPathIcon, CalendarDaysIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion' | 'categoria_id'>[]>([]);

  // State for Category Validation
  const [providerCategories, setProviderCategories] = useState<Set<number>>(new Set());
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [mismatchedProducts, setMismatchedProducts] = useState<{ productName: string, categoryId: number, categoryName: string }[]>([]);
  const [addingCategories, setAddingCategories] = useState(false);

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
          const { data: pData } = await supabase.from('proveedor').select('*, categorias:proveedor_categoria(categoria_id)');
          setProveedores(pData || []);

          const { data: dbPData } = await supabase.from('producto').select('id, descripcion, categoria_id');
          setFetchedDbProducts(dbPData || []);

          setProductosParaOrden(formatInitialProductsToLineItems());
          setFormData(prev => ({ ...prev, proveedor_id: proveedorId || undefined }));
        } catch (err) { console.error(err); } finally { setLoadingInitialData(false); }
      };
      cargarDatos();
    }
  }, [show, proveedorId, formatInitialProductsToLineItems]);

  // Update provider categories when provider changes
  useEffect(() => {
    if (formData.proveedor_id) {
      const provider = proveedores.find(p => p.id === Number(formData.proveedor_id));
      if (provider && provider.categorias) {
        setProviderCategories(new Set(provider.categorias.map((c: any) => c.categoria_id)));
      } else {
        setProviderCategories(new Set());
      }
    } else {
      setProviderCategories(new Set());
    }
  }, [formData.proveedor_id, proveedores]);

  const processOrderCreation = async () => {
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

      const selectedItems = productosParaOrden.filter(p => p.seleccionado);
      const details = selectedItems.map(p => ({
        orden_compra_id: orderId,
        producto_id: p.selected_producto_id,
        cantidad: p.quantity,
        precio_unitario: p.precio_unitario,
        descripcion_producto_personalizado: p.isNewProductMode ? p.display_descripcion : null
      }));
      await (supabase.from('ordencompra_detalle') as any).insert(details);

      // Handle Rezagados (Unchecked items)
      const unselectedItems = productosParaOrden.filter(p => !p.seleccionado);
      if (unselectedItems.length > 0) {
        const rezagados = unselectedItems.map(p => ({
          orden_compra_id: orderId,
          producto_id: p.selected_producto_id || p.original_producto_id, // Use selected or original
          cantidad: p.quantity,
          motivo: 'Excluido durante la creación de la orden',
          solicitud_id: solicitudesIds[0] || null // Link to first request if available
        })).filter(r => r.producto_id); // Ensure we have a product ID

        if (rezagados.length > 0) {
          await (supabase.from('productos_rezagados') as any).insert(rezagados);
        }
      }

      if (solicitudesIds.length) await (supabase.from('solicitudcompra') as any).update({ estado: 'Aprobada' }).in('id', solicitudesIds);
      onSuccess({ id: orderId });
    } catch (err) {
      console.error(err);
      alert("Error al crear la orden.");
    } finally { setSubmittingOrder(false); }
  };

  const handleAddCategoriesAndProceed = async () => {
    setAddingCategories(true);
    try {
      const categoriesToAdd = mismatchedProducts.map(m => ({
        proveedor_id: Number(formData.proveedor_id),
        categoria_id: m.categoryId
      }));

      // Use upsert or ignore duplicates
      const { error } = await supabase.from('proveedor_categoria').upsert(categoriesToAdd, { onConflict: 'proveedor_id,categoria_id', ignoreDuplicates: true });
      if (error) throw error;

      setShowCategoryWarning(false);
      await processOrderCreation();
    } catch (err) {
      console.error("Error adding categories:", err);
      alert("Error al actualizar categorías del proveedor.");
    } finally {
      setAddingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.proveedor_id) return;

    // Check for category mismatches
    const selectedItems = productosParaOrden.filter(p => p.seleccionado);
    const mismatches: { productName: string, categoryId: number, categoryName: string }[] = [];

    // We need to fetch category names for the mismatched products
    const mismatchedCategoryIds = new Set<number>();

    for (const item of selectedItems) {
      if (item.selected_producto_id) {
        const product = fetchedDbProducts.find(p => p.id === item.selected_producto_id);
        if (product && product.categoria_id && !providerCategories.has(product.categoria_id)) {
          mismatchedCategoryIds.add(product.categoria_id);
          // We'll fill the name later
          mismatches.push({
            productName: product.descripcion,
            categoryId: product.categoria_id,
            categoryName: 'Cargando...'
          });
        }
      }
    }

    if (mismatches.length > 0) {
      // Fetch category names
      const { data: catData } = await supabase.from('categoria_producto').select('id, nombre').in('id', Array.from(mismatchedCategoryIds));
      if (catData) {
        mismatches.forEach(m => {
          const cat = catData.find(c => c.id === m.categoryId);
          if (cat) m.categoryName = cat.nombre;
        });
      }
      setMismatchedProducts(mismatches);
      setShowCategoryWarning(true);
      return;
    }

    await processOrderCreation();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 transition-all animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-pop-in">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Generar Orden de Compra</h3>
          <button onClick={onHide} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Proveedor</label>
              <select value={formData.proveedor_id || ''} onChange={(e) => setFormData({ ...formData, proveedor_id: Number(e.target.value) })} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all">
                <option value="">Seleccionar Proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900 rounded-2xl flex justify-between items-center shadow-sm">
              <span className="text-sm font-bold text-primary-800 dark:text-primary-300">Total a Pagar:</span>
              <span className="text-2xl font-display font-black text-primary-700 dark:text-primary-400">{calculatedTotals.neto_a_pagar?.toLocaleString()} {formData.unidad}</span>
            </div>
          </div>
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <p className="text-sm font-display font-bold text-slate-700 dark:text-slate-300 mb-4">Detalle de Productos:</p>
            {productosParaOrden.map(p => (
              <div key={p.id} className={`p-4 border rounded-2xl flex flex-wrap md:flex-nowrap gap-4 items-center transition-all ${p.seleccionado ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-900 border-transparent opacity-60 grayscale'}`}>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={p.seleccionado}
                    onChange={(e) => setProductosParaOrden(prev => prev.map(item => item.id === p.id ? { ...item, seleccionado: e.target.checked } : item))}
                    className="rounded-lg border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 w-6 h-6 transition-all"
                  />
                </div>
                <div className="flex-grow min-w-[200px]">
                  <p className={`text-base font-bold ${!p.seleccionado ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{p.display_descripcion}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={p.quantity}
                      onChange={(e) => setProductosParaOrden(prev => prev.map(item => item.id === p.id ? { ...item, quantity: Number(e.target.value) } : item))}
                      className="w-24 p-2 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                      disabled={!p.seleccionado}
                    />
                  </div>
                  {!p.seleccionado && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider">Se marcará como rezagado</p>}
                </div>
                <div className="w-full md:w-40">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Precio Unitario</label>
                  <input type="number" step="0.01" value={p.precio_unitario} onChange={(e) => setProductosParaOrden(prev => prev.map(item => item.id === p.id ? { ...item, precio_unitario: Number(e.target.value) } : item))} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all" placeholder="Precio" disabled={!p.seleccionado} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4 pt-8 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onHide} className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button type="submit" disabled={submittingOrder || !formData.proveedor_id} className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20 disabled:opacity-50 transition-all flex items-center gap-2">
              {submittingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckIcon className="w-5 h-5" />}
              Finalizar y Crear Orden
            </button>
          </div>
        </form>

        {/* Category Warning Modal */}
        {showCategoryWarning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-70 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
                <ExclamationTriangleIcon className="w-8 h-8" />
                <h4 className="text-lg font-bold">Advertencia de Categoría</h4>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Los siguientes productos pertenecen a categorías que este proveedor no tiene registradas:
              </p>
              <ul className="list-disc pl-5 mb-4 text-sm text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                {mismatchedProducts.map((m, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{m.productName}</span> - Categoría: {m.categoryName}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
                ¿Desea añadir estas categorías al proveedor y continuar con la orden?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCategoryWarning(false)} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                <button onClick={handleAddCategoriesAndProceed} disabled={addingCategories} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center">
                  {addingCategories && <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />}
                  Añadir Categorías y Continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
