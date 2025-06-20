import React, { useState, useEffect } from 'react';
import { fetchExternalEvents, fetchExternalMeetings } from '../supabaseClient';
import { PartnerEvent, PartnerMeeting } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { CalendarDaysIcon } from '@heroicons/react/24/outline'; // Assuming PlusCircleIcon was intended

const ExternalEventsPage: React.FC = () => {
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [meetings, setMeetings] = useState<PartnerMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [eventsData, meetingsData] = await Promise.all([
          fetchExternalEvents(20),
          fetchExternalMeetings(20)
        ]);
        setEvents(eventsData);
        setMeetings(meetingsData);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Error cargando datos de eventos externos.";
        setError(errorMessage);
        console.error("Error in ExternalEventsPage loadData:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner message="Cargando eventos y reuniones externas..." />;
  if (error) return <div className="p-4 text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md shadow">{error}</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Eventos y Reuniones Externas</h1>
      
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 border-b pb-2 dark:border-gray-700">Eventos Programados</h2>
        {events.length > 0 ? (
          <ul className="space-y-4">
            {events.map(event => (
              <li key={event.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg text-primary-700 dark:text-primary-400">{event.subject}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <CalendarDaysIcon className="w-5 h-5 inline mr-1.5 align-text-bottom text-gray-500 dark:text-gray-400" />
                  {new Date(event.date).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {event.start_time && ` a las ${event.start_time.substring(0, 5)}`}
                </p>
                {event.location && <p className="text-sm text-gray-600 dark:text-gray-400">Lugar: {event.location}</p>}
                {event.organizer_name && <p className="text-xs text-gray-500 dark:text-gray-400">Organizador: {event.organizer_name} ({event.organizer_type})</p>}
                {event.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 prose prose-sm dark:prose-invert max-w-none">{event.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No hay eventos externos para mostrar.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 border-b pb-2 dark:border-gray-700">Reuniones Programadas</h2>
        {meetings.length > 0 ? (
          <ul className="space-y-4">
            {meetings.map(meeting => (
              <li key={meeting.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg text-indigo-700 dark:text-indigo-400">{meeting.subject}</h3>
                 <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <CalendarDaysIcon className="w-5 h-5 inline mr-1.5 align-text-bottom text-gray-500 dark:text-gray-400" />
                  {new Date(meeting.date).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {meeting.start_time && ` a las ${meeting.start_time.substring(0, 5)}`}
                </p>
                {meeting.location && <p className="text-sm text-gray-600 dark:text-gray-400">Lugar: {meeting.location}</p>}
                {/* Aquí podrías añadir más detalles de la reunión si es necesario */}
                {meeting.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 prose prose-sm dark:prose-invert max-w-none">{meeting.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No hay reuniones externas para mostrar.</p>
        )}
      </section>
      {/* Placeholder para funcionalidades futuras relacionadas con el consumo */}
      {/* <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center">
        <PlusCircleIcon className="w-5 h-5 mr-2" /> Registrar Consumo para Evento
      </button> */}
    </div>
  );
};

export default ExternalEventsPage;