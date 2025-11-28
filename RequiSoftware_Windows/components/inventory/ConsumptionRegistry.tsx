
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, fetchExternalEvents } from '../../supabaseClient';
import { Producto, Inventario, Departamento, PartnerEvent } from '../../types';
import { CheckCircleIcon, ExclamationTriangleIcon, CubeIcon, UserGroupIcon, BuildingOfficeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface ProductWithStock extends Pick<Producto, 'id' | 'descripcion' | 'codigo_interno' | 'unidad_medida'> {
  stock_actual: number;
  inventario_id: number;
}

const ConsumptionRegistry: React.FC = () => {
  // Data States
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [departments, setDepartments] = useState<Pick<Departamento, 'id' | 'nombre'>[]>([]);
  const [externalEvents, setExternalEvents] = useState<PartnerEvent[]>([]);
  
  // Form States
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [consumptionType, setConsumptionType] = useState<'internal' | 'external'>('internal');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [consumptionDate, setConsumptionDate] = useState(new Date().toISOString().split('T')[0]);

  // UI States
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      // 1. Obtener Productos con Inventario
      const { data: invData, error: invError } = await supabase
        .from('inventario')
        .select('id, existencias, producto:producto_id(id, descripcion, codigo_interno, unidad_medida)')
        .gt('existencias', 0); // Solo productos con stock

      if (invError) throw invError;

      const formattedProducts: ProductWithStock[] = (invData || []).map((item: any) => ({
        id: item.producto.id,
        descripcion: item.producto.descripcion,
        codigo_interno: item.producto.codigo_interno,
        unidad_medida: item.producto.unidad_medida,
        stock_actual: item.existencias,
        inventario_id: item.id
      }));
      setProducts(formattedProducts);

      // 2. Obtener Departamentos
      const { data: deptData, error: deptError } = await supabase
        .from('departamento')
        .select('id, nombre')
        .eq('estado', 'activo')
        .order('nombre');
      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // 3. Obtener Eventos Externos
      const events = await fetchExternalEvents(50); // Obtener los últimos 50 eventos
      setExternalEvents(events);

    } catch (error) {
      console.error("Error loading consumption data:", error);
      setFeedback({ type: 'error', message: 'Error al cargar datos iniciales.' });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (prod: ProductWithStock) => {
    setSelectedProductId(prod.id);
    setSearchTerm(prod.descripcion);
    setIsDropdownOpen(false);
    setQuantity(1); // Reset quantity
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    if (quantity > selectedProduct.stock_actual) {
      setFeedback({ type: 'error', message: `La cantidad supera el stock actual (${selectedProduct.stock_actual}).` });
      return;
    }
    if (consumptionType === 'internal' && !selectedDeptId) {
        setFeedback({ type: 'error', message: 'Debe seleccionar un departamento.' });
        return;
    }
    if (consumptionType === 'external' && !selectedEventId) {
        setFeedback({ type: 'error', message: 'Debe seleccionar un evento externo.' });
        return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      // 1. Actualizar Inventario (Decrementar)
      const newStock = selectedProduct.stock_actual - quantity;
      const { error: updateInvError } = await supabase
        .from('inventario')
        .update({ existencias: newStock, fecha_actualizacion: new Date().toISOString() })
        .eq('id', selectedProduct.inventario_id);

      if (updateInvError) throw updateInvError;

      // 2. Insertar en consumo_historico_producto
      const historicoPayload = {
        producto_id: selectedProduct.id,
        cantidad_consumida: quantity,
        fecha_consumo: consumptionDate,
        tipo_consumo: consumptionType === 'external' ? 'evento_externo' : 'uso_interno',
        departamento_id: consumptionType === 'internal' ? (selectedDeptId as number) : null,
        evento_id_externo: consumptionType === 'external' ? selectedEventId : null,
        descripcion_adicional: description
      };

      const { error: histError } = await supabase.from('consumo_historico_producto').insert(historicoPayload);
      if (histError) throw histError;

      // 3. Si es Evento Externo, Insertar en consumo_para_evento_externo
      if (consumptionType === 'external') {
        const eventDetails = externalEvents.find(ev => ev.id === selectedEventId);
        if (eventDetails) {
            const eventPayload = {
                evento_id_externo: eventDetails.id,
                nombre_evento_externo: eventDetails.subject,
                fecha_evento: eventDetails.date,
                producto_id: selectedProduct.id,
                cantidad_consumida: quantity,
                organizer_type_externo: eventDetails.organizer_type,
                organizer_id_externo: eventDetails.organizer_id,
                location_externo: eventDetails.location,
                notas: description
            };
            const { error: extEventError } = await supabase.from('consumo_para_evento_externo').insert(eventPayload);
            if (extEventError) console.warn("Error insertando detalle de evento externo:", extEventError);
        }
      }

      setFeedback({ type: 'success', message: 'Consumo registrado exitosamente. El inventario ha sido actualizado.' });
      
      // Reiniciar formulario parcialmente
      setQuantity(1);
      setDescription('');
      
      // Refrescar datos para obtener nuevo stock
      fetchInitialData();

    } catch (err) {
      console.error("Error processing consumption:", err);
      setFeedback({ type: 'error', message: 'Error al procesar el consumo. Intente nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  if (loadingData && products.length === 0) return <LoadingSpinner message="Cargando datos de inventario..." />;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
        <CubeIcon className="w-7 h-7 mr-2 text-primary-500" />
        Registrar Salida / Consumo de Productos
      </h2>

      {feedback && (
        <div className={`p-4 mb-6 rounded-md ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
          <div className="flex items-center">
            {feedback.type === 'success' ? <CheckCircleIcon className="w-5 h-5 mr-2" /> : <ExclamationTriangleIcon className="w-5 h-5 mr-2" />}
            <p>{feedback.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Product Selection */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar Producto (Inventario)</label>
          <input
            type="text"
            className={inputClasses}
            placeholder="Escriba para buscar..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); setSelectedProductId(''); }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {products.filter(p => p.descripcion.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                products.filter(p => p.descripcion.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                  <div
                    key={p.id}
                    className="px-4 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white flex justify-between"
                    onClick={() => handleProductSelect(p)}
                  >
                    <span>{p.descripcion}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Stock: {p.stock_actual} {p.unidad_medida}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">No hay productos con stock que coincidan.</div>
              )}
            </div>
          )}
        </div>

        {selectedProduct && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md flex justify-between items-center">
                <div>
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{selectedProduct.descripcion}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Código: {selectedProduct.codigo_interno || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedProduct.stock_actual}</p>
                    <p className="text-xs text-blue-500 dark:text-blue-300">Disponibles</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quantity & Date */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cantidad a Retirar</label>
                <input 
                    type="number" 
                    min="1" 
                    max={selectedProduct?.stock_actual || 9999}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className={inputClasses}
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Consumo</label>
                <input 
                    type="date" 
                    value={consumptionDate}
                    onChange={(e) => setConsumptionDate(e.target.value)}
                    className={inputClasses}
                    required
                />
            </div>
        </div>

        {/* Consumption Type Selector */}
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Consumo / Destino</label>
            <div className="flex space-x-4">
                <button
                    type="button"
                    onClick={() => setConsumptionType('internal')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center transition-all ${
                        consumptionType === 'internal' 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                >
                    <BuildingOfficeIcon className="w-5 h-5 mr-2" />
                    Uso Interno (Dpto.)
                </button>
                <button
                    type="button"
                    onClick={() => setConsumptionType('external')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center transition-all ${
                        consumptionType === 'external' 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                >
                    <UserGroupIcon className="w-5 h-5 mr-2" />
                    Evento Externo
                </button>
            </div>
        </div>

        {/* Conditional Inputs based on Type */}
        {consumptionType === 'internal' ? (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento Solicitante <span className="text-red-500">*</span></label>
                <select 
                    value={selectedDeptId} 
                    onChange={(e) => setSelectedDeptId(Number(e.target.value))} 
                    className={inputClasses}
                    required={consumptionType === 'internal'}
                >
                    <option value="">-- Seleccionar Departamento --</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.nombre}</option>
                    ))}
                </select>
            </div>
        ) : (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar Evento Externo <span className="text-red-500">*</span></label>
                <select 
                    value={selectedEventId} 
                    onChange={(e) => setSelectedEventId(e.target.value)} 
                    className={inputClasses}
                    required={consumptionType === 'external'}
                >
                    <option value="">-- Seleccionar Evento --</option>
                    {externalEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>
                            {new Date(ev.date).toLocaleDateString()} - {ev.subject} ({ev.organizer_type})
                        </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Se muestran los últimos 50 eventos. Si no ve su evento, verifique la base de datos de eventos.</p>
            </div>
        )}

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas / Descripción Adicional</label>
            <textarea 
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClasses}
                placeholder="Detalles adicionales sobre el consumo..."
            />
        </div>

        <div className="flex justify-end pt-4">
            <button
                type="submit"
                disabled={submitting || !selectedProduct}
                className="flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
                {submitting ? 'Procesando...' : 'Registrar Consumo'}
            </button>
        </div>

      </form>
    </div>
  );
};

export default ConsumptionRegistry;
