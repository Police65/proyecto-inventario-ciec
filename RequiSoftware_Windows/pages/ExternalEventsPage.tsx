
import React, { useState, useEffect, useCallback } from 'react';
import { fetchExternalEvents, fetchExternalMeetings } from '../supabaseClient';
import { PartnerEvent, PartnerMeeting } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { CalendarDaysIcon, UserGroupIcon, MapPinIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ExternalEventsPage: React.FC = () => {
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [meetings, setMeetings] = useState<PartnerMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsData, meetingsData] = await Promise.all([
        fetchExternalEvents(50),
        fetchExternalMeetings(50)
      ]);
      setEvents(eventsData);
      setMeetings(meetingsData);
    } catch (e: any) {
      setError(e.message || "Error al conectar con el servidor del compañero. Verifica que las tablas 'events' y 'meetings' existan y tengan RLS desactivado.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner message="Sincronizando con base de datos externa..." />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-8 bg-white dark:bg-gray-800 shadow-xl rounded-lg fade-in-content">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b dark:border-gray-700 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendario CIEC (Externo)</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400 italic text-sm">Información compartida del sistema de eventos.</p>
          </div>
          <button 
            onClick={loadData}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-all active:scale-95 shadow-md"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Recargar Datos
          </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mr-3 shrink-0" />
            <div>
                <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Error de Sincronización</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-2 font-mono">Tip: Revisa que el compañero tenga las tablas configuradas exactamente como 'events' y 'meetings'.</p>
            </div>
        </div>
      )}
      
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <CalendarDaysIcon className="w-7 h-7 mr-2 text-primary-500" />
            Eventos Especiales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.length > 0 ? events.map(event => (
              <div key={event.id} className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-lg transition-all border-l-4 border-l-primary-500">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1" title={event.subject}>{event.subject || 'Sin Título'}</h3>
                <div className="flex flex-wrap gap-y-2 mt-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center mr-4">
                        <CalendarDaysIcon className="w-4 h-4 inline mr-1.5 text-primary-500" />
                        {new Date(event.date).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    {event.location && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                            <MapPinIcon className="w-4 h-4 mr-1.5 text-red-500" /> {event.location}
                        </p>
                    )}
                </div>
                {event.description && (
                    <div className="mt-4 pt-4 border-t dark:border-gray-600">
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 italic">"{event.description}"</p>
                    </div>
                )}
              </div>
            )) : !error && <div className="col-span-full py-10 text-center border-2 border-dashed dark:border-gray-700 rounded-xl text-gray-400">No hay eventos recientes o futuros cargados en la base de datos externa.</div>}
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <UserGroupIcon className="w-7 h-7 mr-2 text-indigo-500" />
            Reuniones de Comisiones
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.length > 0 ? meetings.map(meeting => (
              <div key={meeting.id} className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30 shadow-sm hover:shadow-lg transition-all border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-indigo-700 dark:text-indigo-300 line-clamp-1">{meeting.subject || 'Sesión de Comisión'}</h3>
                </div>
                <div className="space-y-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                    <CalendarDaysIcon className="w-4 h-4 inline mr-2 text-indigo-400" />
                    {new Date(meeting.date).toLocaleDateString()} {meeting.start_time ? meeting.start_time.substring(0, 5) : ''}
                    </p>
                    {meeting.location && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center truncate">
                        <MapPinIcon className="w-4 h-4 mr-2 text-gray-400" /> {meeting.location}
                        </p>
                    )}
                </div>
              </div>
            )) : !error && <div className="col-span-full py-10 text-center border-2 border-dashed dark:border-gray-700 rounded-xl text-gray-400">No hay reuniones programadas en el sistema externo.</div>}
        </div>
      </section>
    </div>
  );
};

export default ExternalEventsPage;
