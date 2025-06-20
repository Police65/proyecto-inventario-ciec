import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { UserProfile, Proveedor, Producto, OrdenCompra, OrdenCompraUnidad, OrdenCompraFormData, CategoriaProducto, ProductSelectionItem } from '../../types';
import { XMarkIcon, CheckIcon, ArrowPathIcon, CalendarDaysIcon, PlusCircleIcon, TagIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { useOrderCalculations } from '../../hooks/useOrderCalculations';
import { v4 as uuidv4 } from 'uuid';


// ProductLineItem extendido para OrderForm para manejar la creación de nuevos productos
interface OrderFormProductLineItem {
  id: string; // ID único de frontend (puede ser producto_id original para existentes, o uuid para nuevos/personalizados)
  original_producto_id: number | null; // ID de la solicitud, si aplica
  
  isNewProductMode: boolean; // Verdadero si esta línea es para un producto nuevo no proveniente de la solicitud original
  
  // Campos para producto existente (de solicitud o seleccionado)
  selected_producto_id: number | null; 
  
  // Campos para definición de nuevo producto (usados si isNewProductMode es verdadero)
  newProduct_descripcion: string;
  newProduct_categoria_id: number | null;
  newProduct_codigo_interno?: string;
  newProduct_unidad_medida?: string;

  // Campos comunes
  display_descripcion: string; // Qué mostrar en la UI, podría ser original, seleccionado, o nuevo
  quantity: number;
  precio_unitario: number;
  seleccionado: boolean; // Si este ítem está incluido en la orden final
  motivoRechazo?: string; // Si no está seleccionado
}


interface OrderFormProps {
  show: boolean;
  onHide: () => void;
  userProfile: UserProfile;
  onSuccess: (newOrderInfo: Pick<OrdenCompra, 'id'>) => void;
  initialProducts?: ProductSelectionItem[]; // De solicitud u orden consolidada
  proveedorId?: number | null;
  solicitudesIds?: number[];
}

const OrderForm: React.FC<OrderFormProps> = ({
  show, onHide, userProfile, onSuccess,
  initialProducts = [], proveedorId = null, solicitudesIds = []
}) => {
  const [productosParaOrden, setProductosParaOrden] = useState<OrderFormProductLineItem[]>([]);
  const [proveedores, setProveedores] = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([]);
  const [fetchedDbProducts, setFetchedDbProducts] = useState<Pick<Producto, 'id' | 'descripcion' | 'categoria_id'>[]>([]);
  const [productCategories, setProductCategories] = useState<CategoriaProducto[]>([]);

  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [currentLineItemIdForNewCategory, setCurrentLineItemIdForNewCategory] = useState<string | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string|null>(null);

  const [formData, setFormData] = useState<Partial<OrdenCompraFormData>>({
    proveedor_id: proveedorId === null ? undefined : proveedorId, unidad: 'Bs', retencion_porcentaje: 75,
    sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0,
    estado: 'Pendiente', observaciones: '', fecha_entrega_estimada: null,
  });
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatInitialProductsToLineItems = useCallback(() => {
    return initialProducts.map((p) => ({
      id: p.id?.toString() || uuidv4(), // Usar producto_id si está disponible, sino generar uuid
      original_producto_id: p.id || null,
      isNewProductMode: false, // Inicialmente, los ítems de la solicitud no están en "modo nuevo producto"
      selected_producto_id: p.id || null,
      newProduct_descripcion: '',
      newProduct_categoria_id: p.categoria_id || null, 
      newProduct_codigo_interno: p.codigo_interno || '',
      newProduct_unidad_medida: p.unidad_medida || '',
      display_descripcion: p.descripcion,
      quantity: Number(p.quantity) || 1,
      precio_unitario: Number(p.precio_unitario) || 0,
      seleccionado: p.selected !== undefined ? p.selected : true, // Por defecto seleccionado si no se especifica
      motivoRechazo: p.motivo || '',
    }));
  }, [initialProducts]);

  const productsForCalculation = productosParaOrden.filter(p => p.seleccionado).map(p => ({
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
      console.error("Error fetching product categories for OrderForm:", err);
      // No establecer error global, permitir que el formulario cargue
    }
  }, []);


  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      setError(null);
      const cargarDatos = async () => {
        try {
          const { data: proveedoresData, error: provError } = await supabase.from('proveedor').select('id, nombre');
          if (provError) throw provError;
          setProveedores(proveedoresData || []);

          const { data: dbProdData, error: dbProdError } = await supabase.from('producto').select('id, descripcion, categoria_id');
          if (dbProdError) throw dbProdError;
          setFetchedDbProducts(dbProdData || []);
          
          await fetchProductCategories();

          const formatted = formatInitialProductsToLineItems();
          setProductosParaOrden(formatted);

          setFormData(prev => ({
            ...prev,
            proveedor_id: proveedorId === null ? undefined : (proveedorId || prev.proveedor_id || undefined),
            retencion_porcentaje: prev.retencion_porcentaje === undefined ? 75 : prev.retencion_porcentaje,
            unidad: prev.unidad || 'Bs', estado: prev.estado || 'Pendiente',
            fecha_entrega_estimada: prev.fecha_entrega_estimada || null,
          }));
        } catch (err) {
          console.error("Error loading data for order form:", err);
          setError("Error al cargar datos necesarios.");
        } finally {
          setLoadingInitialData(false);
        }
      };
      cargarDatos();
    } else {
      setProductosParaOrden([]);
      setFormData({ proveedor_id: undefined, unidad: 'Bs', retencion_porcentaje: 75, sub_total: 0, iva: 0, ret_iva: 0, neto_a_pagar: 0, estado: 'Pendiente', observaciones: '', fecha_entrega_estimada: null });
      setError(null);
    }
  }, [show, proveedorId, formatInitialProductsToLineItems, fetchProductCategories]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      sub_total: calculatedTotals.sub_total, iva: calculatedTotals.iva,
      ret_iva: calculatedTotals.ret_iva, neto_a_pagar: calculatedTotals.neto_a_pagar,
    }));
  }, [calculatedTotals]);


  const handleProductLineChange = (id: string, field: keyof OrderFormProductLineItem, value: any) => {
    setProductosParaOrden(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'selected_producto_id') {
          const selectedDbProd = fetchedDbProducts.find(dbP => dbP.id === Number(value));
          updatedItem.display_descripcion = selectedDbProd?.descripcion || '';
          // Restablecer campos de nuevo producto si se elige uno existente
          updatedItem.newProduct_descripcion = ''; 
          updatedItem.isNewProductMode = false;
          updatedItem.newProduct_categoria_id = selectedDbProd?.categoria_id || null;

        } else if (field === 'newProduct_descripcion') {
            updatedItem.display_descripcion = value;
            if (updatedItem.isNewProductMode) { // Actualizar display_desc solo si está en modo nuevo producto
                 updatedItem.display_descripcion = value;
            }
        } else if (field === 'isNewProductMode') {
            if (value === true) { // Cambiando a modo nuevo producto
                updatedItem.selected_producto_id = null;
                updatedItem.original_producto_id = null; // Ya no está vinculado a un ítem original
                updatedItem.display_descripcion = updatedItem.newProduct_descripcion || '';
            } else { // Cambiando a modo producto existente (podría ser de un ítem de solicitud original o un producto general de la BD)
                updatedItem.newProduct_descripcion = '';
                updatedItem.newProduct_categoria_id = null;
                updatedItem.display_descripcion = item.original_producto_id 
                    ? initialProducts.find(ip => ip.id === item.original_producto_id)?.descripcion || ''
                    : ''; // Si no hay original, esperar selección
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
    setFormData(prev => ({ ...prev, [name]: name === 'fecha_entrega_estimada' ? (value === '' ? null : value) : (numericFields.includes(name) ? (value ? Number(value) : undefined) : value) }));
  };
  
  const handleAddCustomLineItem = () => {
    setProductosParaOrden(prev => [...prev, {
      id: uuidv4(), original_producto_id: null, isNewProductMode: true, selected_producto_id: null,
      newProduct_descripcion: '', newProduct_categoria_id: null, display_descripcion: '',
      quantity: 1, precio_unitario: 0, seleccionado: true,
    }]);
  };

  const handleOpenNewCategoryModal = (lineId: string) => {
    setCurrentLineItemIdForNewCategory(lineId); setNewCategoryNameInput('');
    setCategoryError(null); setShowNewCategoryModal(true);
  };

  const handleSaveNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryNameInput.trim()) { setCategoryError("El nombre es obligatorio."); return; }
    setSubmittingCategory(true); setCategoryError(null);
    try {
      const { data: newCategory, error: insertError } = await supabase.from('categoria_producto').insert({ nombre: newCategoryNameInput.trim() }).select().single();
      if (insertError) throw insertError;
      await fetchProductCategories();
      if (newCategory && currentLineItemIdForNewCategory) {
        setProductosParaOrden(prevItems => prevItems.map(item => item.id === currentLineItemIdForNewCategory ? { ...item, newProduct_categoria_id: newCategory.id } : item ));
      }
      setShowNewCategoryModal(false); setCurrentLineItemIdForNewCategory(null);
    } catch (err) {
      const e = err as any;
      if (e.code === '23505') setCategoryError('Error: Categoría ya existe.');
      else setCategoryError('Error al guardar.');
      console.error(err);
    } finally { setSubmittingCategory(false); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null); setSubmittingOrder(true);
    if (!userProfile.empleado_id) { setError("Perfil de empleado no encontrado."); setSubmittingOrder(false); return; }
    if (!formData.proveedor_id) { setError("Debe seleccionar un proveedor."); setSubmittingOrder(false); return; }
    
    const productosFinales = productosParaOrden.filter(p => p.seleccionado);
    if (productosFinales.length === 0) { setError("Debe seleccionar al menos un producto."); setSubmittingOrder(false); return; }

    if (productosFinales.some(p => 
        (p.isNewProductMode && (!p.newProduct_descripcion?.trim() || !p.newProduct_categoria_id)) ||
        (!p.isNewProductMode && !p.selected_producto_id) ||
        p.quantity <= 0 || p.precio_unitario < 0
    )) {
      setError("Verifique que todos los productos seleccionados tengan descripción/categoría (nuevos) o selección (existentes), cantidad positiva y precio no negativo.");
      setSubmittingOrder(false); return;
    }

    try {
      const ordenPayload: Omit<OrdenCompra, 'id'|'fecha_modificacion'|'detalles'|'empleado'|'proveedor'|'solicitud_compra' | 'factura' | 'created_at' | 'updated_at' | 'fecha_orden'> = {
        solicitud_compra_id: (solicitudesIds && solicitudesIds.length > 0) ? solicitudesIds[0] : null, // Usar el primero si hay múltiples, o nulo
        proveedor_id: Number(formData.proveedor_id), estado: formData.estado || 'Pendiente',
        sub_total: formData.sub_total || 0, iva: formData.iva || 0, ret_iva: formData.ret_iva || 0, neto_a_pagar: formData.neto_a_pagar || 0,
        unidad: formData.unidad as OrdenCompraUnidad || 'Bs', observaciones: formData.observaciones || null, empleado_id: userProfile.empleado_id,
        retencion_porcentaje: formData.retencion_porcentaje === null ? 0 : formData.retencion_porcentaje,
        precio_unitario: 0, changed_by: userProfile.empleado_id,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null, fecha_entrega_real: null
      };
      const { data: ordenData, error: ordenError } = await supabase.from('ordencompra').insert(ordenPayload).select('id').single();
      if (ordenError) throw ordenError;
      if (!ordenData) throw new Error("No se pudo crear la orden.");
      const ordenId = ordenData.id;

      const detallesOrden = await Promise.all(productosFinales.map(async p => {
        let productoRealId = p.selected_producto_id;
        // let descripcionParaDetalle = p.display_descripcion; // No usado para el payload

        if (p.isNewProductMode) {
          const newProdData: Partial<Producto> = {
            descripcion: p.newProduct_descripcion, categoria_id: p.newProduct_categoria_id,
            codigo_interno: p.newProduct_codigo_interno || null, unidad_medida: p.newProduct_unidad_medida || null,
          };
          const { data: newProd, error: newProdError } = await supabase.from('producto').insert(newProdData).select('id, descripcion').single();
          if (newProdError) throw new Error(`Error creando producto '${p.newProduct_descripcion}': ${newProdError.message}`);
          if (!newProd) throw new Error(`No se pudo crear el producto '${p.newProduct_descripcion}'.`);
          productoRealId = newProd.id;
          // descripcionParaDetalle = newProd.descripcion; // No usado para el payload
        }
        if (!productoRealId) throw new Error(`Producto ID es nulo para '${p.display_descripcion || 'un item'}'.`);
        
        return {
          orden_compra_id: ordenId, producto_id: productoRealId,
          cantidad: Number(p.quantity), precio_unitario: Number(p.precio_unitario),
          // descripcion_producto_personalizado: p.isNewProductMode ? descripcionParaDetalle : null, // REMOVED
        };
      }));
      const { error: detallesError } = await supabase.from('ordencompra_detalle').insert(detallesOrden);
      if (detallesError) throw detallesError;

      const productosRezagados = productosParaOrden.filter(p => !p.seleccionado && (p.original_producto_id || p.selected_producto_id));
      if (productosRezagados.length > 0) {
        const rezagadosPayload = productosRezagados.map(p => ({
          orden_compra_id: ordenId, producto_id: p.original_producto_id || p.selected_producto_id,
          cantidad: Number(p.quantity), motivo: p.motivoRechazo || 'No especificado',
          solicitud_id: (solicitudesIds && solicitudesIds.length > 0) ? solicitudesIds[0] : null,
        }));
        await supabase.from('productos_rezagados').insert(rezagadosPayload);
      }

      if (solicitudesIds && solicitudesIds.length > 0) {
        const ordenSolicitudLinks = solicitudesIds.map(solId => ({ ordencompra_id: ordenId, solicitud_id: solId }));
        await supabase.from('orden_solicitud').insert(ordenSolicitudLinks);
        await supabase.from('solicitudcompra').update({ estado: 'Aprobada' }).in('id', solicitudesIds);
      }
      onSuccess({ id: ordenId });
      onHide();
    } catch (err) {
      const supabaseError = err as { code?: string; message: string };
      const messageToSet: string | null = supabaseError.message || "Error desconocido al crear la orden.";
      setError(messageToSet);
      console.error("Error creating order:", err);
    } finally { setSubmittingOrder(false); }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10"><h3 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Orden de Compra</h3><button onClick={onHide} disabled={submittingOrder} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md"><XMarkIcon className="w-6 h-6" /></button></div>
        {(loadingInitialData && !productosParaOrden.length) ? <div className="p-10 flex-grow flex items-center justify-center"><LoadingSpinner message="Cargando formulario..." /></div> : (
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5">
          {error && <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="proveedor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label><select id="proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleFormInputChange} required className="w-full px-3 py-2 border input-field"><option value="">Seleccionar...</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div><label htmlFor="unidad" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad Monetaria</label><select id="unidad" name="unidad" value={formData.unidad || 'Bs'} onChange={handleFormInputChange} className="w-full px-3 py-2 border input-field"><option value="Bs">Bs</option><option value="USD">USD</option></select></div>
            <div><label htmlFor="fecha_entrega_estimada" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">F. Entrega Estimada</label><div className="relative"><input type="date" id="fecha_entrega_estimada" name="fecha_entrega_estimada" value={formData.fecha_entrega_estimada || ''} onChange={handleFormInputChange} className="w-full px-3 py-2 border input-field pr-8" /><CalendarDaysIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" /></div></div>
          </div>
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Productos <span className="text-red-500">*</span></h4>
            {productosParaOrden.map((item) => (
              <div key={item.id} className="p-3 border dark:border-gray-700 rounded-md space-y-3 bg-gray-50 dark:bg-gray-900/40 shadow-sm">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-grow mr-2 truncate" title={item.display_descripcion}>{item.display_descripcion || `Producto ID: ${item.selected_producto_id || 'Nuevo'}`}</p>
                    <div className="flex items-center">
                        <label htmlFor={`seleccionado-${item.id}`} className="mr-2 text-xs text-gray-600 dark:text-gray-400">Incluir</label>
                        <input type="checkbox" id={`seleccionado-${item.id}`} checked={item.seleccionado} onChange={(e) => handleProductLineChange(item.id, 'seleccionado', e.target.checked)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700"/>
                    </div>
                </div>
                {/* UI para editar o seleccionar producto, similar a DirectOrderForm */}
                 <div className="flex items-center justify-end mb-1">
                     <button type="button" onClick={() => handleProductLineChange(item.id, 'isNewProductMode', !item.isNewProductMode)}
                        className={`px-2 py-1 text-xs rounded-md ${item.isNewProductMode ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                        {item.isNewProductMode ? 'Usar Existente' : 'Crear Nuevo Producto'}
                     </button>
                  </div>
                  {item.isNewProductMode ? (
                    <div className="space-y-2 border-t dark:border-gray-600 pt-2">
                      <div><label htmlFor={`newDesc-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Desc. Nuevo Prod. <span className="text-red-500">*</span></label><input type="text" id={`newDesc-${item.id}`} value={item.newProduct_descripcion} onChange={(e) => handleProductLineChange(item.id, 'newProduct_descripcion', e.target.value)} required className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" placeholder="Nombre nuevo producto"/></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div><label htmlFor={`newCat-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Categoría <span className="text-red-500">*</span></label><div className="flex items-center space-x-1"><select id={`newCat-${item.id}`} value={item.newProduct_categoria_id || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_categoria_id', e.target.value ? Number(e.target.value) : null)} required className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm"><option value="">-- Seleccionar --</option>{productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}</select><button type="button" onClick={() => handleOpenNewCategoryModal(item.id)} title="Añadir Categoría" className="p-1.5 mt-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700/50"><TagIcon className="w-4 h-4"/></button></div></div>
                        <div><label htmlFor={`newCod-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cód. Int. (Opc.)</label><input type="text" id={`newCod-${item.id}`} value={item.newProduct_codigo_interno || ''} onChange={(e) => handleProductLineChange(item.id, 'newProduct_codigo_interno', e.target.value)} className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" /></div>
                      </div>
                    </div>
                  ) : (
                    item.original_producto_id === null && // Solo mostrar selector si es una línea agregada (no de la solicitud original)
                    <div><label htmlFor={`selProd-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Producto Existente <span className="text-red-500">*</span></label><select id={`selProd-${item.id}`} value={item.selected_producto_id || ''} onChange={(e) => handleProductLineChange(item.id, 'selected_producto_id', e.target.value ? Number(e.target.value) : null)} required={!item.isNewProductMode} className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm"><option value="">-- Seleccionar --</option>{fetchedDbProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}</select></div>
                  )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label htmlFor={`quantity-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cantidad <span className="text-red-500">*</span></label><input type="number" id={`quantity-${item.id}`} value={item.quantity} min="1" onChange={(e) => handleProductLineChange(item.id, 'quantity', e.target.value)} required className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" /></div>
                    <div><label htmlFor={`precio-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Precio Unit. ({formData.unidad}) <span className="text-red-500">*</span></label><input type="number" id={`precio-${item.id}`} value={item.precio_unitario} step="0.01" min="0" onChange={(e) => handleProductLineChange(item.id, 'precio_unitario', e.target.value)} required className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" /></div>
                </div>
                {!item.seleccionado && (<div><label htmlFor={`motivo-${item.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Motivo no inclusión</label><input type="text" id={`motivo-${item.id}`} value={item.motivoRechazo || ''} onChange={(e) => handleProductLineChange(item.id, 'motivoRechazo', e.target.value)} placeholder="Ej: Stock agotado" className="mt-0.5 w-full px-2 py-1.5 border input-field text-sm" /></div>)}
                 <p className="text-right text-sm font-medium text-gray-700 dark:text-gray-300">Total Prod: {(item.quantity * item.precio_unitario).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.unidad}</p>
              </div>
            ))}
             <button type="button" onClick={handleAddCustomLineItem} disabled={submittingOrder} className="mt-2 flex items-center px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none disabled:opacity-50"><PlusCircleIcon className="w-5 h-5 mr-2" />Añadir Producto Personalizado</button>
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg space-y-2 border dark:border-gray-600"><h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-2">Resumen de Pago</h4><div className="flex justify-between text-sm text-gray-700 dark:text-gray-300"><span>Subtotal:</span><span>{formData.sub_total?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div><div className="flex justify-between text-sm text-gray-700 dark:text-gray-300"><span>IVA (16%):</span><span>{formData.iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div><div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300"><label htmlFor="retencion_porcentaje" className="whitespace-nowrap mr-2">Retención IVA (%):</label><input type="number" id="retencion_porcentaje" name="retencion_porcentaje" value={formData.retencion_porcentaje === null ? '' : formData.retencion_porcentaje} min="0" max="100" onChange={handleFormInputChange} className="w-20 px-2 py-1 border input-field text-sm" /><span className="ml-auto">{formData.ret_iva?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div><div className="flex justify-between text-md font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600"><span>Neto a Pagar:</span><span>{formData.neto_a_pagar?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} {formData.unidad}</span></div></div>
          <div><label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label><textarea id="observaciones" name="observaciones" value={formData.observaciones || ''} onChange={handleFormInputChange} rows={3} className="w-full px-3 py-2 border input-field" placeholder="Condiciones de pago, etc."/></div>
          <div className="pt-5 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 py-3 z-10 border-t dark:border-gray-700"><button type="button" onClick={onHide} disabled={submittingOrder} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">Cancelar</button><button type="submit" disabled={submittingOrder || loadingInitialData} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">{submittingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckIcon className="w-5 h-5 mr-1.5 -ml-1" />}{submittingOrder ? "Creando..." : "Crear Orden"}</button></div>
        </form>
        )}
      </div>
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <form onSubmit={handleSaveNewCategory} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Añadir Nueva Categoría de Producto</h4>
                {categoryError && <p className="text-xs text-red-500 mb-2">{categoryError}</p>}
                <div><label htmlFor="newCategoryNameInputModal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Categoría <span className="text-red-500">*</span></label><input type="text" id="newCategoryNameInputModal" value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} required className="mt-1 w-full px-3 py-2 border input-field" /></div>
                <div className="mt-4 flex justify-end space-x-2"><button type="button" onClick={() => setShowNewCategoryModal(false)} disabled={submittingCategory} className="px-3 py-1.5 text-sm btn-secondary">Cancelar</button><button type="submit" disabled={submittingCategory} className="px-3 py-1.5 text-sm btn-primary flex items-center">{submittingCategory && <ArrowPathIcon className="w-4 h-4 animate-spin mr-1.5"/>}Guardar Categoría</button></div>
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

export default OrderForm;