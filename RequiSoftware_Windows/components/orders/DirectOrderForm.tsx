import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, NotificacionInsert } from '../../types';
import { XMarkIcon, CheckIcon, PlusCircleIcon, TrashIcon, ArrowPathIcon, CalendarDaysIcon, TagIcon, ExclamationTriangleIcon, ClipboardDocumentListIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';
import { useOrderCalculations } from '../../hooks/useOrderCalculations';
import { THRESHOLD_ORDEN_GRANDE } from '../../config';
import { createNotifications, fetchAdminUserIds } from '../../services/notificationService';

// Interfaz para ítems de línea en el formulario
interface DirectProductLineItem {
  id: string; // ID único de frontend para la línea
  isNewProduct: boolean;
  
  // Campos para selección de producto existente
  selected_producto_id: number | null;
  
  // Campos para definición de nuevo producto (usados si isNewProduct es verdadero)
  newProduct_descripcion: string;
  newProduct_categoria_id: number | null;
  newProduct_codigo_interno?: string;
  newProduct_unidad_medida?: string;
  newProduct_new_category_name_input?: string; // Entrada para nuevo nombre de categoría

  // Campos comunes para el detalle de la orden
  quantity: number;
  precio_unitario: number;

  // Descripción a mostrar (derivada)
  display_descripcion?: string;
}

interface DirectOrderFormProps {
  show: boolean;
  onHide: () => void;
  userProfile: UserProfile;
  onSuccess: (newOrderInfo: Pick<OrdenCompra, 'id'>) => void;
}

export const DirectOrderForm: React.FC<DirectOrderFormProps> = ({ show, onHide, userProfile, onSuccess }) => {
  const initialLineItemState = (): DirectProductLineItem => ({
    id: uuidv4(),
    isNewProduct: false,
    selected_producto_id: null,
    newProduct_descripcion: '',
    newProduct_categoria_id: null,
    newProduct_codigo_interno: '',
    newProduct_unidad_medida: '',
    newProduct_new_category_name_input: '',
    quantity: 1,
    precio_unitario: 0,
    display_descripcion: '',
  });

  const [productos, setProductos] = useState<DirectProductLineItem[]>([initialLineItemState()]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion' | 'categoria_id'>[]>([]);
  const [productCategories, setProductCategories] = useState<CategoriaProducto[]>([]);
  
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [currentLineItemIdForNewCategory, setCurrentLineItemIdForNewCategory] = useState<string | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string|null>(null);

  // Category Validation State
  const [providerCategories, setProviderCategories] = useState<Set<number>>(new Set());
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [mismatchedProducts, setMismatchedProducts] = useState<{productName: string, categoryId: number, categoryName: string}[]>([]);
  const [addingCategories, setAddingCategories] = useState(false);

  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: undefined, unidad: 'Bs', retencion_porcentaje: 75,
    estado: 'Pendiente', observaciones: '', fecha_entrega_estimada: null,
  });
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsForCalculation = productos.map(p => ({
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
      setError("Error al cargar categorías de productos.");
    }
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

        } catch (err) {
          setError("Error cargando datos iniciales.");
          console.error(err);
        } finally {
          setLoadingInitialData(false);
        }
      };
      loadInitialData();
    } else {
      setProductos([initialLineItemState()]);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fetchProductCategories]);
  
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
    setProductos(prev => [...prev, initialLineItemState()]);
  };

  const handleRemoveProductLine = (id: string) => {
    if (productos.length > 1) {
      setProductos(prev => prev.filter(p => p.id !== id));
    } else {
      setProductos([initialLineItemState()]);
    }
  };

  const handleProductLineChange = (id: string, field: keyof DirectProductLineItem, value: any) => {
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
    setError(null);
    setSubmittingOrder(true);

    if (!userProfile.empleado_id || !userProfile.departamento_id) {
      setError("Perfil de empleado incompleto."); setSubmittingOrder(false); return;
    }
    if (!formData.proveedor_id) {
      setError("Debe seleccionar un proveedor."); setSubmittingOrder(false); return;
    }

    if (calculatedTotals.neto_a_pagar <= 0) {
      setError("El total de la orden de compra no puede ser 0 o menor. Verifique las cantidades y precios.");
      setSubmittingOrder(false); return;
    }
    
    if (productos.length === 0 || productos.some(p => 
        (p.isNewProduct && (!p.newProduct_descripcion?.trim() || !p.newProduct_categoria_id)) ||
        (!p.isNewProduct && !p.selected_producto_id) ||
        p.quantity <= 0 || p.precio_unitario < 0
    )) {
      setError("Asegúrese de que todos los productos tengan descripción y categoría (para nuevos) o selección (para existentes), cantidad positiva y precio no negativo.");
      setSubmittingOrder(false); return;
    }

    try {
      const { data: solicitudData, error: solError } = await (supabase
        .from('solicitudcompra') as any)
        .insert({
          descripcion: `Orden Directa - ${formData.observaciones || new Date().toLocaleDateString()}`,
          estado: 'Aprobada', empleado_id: userProfile.empleado_id, departamento_id: userProfile.departamento_id,
        }).select('id').single();
      if (solError) throw solError;
      const solicitudBaseId = (solicitudData as any).id;

      const ordenPayload: any = {
        solicitud_compra_id: solicitudBaseId, 
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

      const { data: ordenData, error: ordenError } = await (supabase.from('ordencompra') as any).insert(ordenPayload).select('id, neto_a_pagar, codigo_visible').single();
      if (ordenError) throw ordenError;
      const ordenId = (ordenData as any).id;

      const detallesOrdenPayload = await Promise.all(productos.map(async p => {
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

      await (supabase.from('orden_solicitud') as any).insert({ ordencompra_id: ordenId, solicitud_id: solicitudBaseId });

      // --- Notificaciones ---
      const notificationsToCreate: NotificacionInsert[] = [];
      const adminUserIds = await fetchAdminUserIds();
      const selectedProvider = proveedores.find(p => p.id === Number(formData.proveedor_id));

      if (adminUserIds.length > 0) {
        notificationsToCreate.push(...adminUserIds.map(adminId => ({
          user_id: adminId,
          title: 'Nueva Orden de Compra Directa',
          description: `Se ha creado la orden #${ordenData.codigo_visible || ordenId}. Proveedor: ${selectedProvider?.nombre || 'N/D'}. Total: ${ordenData.neto_a_pagar.toLocaleString('es-VE')} ${formData.unidad || 'Bs'}.`,
          type: 'orden_creada',
        })));

        if (ordenData.neto_a_pagar > THRESHOLD_ORDEN_GRANDE) {
          notificationsToCreate.push(...adminUserIds.map(adminId => ({
            user_id: adminId,
            title: 'Alerta de Gasto Elevado en Orden Directa',
            description: `La orden #${ordenId} supera el umbral con un total de ${ordenData.neto_a_pagar.toLocaleString('es-VE')} ${formData.unidad || 'Bs'}.`,
            type: 'alerta_gasto_orden',
          })));
        }
      }
      
      if(notificationsToCreate.length > 0) {
        await createNotifications(notificationsToCreate);
      }

      onSuccess({ id: ordenId });
      onHide();

    } catch (err: any) {
      setError(`Error al crear la orden directa: ${err.message || "Error desconocido"}`);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.proveedor_id) return;

    const mismatches: {productName: string, categoryId: number, categoryName: string}[] = [];
    const mismatchedCategoryIds = new Set<number>();

    for (const item of productos) {
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
              <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Crear Orden Directa</h3>
              <p className="text-sm text-slate-500 font-medium">Genere una nueva orden de compra sin requerimiento previo</p>
            </div>
          </div>
          <button onClick={onHide} disabled={submittingOrder} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        {loadingInitialData ? (
          <div className="flex-grow flex items-center justify-center p-20">
            <LoadingSpinner message="Inicializando formulario..." />
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
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Proveedor <span className="text-red-500">*</span></label>
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
              <h4 className="text-lg font-display font-bold text-slate-800 dark:text-slate-200 px-1">Productos a Ordenar</h4>
              
              <div className="grid gap-4">
                {productos.map((item) => (
                  <div key={item.id} className="group relative p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <button type="button" onClick={() => handleProductLineChange(item.id, 'isNewProduct', !item.isNewProduct)}
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
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Descripción <span className="text-red-500">*</span></label>
                              <input type="text" value={item.newProduct_descripcion} onChange={(e) => handleProductLineChange(item.id, 'newProduct_descripcion', e.target.value)} required
                                className={smallInputClasses} placeholder="Nombre del producto" />
                            </div>
                            <div className="col-span-12 md:col-span-5">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Categoría <span className="text-red-500">*</span></label>
                              <div className="flex items-center gap-2">
                                <select value={item.newProduct_categoria_id || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_categoria_id', Number(e.target.value))} required
                                  className={smallInputClasses}>
                                  <option value="">Seleccionar...</option>
                                  {productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                                </select>
                                <button type="button" onClick={() => handleOpenNewCategoryModal(item.id)} className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl hover:bg-green-100 transition-colors">
                                  <PlusCircleIcon className="w-5 h-5"/>
                                </button>
                              </div>
                            </div>
                            <div className="col-span-12 md:col-span-7">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Código Interno / Unidad Medida (Opc.)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" value={item.newProduct_codigo_interno || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_codigo_interno', e.target.value)} className={smallInputClasses} placeholder="Código" />
                                    <input type="text" value={item.newProduct_unidad_medida || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_unidad_medida', e.target.value)} className={smallInputClasses} placeholder="Unidad (Pza, Kg...)" />
                                </div>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-12 md:col-span-7">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Buscar en Catálogo <span className="text-red-500">*</span></label>
                            <select value={item.selected_producto_id || ''} onChange={(e) => handleProductLineChange(item.id, 'selected_producto_id', Number(e.target.value))} required={!item.isNewProduct}
                              className={smallInputClasses}>
                              <option value="">-- Buscar Producto --</option>
                              {fetchedDbProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                            </select>
                          </div>
                        )}

                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Cantidad <span className="text-red-500">*</span></label>
                          <input type="number" value={item.quantity} min="1" onChange={(e) => handleProductLineChange(item.id, 'quantity', Number(e.target.value))}
                            className={smallInputClasses} required />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Precio Unitario ({formData.unidad}) <span className="text-red-500">*</span></label>
                          <input type="number" value={item.precio_unitario} step="0.01" min="0" onChange={(e) => handleProductLineChange(item.id, 'precio_unitario', Number(e.target.value))}
                            className={smallInputClasses} required placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleAddProductLine} disabled={submittingOrder} 
                className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-sm font-bold text-slate-400 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 group">
                <PlusCircleIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Añadir Otro Producto
              </button>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6">
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 ml-1">Observaciones Finales</label>
                <textarea name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={6} 
                  className={`${inputClasses} resize-none`} placeholder="Condiciones, plazos, lugar de entrega..."/>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 shadow-inner">
                <h4 className="text-lg font-display font-black text-slate-900 dark:text-white mb-4 border-b dark:border-slate-800 pb-4 uppercase tracking-tighter">Resumen de Liquidación</h4>
                
                <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400">
                  <span>Monto Imponible (Subtotal):</span>
                  <span className="text-slate-900 dark:text-white">{calculatedTotals.sub_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>
                
                <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400">
                  <span>IVA Aplicable (16%):</span>
                  <span className="text-slate-900 dark:text-white">{calculatedTotals.iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-y border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Porcentaje Retención:</span>
                    <input type="number" name="retencion_porcentaje" value={formData.retencion_porcentaje === null ? '' : formData.retencion_porcentaje} min="0" max="100" onChange={handleFormInputChange} 
                      className="w-14 p-1 text-center border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold dark:bg-slate-800" />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-sm font-bold text-red-500">-{calculatedTotals.ret_iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {formData.unidad}</span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-display font-black text-primary-700 dark:text-primary-400 uppercase">Monto Neto a Pagar:</span>
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
                {submittingOrder ? "Procesando Orden..." : "Generar Orden Compra"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <form onSubmit={handleSaveNewCategory} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 animate-pop-in">
            <div className="mb-6">
              <h4 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Añadir Categoría</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">Nueva clasificación para el catálogo</p>
            </div>
            {categoryError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{categoryError}</div>}
            <input type="text" value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} required placeholder="Nombre de la categoría..." className={inputClasses} autoFocus />
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setShowNewCategoryModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500">Regresar</button>
              <button type="submit" disabled={submittingCategory} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow-lg shadow-green-500/20">
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
              <h4 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Categorías faltantes</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
              Algunos productos tienen categorías que el proveedor no maneja. ¿Desea vincular estas categorías automáticamente al perfil del proveedor?
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