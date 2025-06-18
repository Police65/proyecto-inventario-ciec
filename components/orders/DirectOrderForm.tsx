import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, NotificacionInsert } from '../../types';
import { XMarkIcon, CheckIcon, PlusCircleIcon, TrashIcon, ArrowPathIcon, CalendarDaysIcon, TagIcon } from '@heroicons/react/24/outline';
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
  // Almacenar temporalmente el nuevo nombre de categoría si el usuario está creando una
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
  const [proveedores, setProveedores] = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion' | 'categoria_id'>[]>([]);
  const [productCategories, setProductCategories] = useState<CategoriaProducto[]>([]);
  
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [currentLineItemIdForNewCategory, setCurrentLineItemIdForNewCategory] = useState<string | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string|null>(null);


  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: undefined, unidad: 'Bs', retencion_porcentaje: 75,
    sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0,
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
          const { data: provData, error: provError } = await supabase.from('proveedor').select('id, nombre');
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
      setFormData({ proveedor_id: undefined, unidad: 'Bs', retencion_porcentaje: 75, sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0, estado: 'Pendiente', observaciones: '', fecha_entrega_estimada: null });
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fetchProductCategories]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      sub_total: calculatedTotals.sub_total,
      iva: calculatedTotals.iva,
      ret_iva: calculatedTotals.ret_iva,
      neto_a_pagar: calculatedTotals.neto_a_pagar,
    }));
  }, [calculatedTotals]);


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
          updatedItem.newProduct_descripcion = ''; // Limpiar descripción de nuevo producto
          updatedItem.isNewProduct = false;
          updatedItem.newProduct_categoria_id = selectedDbProd?.categoria_id || null;
        } else if (field === 'newProduct_descripcion') {
            updatedItem.display_descripcion = value;
            // Si el usuario comienza a escribir una nueva descripción, asegurar que esté en modo "nuevo producto"
            if (!updatedItem.isNewProduct && !updatedItem.selected_producto_id) {
                updatedItem.isNewProduct = true;
            }
        } else if (field === 'isNewProduct') {
            if (value === true) { // Cambiando a modo nuevo producto
                updatedItem.selected_producto_id = null;
                updatedItem.display_descripcion = updatedItem.newProduct_descripcion || '';
            } else { // Cambiando a modo producto existente
                updatedItem.newProduct_descripcion = '';
                updatedItem.newProduct_categoria_id = null;
                // display_descripcion se establecerá si/cuando se seleccione un producto
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
      const { data: newCategory, error: insertError } = await supabase
        .from('categoria_producto')
        .insert({ nombre: newCategoryNameInput.trim() })
        .select()
        .single();
      if (insertError) throw insertError;
      
      await fetchProductCategories(); // Refrescar lista de categorías

      if (newCategory && currentLineItemIdForNewCategory) {
        setProductos(prevItems => prevItems.map(item =>
          item.id === currentLineItemIdForNewCategory
            ? { ...item, newProduct_categoria_id: newCategory.id }
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


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmittingOrder(true);

    if (!userProfile.empleado_id || !userProfile.departamento_id) {
      setError("Perfil de empleado incompleto."); setSubmittingOrder(false); return;
    }
    if (!formData.proveedor_id) {
      setError("Debe seleccionar un proveedor."); setSubmittingOrder(false); return;
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
      const { data: solicitudData, error: solError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: `Orden Directa - ${formData.observaciones || new Date().toLocaleDateString()}`,
          estado: 'Aprobada', empleado_id: userProfile.empleado_id, departamento_id: userProfile.departamento_id,
        }).select('id').single();
      if (solError) throw solError;
      if (!solicitudData) throw new Error("No se pudo crear la solicitud base para la orden directa.");
      const solicitudBaseId = solicitudData.id;

      const ordenPayload: Omit<OrdenCompra, 'id'|'fecha_modificacion'|'detalles'|'empleado'|'proveedor'|'solicitud_compra' | 'factura' | 'created_at' | 'updated_at' | 'fecha_orden'> = {
        solicitud_compra_id: solicitudBaseId, proveedor_id: Number(formData.proveedor_id),
        estado: formData.estado || 'Pendiente', sub_total: formData.sub_total || 0,
        iva: formData.iva || 0, ret_iva: formData.ret_iva || 0, neto_a_pagar: formData.neto_a_pagar || 0,
        unidad: formData.unidad as OrdenCompraUnidad || 'Bs', observaciones: formData.observaciones || null,
        empleado_id: userProfile.empleado_id,
        retencion_porcentaje: formData.retencion_porcentaje === null ? 0 : formData.retencion_porcentaje,
        precio_unitario: 0, changed_by: userProfile.empleado_id,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null, fecha_entrega_real: null
      };
      const { data: ordenData, error: ordenError } = await supabase.from('ordencompra').insert(ordenPayload).select('id, neto_a_pagar').single(); // También seleccionar neto_a_pagar para alerta
      if (ordenError) throw ordenError;
      if (!ordenData) throw new Error("No se pudo crear la orden de compra.");
      const ordenId = ordenData.id;

      const detallesOrdenPayload = await Promise.all(productos.map(async p => {
        let productoRealId = p.selected_producto_id;
        // let productoDescripcionFinal = p.display_descripcion; // No usado ya que 'descripcion_producto_personalizado' se eliminó

        if (p.isNewProduct) {
          const newProdData: Partial<Producto> = {
            descripcion: p.newProduct_descripcion,
            categoria_id: p.newProduct_categoria_id,
            codigo_interno: p.newProduct_codigo_interno || null,
            unidad_medida: p.newProduct_unidad_medida || null,
          };
          const { data: newProd, error: newProdError } = await supabase.from('producto').insert(newProdData).select('id, descripcion').single();
          if (newProdError) throw new Error(`Error creando producto '${p.newProduct_descripcion}': ${newProdError.message}`);
          if (!newProd) throw new Error(`No se pudo crear el producto '${p.newProduct_descripcion}'.`);
          productoRealId = newProd.id;
          // productoDescripcionFinal = newProd.descripcion; // No usado para el payload
        }
        if (!productoRealId) throw new Error("Producto inválido en la línea de orden.");

        return {
          orden_compra_id: ordenId, producto_id: productoRealId,
          cantidad: Number(p.quantity), precio_unitario: Number(p.precio_unitario),
          // descripcion_producto_personalizado: p.isNewProduct ? productoDescripcionFinal : null, // REMOVED
        };
      }));

      const { error: detallesError } = await supabase.from('ordencompra_detalle').insert(detallesOrdenPayload);
      if (detallesError) throw detallesError;

      await supabase.from('orden_solicitud').insert({ ordencompra_id: ordenId, solicitud_id: solicitudBaseId });

      // --- Notificaciones ---
      const notificationsToCreate: NotificacionInsert[] = [];
      const adminUserIds = await fetchAdminUserIds();
      const selectedProvider = proveedores.find(p => p.id === Number(formData.proveedor_id));


      if (adminUserIds.length > 0) {
        notificationsToCreate.push(...adminUserIds.map(adminId => ({
          user_id: adminId,
          title: 'Nueva Orden de Compra Directa Creada',
          description: `Se ha creado la orden directa #${ordenId}. Proveedor: ${selectedProvider?.nombre || 'N/D'}. Total: ${ordenData.neto_a_pagar.toLocaleString('es-VE')} ${formData.unidad || 'Bs'}.`,
          type: 'orden_creada', // Usando 'orden_creada' genérico
          // related_id: ordenId, // Eliminado
        })));

        if (ordenData.neto_a_pagar > THRESHOLD_ORDEN_GRANDE) {
          notificationsToCreate.push(...adminUserIds.map(adminId => ({
            user_id: adminId,
            title: 'Alerta de Gasto Elevado en Orden Directa',
            description: `La orden directa #${ordenId} supera el umbral (${THRESHOLD_ORDEN_GRANDE.toLocaleString('es-VE')} Bs) con un total de ${ordenData.neto_a_pagar.toLocaleString('es-VE')} ${formData.unidad || 'Bs'}.`,
            type: 'alerta_gasto_orden',
            // related_id: ordenId, // Eliminado
          })));
        }
      }
      
      if(notificationsToCreate.length > 0) {
        await createNotifications(notificationsToCreate);
      }

      onSuccess({ id: ordenId });
      onHide();

    } catch (err) {
      const supabaseError = err as { code?: string; message: string };
      const defaultMessage = "Error desconocido al crear la orden directa.";
      if (supabaseError.code === '23505') {
           setError(`Error al crear la orden directa: Ya existe un registro con un valor único similar. (${supabaseError.message || defaultMessage})`);
      } else {
          setError(`Error al crear la orden directa: ${supabaseError.message || defaultMessage}`);
      }
      console.error("Error creating direct order:", err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Orden de Compra Directa</h3>
          <button onClick={onHide} disabled={submittingOrder} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {(loadingInitialData && productos.length === 1 && !productos[0].selected_producto_id && !productos[0].newProduct_descripcion) ? <div className="p-10 flex-grow flex items-center justify-center"><LoadingSpinner message="Cargando formulario..." /></div> : (
          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5">
            {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <label htmlFor="direct_proveedor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
                <select id="direct_proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleFormInputChange} required
                    className="w-full px-3 py-2 border input-field">
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                </div>
                <div>
                <label htmlFor="direct_unidad" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad Monetaria</label>
                <select id="direct_unidad" name="unidad" value={formData.unidad || 'Bs'} onChange={handleFormInputChange}
                    className="w-full px-3 py-2 border input-field">
                    <option value="Bs">Bolívares (Bs)</option>
                    <option value="USD">Dólares (USD)</option>
                </select>
                </div>
                <div>
                    <label htmlFor="direct_fecha_entrega_estimada" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Entrega Estimada</label>
                    <div className="relative">
                        <input type="date" id="direct_fecha_entrega_estimada" name="fecha_entrega_estimada" value={formData.fecha_entrega_estimada || ''} onChange={handleFormInputChange}
                            className="w-full px-3 py-2 border input-field pr-8" />
                        <CalendarDaysIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Productos a Ordenar <span className="text-red-500">*</span></h4>
              {productos.map((item) => (
                <div key={item.id} className="p-3 border dark:border-gray-700 rounded-md space-y-2 bg-gray-50 dark:bg-gray-900/40 shadow-sm">
                  <div className="flex items-center justify-end mb-1">
                     <button type="button" onClick={() => handleProductLineChange(item.id, 'isNewProduct', !item.isNewProduct)}
                        className={`px-2 py-1 text-xs rounded-md ${item.isNewProduct ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                        {item.isNewProduct ? 'Usar Existente' : 'Crear Nuevo Producto'}
                     </button>
                  </div>
                  {item.isNewProduct ? (
                    // Formulario para nuevo producto
                    <div className="space-y-2">
                      <div>
                        <label htmlFor={`newDesc-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Descripción Nuevo Producto <span className="text-red-500">*</span></label>
                        <input type="text" id={`newDesc-${item.id}`} value={item.newProduct_descripcion} onChange={(e) => handleProductLineChange(item.id, 'newProduct_descripcion', e.target.value)} required
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" placeholder="Nombre del nuevo producto"/>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label htmlFor={`newCat-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Categoría <span className="text-red-500">*</span></label>
                            <div className="flex items-center space-x-1">
                                <select id={`newCat-${item.id}`} value={item.newProduct_categoria_id || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_categoria_id', e.target.value ? Number(e.target.value) : null)} required
                                        className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm">
                                    <option value="">-- Seleccionar --</option>
                                    {productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                                </select>
                                <button type="button" onClick={() => handleOpenNewCategoryModal(item.id)} title="Añadir Nueva Categoría"
                                        className="p-1.5 mt-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700/50">
                                    <TagIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor={`newCod-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cód. Interno (Opc.)</label>
                            <input type="text" id={`newCod-${item.id}`} value={item.newProduct_codigo_interno || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_codigo_interno', e.target.value)}
                                   className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Selector para producto existente
                    <div>
                      <label htmlFor={`d_prod_sel_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Producto Existente <span className="text-red-500">*</span></label>
                      <select id={`d_prod_sel_${item.id}`} value={item.selected_producto_id || ''} onChange={(e) => handleProductLineChange(item.id, 'selected_producto_id', e.target.value ? Number(e.target.value) : null)} required={!item.isNewProduct}
                              className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm">
                        <option value="">-- Seleccionar Producto --</option>
                        {fetchedDbProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                    <div className="sm:col-span-5">
                        <label htmlFor={`d_qty_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cantidad <span className="text-red-500">*</span></label>
                        <input type="number" id={`d_qty_${item.id}`} value={item.quantity} min="1" onChange={(e) => handleProductLineChange(item.id, 'quantity', Number(e.target.value))}
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" required />
                    </div>
                    <div className="sm:col-span-5">
                        <label htmlFor={`d_price_${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Precio Unit. <span className="text-red-500">*</span></label>
                        <input type="number" id={`d_price_${item.id}`} value={item.precio_unitario} step="0.01" min="0" onChange={(e) => handleProductLineChange(item.id, 'precio_unitario', Number(e.target.value))}
                               className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" required />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-end md:justify-start">
                        <button type="button" onClick={() => handleRemoveProductLine(item.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900 self-center" title="Eliminar producto" disabled={submittingOrder}>
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddProductLine} disabled={submittingOrder}
                className="mt-2 flex items-center px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none disabled:opacity-50">
                <PlusCircleIcon className="w-5 h-5 mr-2" />Añadir Otro Producto
              </button>
            </div>

            <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg space-y-2 border dark:border-gray-600">
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-2">Resumen de Pago</h4>
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300"><span>Subtotal:</span><span>{formData.sub_total?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div>
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300"><span>IVA (16%):</span><span>{formData.iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div>
                <div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300"><label htmlFor="direct_retencion_porcentaje" className="whitespace-nowrap mr-2">Retención IVA (%):</label><input type="number" id="direct_retencion_porcentaje" name="retencion_porcentaje" value={formData.retencion_porcentaje === null ? '' : formData.retencion_porcentaje} min="0" max="100" onChange={handleFormInputChange} className="w-20 px-2 py-1 border input-field text-sm" /><span className="ml-auto">{formData.ret_iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div>
                <div className="flex justify-between text-md font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600"><span>Neto a Pagar:</span><span>{formData.neto_a_pagar?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div>
            </div>
            <div><label htmlFor="direct_observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label><textarea id="direct_observaciones" name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={3} className="w-full px-3 py-2 border input-field" placeholder="Condiciones de pago, tiempo de entrega, etc."/></div>
            <div className="pt-5 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 py-3 z-10 border-t dark:border-gray-700"><button type="button" onClick={onHide} disabled={submittingOrder} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">Cancelar</button><button type="submit" disabled={submittingOrder || loadingInitialData} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">{submittingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckIcon className="w-5 h-5 mr-1.5 -ml-1" />}{submittingOrder ? "Creando..." : "Crear Orden Directa"}</button></div>
          </form>
        )}
      </div>
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <form onSubmit={handleSaveNewCategory} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Añadir Nueva Categoría de Producto</h4>
                {categoryError && <p className="text-xs text-red-500 mb-2">{categoryError}</p>}
                <div>
                    <label htmlFor="newCategoryNameInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Categoría <span className="text-red-500">*</span></label>
                    <input type="text" id="newCategoryNameInput" value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} required
                           className="mt-1 w-full px-3 py-2 border input-field" />
                </div>
                <div className="mt-4 flex justify-end space-x-2">
                    <button type="button" onClick={() => setShowNewCategoryModal(false)} disabled={submittingCategory}
                            className="px-3 py-1.5 text-sm btn-secondary">Cancelar</button>
                    <button type="submit" disabled={submittingCategory}
                            className="px-3 py-1.5 text-sm btn-primary flex items-center">
                        {submittingCategory && <ArrowPathIcon className="w-4 h-4 animate-spin mr-1.5"/>}
                        Guardar Categoría
                    </button>
                </div>
            </form>
        </div>
      )}
       <style>{`
        .input-field {display: block; width: 100%; font-size: 0.875rem; line-height: 1.25rem; border-width: 1px; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);}
        .dark .input-field {background-color: #374151; border-color: #4B5563; color: #F3F4F6;}
        .dark .input-field::placeholder {color: #9CA3AF;}
        .input-field:focus {outline: 2px solid transparent; outline-offset: 2px; --tw-ring-offset-width: 0px; --tw-ring-color: #3b82f6; border-color: #3b82f6; box-shadow: 0 0 0 2px var(--tw-ring-color);}
        .btn-primary {background-color: #2563eb; color: white; font-weight: 500; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);}
        .btn-primary:hover {background-color: #1d4ed8;}
        .btn-primary:disabled {background-color: #93c5fd; opacity: 0.7;}
        .btn-secondary {background-color: #f3f4f6; color: #374151; font-weight: 500; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);}
        .btn-secondary:hover {background-color: #e5e7eb;}
        .dark .btn-secondary {background-color: #4b5563; color: #e5e7eb; border-color: #6b7280;}
        .dark .btn-secondary:hover {background-color: #374151;}
      `}</style>
    </div>
  );
};
