
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Your main Supabase client
import { fetchExternalEvents } from '../supabaseClient'; // Function to fetch from partner's DB
import { PartnerEvent, Producto, UserProfile, Departamento, ConsumoParaEventoExterno } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { CalendarDaysIcon, PlusCircleIcon, InformationCircleIcon, ArrowPathIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
// @ts-ignore
import { useOutletContext } from 'react-router-dom';

interface ExternalEventsPageContext {
  userProfile: UserProfile;
}

interface EventConsumptionFormState {
  evento_id_externo: string;
  nombre_evento_externo: string;
  fecha_evento: string;
  producto_id: number | null;
  cantidad_consumida: number;
  departamento_solicitante_id: number | null;
  notas?: string;
}

const ExternalEventsPage: React.FC = () => {
  const { userProfile } = useOutletContext<ExternalEventsPageContext>();
  const [externalEvents, setExternalEvents] = useState<PartnerEvent[]>([]);
  const [productos, setProductos] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]);
  const [departamentos, setDepartamentos] = useState<Pick<Departamento, 'id' | 'nombre'>[]>([]);
  
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(true);
  
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedEventForLog, setSelectedEventForLog] = useState<PartnerEvent | null>(null);
  const [logFormData, setLogFormData] = useState<Partial<EventConsumptionFormState>>({});
  const [submittingLog, setSubmittingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      const events = await fetchExternalEvents(20); // Fetch latest 20 events
      setExternalEvents(events);
      setLoadingEvents(false);
    };
    const loadProductos = async () => {
      setLoadingProductos(true);
      const { data, error: err } = await supabase.from('producto').select('id, descripcion').order('descripcion');
      if (err) console.error("Error cargando productos propios:", err);
      else setProductos(data || []);
      setLoadingProductos(false);
    };
    const loadDepartamentos = async () => {
      setLoadingDepartamentos(true);
      const { data, error: err } = await supabase.from('departamento').select('id, nombre').order('nombre');
      if (err) console.error("Error cargando departamentos propios:", err);
      else setDepartamentos(data || []);
      setLoadingDepartamentos(false);
    };

    loadEvents();
    loadProductos();
    loadDepartamentos();
  }, []);

  const handleOpenLogForm = (event: PartnerEvent) => {
    setSelectedEventForLog(event);
    setLogFormData({
      evento_id_externo: event.id,
      nombre_evento_externo: event.subject,
      fecha_evento: event.date,
      cantidad_consumida: 1,
      departamento_solicitante_id: userProfile?.departamento_id || null,
    });
    setShowLogForm(true);
    setError(null);
  };

  const handleLogFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLogFormData(prev => ({ ...prev, [name]: name === 'producto_id' || name === 'cantidad_consumida' || name === 'departamento_solicitante_id' ? (value ? Number(value) : null) : value }));
  };

  const handleLogSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEventForLog || !logFormData.producto_id || !logFormData.cantidad_consumida || logFormData.cantidad_consumida <= 0) {
      setError("Por favor, complete todos los campos obligatorios (producto y cantidad).");
      return;
    }
    setSubmittingLog(true);
    setError(null);

    const payload: Omit<ConsumoParaEventoExterno, 'id' | 'created_at' | 'updated_at' | 'producto' | 'departamento'> = {
      evento_id_externo: selectedEventForLog.id,
      nombre_evento_externo: selectedEventForLog.subject,
      fecha_evento: selectedEventForLog.date,
      producto_id: Number(logFormData.producto_id),
      cantidad_consumida: Number(logFormData.cantidad_consumida),
      departamento_solicitante_id: logFormData.departamento_solicitante_id || userProfile?.departamento_id || null,
      notas: logFormData.notas || null,
      organizer_type_externo: selectedEventForLog.organizer_type,
      organizer_id_externo: selectedEventForLog.organizer_id,
      location_externo: selectedEventForLog.location,
      // costo_estimado_consumo: Se podría calcular si tenemos precio de producto
    };

    try {
      const { error: insertError } = await supabase.from('consumo_para_evento_externo').insert(payload);
      if (insertError) throw insertError;
      
      alert("Consumo para evento externo registrado exitosamente.");
      setShowLogForm(false);
      setSelectedEventForLog(null);
      setLogFormData({});
    } catch (err) {
      const e = err as Error;
      setError(`Error al registrar consumo: ${e.message}`);
      console.error(err);
    } finally {
      setSubmittingLog(false);
    }
  };


  if (loadingEvents || loadingProductos || loadingDepartamentos) {
    return <LoadingSpinner message="Cargando datos de eventos y productos..." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Eventos Externos y Consumo Asociado</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Visualiza eventos de la base de datos del calendario de eventos y registra el consumo de productos de tu inventario para estos eventos.
      </p>

      {externalEvents.length === 0 && !loadingEvents && (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <InformationCircleIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay eventos externos</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No se pudieron cargar eventos de la base de datos del calendario o no hay eventos recientes.</p>
        </div>
      )}

      {externalEvents.length > 0 && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {externalEvents.map(event => (
            <div key={event.id} className="p-4 border dark:border-gray-700 rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700/30 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-primary-600 dark:text-primary-400">{event.subject}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID Evento: {event.id} | Fecha: {new Date(event.date).toLocaleDateString()} | Hora: {event.start_time}
                  </p>
                  {event.location && <p className="text-xs text-gray-500 dark:text-gray-400">Lugar: {event.location}</p>}
                </div>
                <button
                  onClick={() => handleOpenLogForm(event)}
                  className="mt-3 sm:mt-0 flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm shadow-sm whitespace-nowrap"
                >
                  <PlusCircleIcon className="w-4 h-4 mr-1.5" /> Registrar Consumo
                </button>
              </div>
              {event.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">{event.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal para Registrar Consumo */}
      {showLogForm && selectedEventForLog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-70 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Consumo para: {selectedEventForLog.subject}</h3>
              <button onClick={() => setShowLogForm(false)} disabled={submittingLog} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-4 space-y-4 overflow-y-auto">
              {error && <div className="p-2 text-sm text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-600 rounded-md">{error}</div>}
              
              <div>
                <label htmlFor="producto_id_log" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Producto de tu inventario <span className="text-red-500">*</span></label>
                <select name="producto_id" id="producto_id_log" value={logFormData.producto_id || ''} onChange={handleLogFormChange} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- Seleccionar Producto --</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cantidad_consumida_log" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cantidad Consumida <span className="text-red-500">*</span></label>
                <input type="number" name="cantidad_consumida" id="cantidad_consumida_log" value={logFormData.cantidad_consumida || 1} min="1" onChange={handleLogFormChange} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="departamento_solicitante_id_log" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento Solicitante (Opcional)</label>
                <select name="departamento_solicitante_id" id="departamento_solicitante_id_log" value={logFormData.departamento_solicitante_id || ''} onChange={handleLogFormChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- Seleccionar Departamento --</option>
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="notas_log" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas Adicionales (Opcional)</label>
                <textarea name="notas" id="notas_log" value={logFormData.notas || ''} onChange={handleLogFormChange} rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ej: Entregado a Juan Pérez para stand de la feria..." />
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t dark:border-gray-700">
                <button type="button" onClick={() => setShowLogForm(false)} disabled={submittingLog}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingLog}
                  className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
                  {submittingLog ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-1.5 -ml-1" />}
                  {submittingLog ? "Guardando..." : "Guardar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalEventsPage;
