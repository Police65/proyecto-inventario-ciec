import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, fetchExternalEvents, fetchExternalMeetings } from '../../supabaseClient';
import { Producto, Departamento, PartnerEvent, PartnerMeeting } from '../../types';
import { CheckCircleIcon, ExclamationTriangleIcon, CubeIcon, UserGroupIcon, BuildingOfficeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface ProductWithStock extends Pick<Producto, 'id' | 'descripcion' | 'codigo_interno' | 'unidad_medida'> {
  stock_actual: number;
  inventario_id: number;
}

interface ExternalActivity {
    id: string;
    subject: string;
    date: string;
    type: 'evento' | 'reunion';
    location?: string | null;
}

const ConsumptionRegistry: React.FC = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [departments, setDepartments] = useState<Pick<Departamento, 'id' | 'nombre'>[]>([]);
  const [externalActivities, setExternalActivities] = useState<ExternalActivity[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [consumptionType, setConsumptionType] = useState<'internal' | 'external'>('internal');
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [consumptionDate, setConsumptionDate] = useState(new Date().toISOString().split('T')[0]);

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data: invData, error: invError } = await supabase
        .from('inventario')
        .select('id, existencias, producto:producto_id(id, descripcion, codigo_interno, unidad_medida)')
        .gt('existencias', 0);

      if (invError) throw invError;

      setProducts((invData || []).map((item: any) => ({
        id: item.producto.id,
        descripcion: item.producto.descripcion,
        codigo_interno: item.producto.codigo_interno,
        unidad_medida: item.producto.unidad_medida,
        stock_actual: item.existencias,
        inventario_id: item.id
      })));

      const { data: deptData } = await supabase.from('departamento').select('id, nombre').eq('estado', 'activo');
      setDepartments(deptData || []);

      const [events, meetings] = await Promise.all([
          fetchExternalEvents(50),
          fetchExternalMeetings(50)
      ]);

      const activities: ExternalActivity[] = [
          ...events.map(e => ({ id: e.id, subject: e.subject || 'Evento Especial', date: e.date, type: 'evento' as const, location: e.location })),
          ...meetings.map(m => ({ id: m.id, subject: m.subject || 'Reunión de Comisión', date: m.date, type: 'reunion' as const, location: m.location }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setExternalActivities(activities);

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
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    if (quantity > selectedProduct.stock_actual) {
      setFeedback({ type: 'error', message: `Stock insuficiente (${selectedProduct.stock_actual} disponibles).` });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      // FIX: Cast from() to any to resolve 'never' type error during update.
      const { error: updateInvError } = await (supabase
        .from('inventario') as any)
        .update({ existencias: selectedProduct.stock_actual - quantity, fecha_actualizacion: new Date().toISOString() })
        .eq('id', selectedProduct.inventario_id);

      if (updateInvError) throw updateInvError;

      const historicoPayload = {
        producto_id: selectedProduct.id,
        cantidad_consumida: quantity,
        fecha_consumo: consumptionDate,
        tipo_consumo: consumptionType === 'external' ? 'evento_externo' : 'uso_interno',
        departamento_id: consumptionType === 'internal' ? (selectedDeptId as number) : null,
        evento_id_externo: consumptionType === 'external' ? selectedEventId : null,
        descripcion_adicional: description
      };

      // FIX: Cast from() to any to resolve 'never' type error during insert.
      const { error: histError } = await (supabase.from('consumo_historico_producto') as any).insert(historicoPayload);
      if (histError) throw histError;

      if (consumptionType === 'external') {
        const act = externalActivities.find(a => a.id === selectedEventId);
        if (act) {
            // FIX: Cast from() to any to resolve 'never' type error during insert.
            await (supabase.from('consumo_para_evento_externo') as any).insert({
                evento_id_externo: act.id,
                nombre_evento_externo: act.subject,
                fecha_evento: act.date,
                producto_id: selectedProduct.id,
                cantidad_consumida: quantity,
                location_externo: act.location,
                notas: description
            });
        }
      }

      setFeedback({ type: 'success', message: 'Consumo registrado exitosamente.' });
      setQuantity(1); setDescription(''); setSelectedProductId(''); setSearchTerm('');
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Error al procesar el registro.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData && products.length === 0) return <LoadingSpinner message="Cargando datos..." />;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
        <CubeIcon className="w-7 h-7 mr-2 text-primary-500" />
        Registrar Consumo
      </h2>

      {feedback && (
        <div className={`p-4 mb-6 rounded-md ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30' : 'bg-red-100 text-red-800 dark:bg-red-900/30'}`}>
          <div className="flex items-center">
            {feedback.type === 'success' ? <CheckCircleIcon className="w-5 h-5 mr-2" /> : <ExclamationTriangleIcon className="w-5 h-5 mr-2" />}
            <p>{feedback.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producto en Inventario</label>
          <input
            type="text"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:text-sm"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); setSelectedProductId(''); }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {products.filter(p => p.descripcion.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                <div key={p.id} className="px-4 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-gray-600 text-sm flex justify-between" onClick={() => handleProductSelect(p)}>
                  <span>{p.descripcion}</span>
                  <span className="text-gray-400">Stock: {p.stock_actual}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cantidad</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 sm:text-sm" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</label>
                <input type="date" value={consumptionDate} onChange={(e) => setConsumptionDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 sm:text-sm" required />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destino</label>
            <div className="flex space-x-4">
                <button type="button" onClick={() => setConsumptionType('internal')} className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${consumptionType === 'internal' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}><BuildingOfficeIcon className="w-5 h-5 inline mr-2" />Interno</button>
                <button type="button" onClick={() => setConsumptionType('external')} className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${consumptionType === 'external' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}><UserGroupIcon className="w-5 h-5 inline mr-2" />Actividad Externa</button>
            </div>
        </div>

        {consumptionType === 'internal' ? (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
                <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(Number(e.target.value))} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 sm:text-sm" required={consumptionType === 'internal'}>
                    <option value="">Seleccionar...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
            </div>
        ) : (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Actividad del Compañero (Evento/Reunión)</label>
                <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 sm:text-sm" required={consumptionType === 'external'}>
                    <option value="">Seleccionar...</option>
                    {externalActivities.map(act => (
                        <option key={act.id} value={act.id}>
                            {new Date(act.date).toLocaleDateString()} - {act.subject} ({act.type === 'evento' ? 'Evento' : 'Reunión'})
                        </option>
                    ))}
                </select>
            </div>
        )}

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas Adicionales</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 sm:text-sm" rows={3} />
        </div>

        <div className="flex justify-end pt-4">
            <button type="submit" disabled={submitting || !selectedProduct} className="flex items-center px-6 py-2 bg-primary-600 text-white font-bold rounded-md hover:bg-primary-700 disabled:opacity-50">
                {submitting ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
                Registrar Consumo
            </button>
        </div>
      </form>
    </div>
  );
};

export default ConsumptionRegistry;