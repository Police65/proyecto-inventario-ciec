import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, ProductSelectionItem, NotificacionInsert } from '../../types';
import { XMarkIcon, CheckIcon, PlusCircleIcon, TrashIcon, ArrowPathIcon, CalendarDaysIcon, TagIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';
import { useOrderCalculations } from '../../hooks/useOrderCalculations';
import { THRESHOLD_ORDEN_GRANDE } from '../../config';
import { createNotifications, fetchAdminUserIds, fetchUserAuthIdByEmpleadoId } from '../../services/notificationService';

interface OrderFormProductLineItem {
  id: string; // ID único de frontend
  isNewProduct: boolean;
  selected_producto_id: number | null;
  newProduct_descripcion: string;
  newProduct_categoria_id: number | null;
  newProduct_codigo_interno?: string;
  newProduct_unidad_medida?: string;
  quantity: number;
  precio_unitario: number;
  display_descripcion: string;
  seleccionado: boolean;
  original_producto_id?: number | null; // ID original si viene de una solicitud
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
  const [productos, setProductos] = useState<OrderFormProductLineItem[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion' | 'categoria_id'>[]>([]);
  const [productCategories, setProductCategories] = useState<CategoriaProducto[]>([]);
  
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [currentLineItemIdForNewCategory, setCurrentLineItemIdForNewCategory] = useState<string | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string|null>(null);

  // State for Category Validation
  const [providerCategories, setProviderCategories] = useState<Set<number>>(new Set());
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [mismatchedProducts, setMismatchedProducts] = useState<{productName: string, categoryId: number, categoryName: string}[]>([]);
  const [addingCategories, setAddingCategories] = useState(false);

  // Rezagados logic
  const [showRezagadosConfirm, setShowRezagadosConfirm] = useState<OrderFormProductLineItem[] | null>(null);

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
  const [error, setError] = useState<string | null>(null);

  const productsForCalculation = productos.filter(p => p.seleccionado).map(p => ({
    quantity: p.quantity,
    precio_unitario: p.precio_unitario,
  }));
  const calculatedTotals = useOrderCalculations(productsForCalculation, formData.retencion_porcentaje);

  const fetchProductCategories = useCallback(async () => {
    try {
      const { data, error: catError } = await supabase.from('categoria_producto').select('*').order('nombre');
      if (catError) throw catError;
      setProductCategories(data || []);
    } catch (err) {
      console.error("Error fetching product categories:", err);
    }
  }, []);

  const formatInitialProductsToLineItems = useCallback((items: ProductSelectionItem[]) => {
    return items.map(p => ({
      id: uuidv4(),
      isNewProduct: p.isNewProduct || false,
      selected_producto_id: p.isNewProduct ? null : p.id,
      newProduct_descripcion: p.isNewProduct ? p.descripcion : '',
      newProduct_categoria_id: p.isNewProduct ? (p.categoria_id || null) : null,
      newProduct_codigo_interno: p.codigo_interno || '',
      newProduct_unidad_medida: p.unidad_medida || '',
      quantity: Number(p.quantity) || 1,
      precio_unitario: Number(p.precio_unitario) || 0,
      display_descripcion: p.descripcion,
      seleccionado: p.selected !== undefined ? p.selected : true,
      original_producto_id: p.id
    }));
  }, []);

  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      const loadInitialData = async () => {
        try {
          const { data: provData, error: provError } = await supabase.from('proveedor').select('*, categorias:proveedor_categoria(categoria_id)');
          if (provError) throw provError;
          setProveedores(provData || []);

          const { data: dbProdData, error: dbProdError } = await supabase.from('producto').select('id, descripcion, categoria_id');
          if (dbProdError) throw dbProdError;
          setFetchedDbProducts(dbProdData || []);

          await fetchProductCategories();

          setProductos(formatInitialProductsToLineItems(initialProducts));
          setFormData(prev => ({ ...prev, proveedor_id: proveedorId || undefined }));

        } catch (err) {
          setError("Error cargando datos iniciales.");
          console.error(err);
        } finally {
          setLoadingInitialData(false);
        }
      };
      loadInitialData();
    } else {
      setProductos([]);
      setError(null);
    }
  }, [show, fetchProductCategories, formatInitialProductsToLineItems, initialProducts, proveedorId]);

  useEffect(() => {
    if (formData.proveedor_id) {
        const selectedProvider = proveedores.find(p => p.id === Number(formData.proveedor_id));
        if (selectedProvider) {
            setFormData(prev => ({
                ...prev,
                retencion_porcentaje: selectedProvider.porcentaje_retencion_iva
            }));
            if (selectedProvider.categorias) {
              setProviderCategories(new Set(selectedProvider.categorias.map((c: any) => c.categoria_id)));
            } else {
              setProviderCategories(new Set());
            }
        }
    } else {
      setProviderCategories(new Set());
    }
  }, [formData.proveedor_id, proveedores]);

  const handleAddProductLine = () => {
    setProductos(prev => [...prev, {
      id: uuidv4(),
      isNewProduct: false,
      selected_producto_id: null,
      newProduct_descripcion: '',
      newProduct_categoria_id: null,
      newProduct_codigo_interno: '',
      newProduct_unidad_medida: '',
      quantity: 1,
      precio_unitario: 0,
      display_descripcion: '',
      seleccionado: true
    }]);
  };

  const handleRemoveProductLine = (id: string) => {
    setProductos(prev => prev.filter(p => p.id !== id));
  };

  const handleProductLineChange = (id: string, field: keyof OrderFormProductLineItem, value: any) => {
    setProductos(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'selected_producto_id') {
          const selectedDbProd = fetchedDbProducts.find(dbP => dbP.id === Number(value));
          updatedItem.display_descripcion = selectedDbProd?.descripcion || '';
          updatedItem.newProduct_descripcion = '';
          updatedItem.isNewProduct = false;
          updatedItem.newProduct_categoria_id = selectedDbProd?.categoria_id || null;
        } else if (field === 'newProduct_descripcion') {
            updatedItem.display_descripcion = value;
            if (!updatedItem.isNewProduct && !updatedItem.selected_producto_id) {
                updatedItem.isNewProduct = true;
            }
        } else if (field === 'isNewProduct') {
            if (value === true) {
                updatedItem.selected_producto_id = null;
                updatedItem.display_descripcion = updatedItem.newProduct_descripcion || '';
            } else {
                updatedItem.newProduct_descripcion = '';
                updatedItem.newProduct_categoria_id = null;
                updatedItem.display_descripcion = '';
            }
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['retencion_porcentaje', 'proveedor_id'];
    setFormData(prev => ({
      ...prev,
      [name]: name === 'fecha_entrega_estimada'
        ? (value === '' ? null : value)
        : (numericFields.includes(name) ? (value ? Number(value) : null) : value)
    }));
  };

  const handleOpenNewCategoryModal = (lineId: string) => {
    setCurrentLineItemIdForNewCategory(lineId);
    setNewCategoryNameInput('');
    setCategoryError(null);
    setShowNewCategoryModal(true);
  };

  const handleSaveNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryNameInput.trim()) {
      setCategoryError("El nombre de la categoría es obligatorio.");
      return;
    }
    setSubmittingCategory(true);
    setCategoryError(null);
    try {
      const { data: newCategory, error: insertError } = await (supabase
        .from('categoria_producto') as any)
        .insert({ nombre: newCategoryNameInput.trim() })
        .select()
        .single();
      if (insertError) throw insertError;
      
      await fetchProductCategories();

      if (newCategory && currentLineItemIdForNewCategory) {
        setProductos(prevItems => prevItems.map(item =>
          item.id === currentLineItemIdForNewCategory
            ? { ...item, newProduct_categoria_id: (newCategory as any).id }
            : item
        ));
      }
      setShowNewCategoryModal(false);
      setCurrentLineItemIdForNewCategory(null);
    } catch (err) {
      const e = err as any;
      if (e.code === '23505') setCategoryError('Error: Ya existe una categoría con ese nombre.');
      else setCategoryError('Error al guardar la categoría.');
      console.error(err);
    } finally {
      setSubmittingCategory(false);
    }
  };

  const processOrderCreation = async () => {
    const unselectedItems = productos.filter(p => !p.seleccionado);
    if (unselectedItems.length > 0) {
      setShowRezagadosConfirm(unselectedItems);
      return;
    }
    executeOrderCreation();
  };

  const executeOrderCreation = async () => {
    setError(null);
    setSubmittingOrder(true);

    if (!userProfile.empleado_id) {
      setError("Perfil de empleado incompleto."); setSubmittingOrder(false); return;
    }
    if (!formData.proveedor_id) {
      setError("Debe seleccionar un proveedor."); setSubmittingOrder(false); return;
    }

    const selectedItems = productos.filter(p => p.seleccionado);

    if (calculatedTotals.neto_a_pagar <= 0) {
      setError("El total de la orden de compra no puede ser 0 o menor. Verifique las cantidades y precios.");
      setSubmittingOrder(false); return;
    }
    
    if (selectedItems.length === 0 || selectedItems.some(p => 
        (p.isNewProduct && (!p.newProduct_descripcion?.trim() || !p.newProduct_categoria_id)) ||
        (!p.isNewProduct && !p.selected_producto_id) ||
        p.quantity <= 0 || p.precio_unitario < 0
    )) {
      setError("Asegúrese de que todos los productos seleccionados tengan descripción, categoría, cantidad positiva y precio no negativo.");
      setSubmittingOrder(false); return;
    }

    try {
      const orderPayload: any = {
        solicitud_compra_id: solicitudesIds[0] || null,
        proveedor_id: Number(formData.proveedor_id),
        estado: formData.estado || 'Pendiente',
        sub_total: calculatedTotals.sub_total || 0,
        iva: calculatedTotals.iva || 0,
        ret_iva: calculatedTotals.ret_iva || 0,
        neto_a_pagar: calculatedTotals.neto_a_pagar || 0,
        unidad: formData.unidad || 'Bs',
        observaciones: formData.observaciones || null,
        empleado_id: userProfile.empleado_id,
        retencion_porcentaje: formData.retencion_porcentaje === null ? 0 : formData.retencion_porcentaje,
        precio_unitario: 0,
        changed_by: userProfile.empleado_id,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
        fecha_orden: new Date().toISOString()
      };

      const { data: ordenData, error: ordenError } = await (supabase.from('ordencompra') as any).insert(orderPayload).select('id, neto_a_pagar, codigo_visible').single();
      if (ordenError) throw ordenError;
      const ordenId = (ordenData as any).id;

      const detallesOrdenPayload = await Promise.all(selectedItems.map(async p => {
        let productoRealId = p.selected_producto_id;

        if (p.isNewProduct) {
          const newProdData: Partial<Producto> = {
            descripcion: p.newProduct_descripcion,
            categoria_id: p.newProduct_categoria_id,
            codigo_interno: p.newProduct_codigo_interno || null,
            unidad_medida: p.newProduct_unidad_medida || null,
          };
          const { data: newProd, error: newProdError } = await (supabase.from('producto') as any).insert(newProdData).select('id').single();
          if (newProdError) throw new Error(`Error creando producto '${p.newProduct_descripcion}': ${newProdError.message}`);
          productoRealId = (newProd as any).id;
        }

        return {
          orden_compra_id: ordenId,
          producto_id: productoRealId,
          cantidad: Number(p.quantity),
          precio_unitario: Number(p.precio_unitario),
          descripcion_producto_personalizado: p.isNewProduct ? p.display_descripcion : null
        };
      }));

      const { error: detallesError } = await (supabase.from('ordencompra_detalle') as any).insert(detallesOrdenPayload);
      if (detallesError) throw detallesError;

      const unselectedItems = productos.filter(p => !p.seleccionado);
      if (unselectedItems.length > 0) {
        const rezagados = unselectedItems.map(p => {
          const pid = p.selected_producto_id || p.original_producto_id;
          const isCustom = !pid;
          return {
            orden_compra_id: ordenId,
            producto_id: isCustom ? null : pid,
            cantidad: p.quantity,
            motivo: isCustom ? `[CUSTOM:${p.display_descripcion}] Excluido durante creación` : 'Excluido durante creación',
            solicitud_id: solicitudesIds[0] || null,
          };
        });
        await (supabase.from('productos_rezagados') as any).insert(rezagados);
      }

      if (solicitudesIds.length > 0) {
        await (supabase.from('solicitudcompra') as any).update({ estado: 'Aprobada' }).in('id', solicitudesIds);
        const vPayload = solicitudesIds.map(sid => ({ ordencompra_id: ordenId, solicitud_id: sid }));
        await (supabase.from('orden_solicitud') as any).insert(vPayload);
      }

      onSuccess({ id: ordenId });
      onHide();

    } catch (err: any) {
      setError(`Error al crear la orden: ${err.message || "Error desconocido"}`);
      console.error(err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleAddCategoriesAndProceed = async () => {
    setAddingCategories(true);
    try {
      const categoriesToAdd = mismatchedProducts.map(m => ({
        proveedor_id: Number(formData.proveedor_id),
        categoria_id: m.categoryId
      }));
      await supabase.from('proveedor_categoria').upsert(categoriesToAdd, { onConflict: 'proveedor_id,categoria_id', ignoreDuplicates: true });
      setShowCategoryWarning(false);
      await processOrderCreation();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar categorías del proveedor.");
    } finally {
      setAddingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.proveedor_id) return;

    const selectedItems = productos.filter(p => p.seleccionado);
    const mismatches: {productName: string, categoryId: number, categoryName: string}[] = [];
    const mismatchedCategoryIds = new Set<number>();

    for (const item of selectedItems) {
      let catId: number | null = null;
      let prodName = '';

      if (item.isNewProduct && item.newProduct_categoria_id) {
        catId = item.newProduct_categoria_id;
        prodName = item.newProduct_descripcion;
      } else if (item.selected_producto_id) {
        const product = fetchedDbProducts.find(p => p.id === item.selected_producto_id);
        if (product && product.categoria_id) {
          catId = product.categoria_id;
          prodName = product.descripcion;
        }
      }

      if (catId && !providerCategories.has(catId)) {
        mismatchedCategoryIds.add(catId);
        mismatches.push({ productName: prodName, categoryId: catId, categoryName: 'Cargando...' });
      }
    }

    if (mismatches.length > 0) {
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

  const inputClasses = "block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all";
  const smallInputClasses = "block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all";

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-pop-in">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl text-primary-600 dark:text-primary-400">
              <ClipboardDocumentListIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Generar Orden de Compra</h3>
              <p className="text-sm text-slate-500 font-medium">Configure los detalles finales para la adquisición</p>
            </div>
          </div>
          <button onClick={onHide} disabled={submittingOrder} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        {loadingInitialData ? (
          <div className="flex-grow flex items-center justify-center p-20">
            <LoadingSpinner message="Preparando requerimientos..." />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-2xl flex gap-3 items-center">
                <ExclamationTriangleIcon className="w-6 h-6 shrink-0" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            {/* General Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Proveedor Final <span className="text-red-500">*</span></label>
                <select name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleFormInputChange} required className={inputClasses}>
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Unidad Monetaria</label>
                <select name="unidad" value={formData.unidad || 'Bs'} onChange={handleFormInputChange} className={inputClasses}>
                  <option value="Bs">Bolívares (Bs)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Entrega Estimada</label>
                <div className="relative">
                  <input type="date" name="fecha_entrega_estimada" value={formData.fecha_entrega_estimada || ''} onChange={handleFormInputChange} className={`${inputClasses} pr-12`} />
                  <CalendarDaysIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <h4 className="text-lg font-display font-bold text-slate-800 dark:text-slate-200">Productos del Requerimiento</h4>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <InformationCircleIcon className="w-4 h-4" /> Desmarque productos para excluirlos
                </div>
              </div>
              
              <div className="grid gap-4">
                {productos.map((item) => (
                  <div key={item.id} className={`group relative p-5 border rounded-3xl transition-all duration-300 ${item.seleccionado ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-900/50 border-transparent opacity-60 grayscale'}`}>
                    <div className="flex items-start gap-6">
                      <div className="pt-2">
                        <input type="checkbox" checked={item.seleccionado} onChange={(e) => handleProductLineChange(item.id, 'seleccionado', e.target.checked)} className="rounded-lg border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 w-7 h-7 transition-all cursor-pointer" />
                      </div>
                      
                      <div className="flex-grow space-y-4">
                        <div className="flex justify-between items-center">
                          <button type="button" onClick={() => handleProductLineChange(item.id, 'isNewProduct', !item.isNewProduct)} disabled={!item.seleccionado}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${item.isNewProduct ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {item.isNewProduct ? 'Nuevo Producto' : 'Producto Existente'}
                          </button>
                          
                          <button type="button" onClick={() => handleRemoveProductLine(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" disabled={submittingOrder}>
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-12 gap-x-6 gap-y-4 items-end">
                          {item.isNewProduct ? (
                            <>
                              <div className="col-span-12 md:col-span-7">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Descripción del Producto <span className="text-red-500">*</span></label>
                                <input type="text" value={item.newProduct_descripcion} onChange={(e) => handleProductLineChange(item.id, 'newProduct_descripcion', e.target.value)} required={item.seleccionado}
                                  className={smallInputClasses} placeholder="Ej. Filtro de Aceite X-100" disabled={!item.seleccionado} />
                              </div>
                              <div className="col-span-12 md:col-span-5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Categoría <span className="text-red-500">*</span></label>
                                <div className="flex items-center gap-2">
                                  <select value={item.newProduct_categoria_id || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_categoria_id', Number(e.target.value))} required={item.seleccionado}
                                    className={smallInputClasses} disabled={!item.seleccionado}>
                                    <option value="">Seleccionar...</option>
                                    {productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                                  </select>
                                  <button type="button" onClick={() => handleOpenNewCategoryModal(item.id)} disabled={!item.seleccionado} className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl hover:bg-green-100 transition-colors">
                                    <PlusCircleIcon className="w-5 h-5"/>
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-12 md:col-span-7">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Seleccionar desde el Inventario <span className="text-red-500">*</span></label>
                              <select value={item.selected_producto_id || ''} onChange={(e) => handleProductLineChange(item.id, 'selected_producto_id', Number(e.target.value))} required={item.seleccionado && !item.isNewProduct}
                                className={smallInputClasses} disabled={!item.seleccionado}>
                                <option value="">-- Buscar Producto --</option>
                                {fetchedDbProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                              </select>
                            </div>
                          )}

                          <div className="col-span-6 md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Cantidad <span className="text-red-500">*</span></label>
                            <input type="number" value={item.quantity} min="1" onChange={(e) => handleProductLineChange(item.id, 'quantity', Number(e.target.value))}
                              className={smallInputClasses} required={item.seleccionado} disabled={!item.seleccionado} />
                          </div>
                          <div className="col-span-6 md:col-span-3">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Precio Unitario ({formData.unidad}) <span className="text-red-500">*</span></label>
                            <input type="number" value={item.precio_unitario} step="0.01" min="0" onChange={(e) => handleProductLineChange(item.id, 'precio_unitario', Number(e.target.value))}
                              className={smallInputClasses} required={item.seleccionado} disabled={!item.seleccionado} placeholder="0.00" />
                          </div>
                        </div>
                        {!item.seleccionado && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                            <ArrowPathIcon className="w-4 h-4 text-amber-500 animate-spin-reverse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 italic">Producto en espera (Backorder/Rezagado)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleAddProductLine} disabled={submittingOrder} 
                className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-sm font-bold text-slate-400 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 group">
                <PlusCircleIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Añadir Producto Adicional
              </button>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6">
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Observaciones / Notas</label>
                <textarea name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={6} 
                  className={`${inputClasses} resize-none`} placeholder="Condiciones de pago, instrucciones de entrega, etc."/>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 shadow-inner">
                <h4 className="text-lg font-display font-black text-slate-900 dark:text-white mb-4 border-b dark:border-slate-800 pb-4 uppercase tracking-tighter">Resumen de Liquidación</h4>
                
                <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="text-slate-900 dark:text-white">{calculatedTotals.sub_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>
                
                <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400">
                  <span>Impuesto (IVA 16%):</span>
                  <span className="text-slate-900 dark:text-white">{calculatedTotals.iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-y border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Retención IVA:</span>
                    <input type="number" name="retencion_porcentaje" value={formData.retencion_porcentaje === null ? '' : formData.retencion_porcentaje} min="0" max="100" onChange={handleFormInputChange} 
                      className="w-14 p-1 text-center border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold dark:bg-slate-800" />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-sm font-bold text-red-500">-{calculatedTotals.ret_iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-display font-black text-primary-700 dark:text-primary-400 uppercase">Neto a Liquidar:</span>
                  <span className="text-3xl font-display font-black text-primary-600 dark:text-primary-400">{calculatedTotals.neto_a_pagar.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-8 flex justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={onHide} disabled={submittingOrder} 
                className="px-8 py-4 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
                Regresar
              </button>
              <button type="submit" disabled={submittingOrder} 
                className="px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-primary-500/25 disabled:opacity-50 flex items-center gap-3">
                {submittingOrder ? <ArrowPathIcon className="w-6 h-6 animate-spin" /> : <CheckIcon className="w-6 h-6" />}
                {submittingOrder ? "Generando Orden..." : "Finalizar y Crear Orden"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Rezagados Confirm Modal */}
      {showRezagadosConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-amber-200 dark:border-amber-900/50 animate-pop-in">
            <div className="p-8">
              <div className="flex items-center gap-4 text-amber-600 mb-6">
                <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
                  <ExclamationTriangleIcon className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Atención: Rezagados</h4>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-500">¿Excluir estos items de la orden actual?</p>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 mb-8 p-4 max-h-48 overflow-y-auto shadow-inner">
                {showRezagadosConfirm.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>
                    <span className="truncate">{p.display_descripcion}</span>
                    <span className="ml-auto text-slate-400 font-medium">x{p.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => setShowRezagadosConfirm(null)} className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={() => { setShowRezagadosConfirm(null); executeOrderCreation(); }} 
                  className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 transition-all">
                  Confirmar y Generar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Category Integration */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <form onSubmit={handleSaveNewCategory} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 animate-pop-in">
            <div className="mb-6">
              <h4 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Nueva Categoría</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">Clasificación para el nuevo producto</p>
            </div>
            
            {categoryError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{categoryError}</div>}
            
            <input type="text" value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} required placeholder="Nombre de la categoría..."
              className={inputClasses} autoFocus />
            
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setShowNewCategoryModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500">Regresar</button>
              <button type="submit" disabled={submittingCategory} 
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow-lg shadow-green-500/20">
                {submittingCategory ? 'Guardando...' : 'Crear Categoría'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Warning Modal */}
      {showCategoryWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 border border-amber-200 dark:border-amber-900/50 animate-pop-in">
            <div className="flex items-center gap-4 text-amber-600 mb-6">
              <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
                <TagIcon className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Vincular Categorías</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
              El proveedor no tiene asociadas las categorías de los productos seleccionados. ¿Desea realizar la vinculación automática para completar la orden?
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowCategoryWarning(false)} className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancelar</button>
              <button onClick={handleAddCategoriesAndProceed} className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-primary-500/20 transition-all">
                Vincular y Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { ClipboardDocumentListIcon as ClipboardDocumentListIconOutline } from '@heroicons/react/24/outline';
const ClipboardDocumentListIcon = ClipboardDocumentListIconOutline;
