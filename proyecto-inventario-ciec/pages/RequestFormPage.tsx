import React, { useState } from 'react';
// @ts-ignore
import { useNavigate, useOutletContext } from 'react-router-dom';
import { RequestForm } from '../components/requests/RequestForm'; // Se cambió a importación nombrada
import { UserProfile, NotificacionInsert, Database } from '../types';
import { generateDescription as aiGenerateDescription } from '../services/aiService';
import { createNotifications, fetchAdminUserIds } from '../services/notificationService'; // Importar servicio de notificaciones
import { ArrowPathIcon } from '@heroicons/react/24/outline'; 
import { supabase } from '../supabaseClient'; // Mantener para operaciones directas de BD si es necesario

interface RequestFormPageContext {
  userProfile: UserProfile;
}

const RequestFormPage: React.FC = () => {
  const { userProfile } = useOutletContext<RequestFormPageContext>();
  const navigate = useNavigate();
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const handleSubmitRequest = async (requestData: { products: { id: string; productId: string; quantity: number }[] | null; description: string | null, customRequest: boolean }) => {
    setSubmittingRequest(true);
    if (!userProfile?.empleado_id || !userProfile.departamento_id) {
      alert("Error: Perfil de usuario incompleto. Contacte al administrador.");
      setSubmittingRequest(false);
      return;
    }

    // Validaciones
    if (requestData.customRequest && (!requestData.description || requestData.description.trim() === '')) {
        alert('Para una requisición especial, la descripción es obligatoria.');
        setSubmittingRequest(false);
        return;
    }
    if (!requestData.customRequest && (!requestData.products || requestData.products.length === 0 || requestData.products.some(p => !p.productId || p.quantity < 1))) {
        alert('Debe seleccionar al menos un producto con cantidad válida (mayor a 0) para una solicitud estándar.');
        setSubmittingRequest(false);
        return;
    }

    try {
      let finalDescriptionForSolicitud = "Solicitud de Compra"; // Default para SolicitudCompra.descripcion

      if (requestData.customRequest && requestData.description) {
        finalDescriptionForSolicitud = requestData.description; // Para personalizadas, usar la descripción provista como principal.
      } else if (!requestData.customRequest && requestData.products && requestData.products.length > 0) {
        // Intentar generar descripción con IA para solicitudes estándar
        const productsForAI = requestData.products.map(p => ({
          productId: parseInt(p.productId, 10), 
          quantity: p.quantity
        })).filter(p => !isNaN(p.productId)); // Filtrar productos con ID inválido

        if (productsForAI.length > 0) {
            finalDescriptionForSolicitud = await aiGenerateDescription(productsForAI);
        } else if (requestData.products.length > 0) {
            // Si todos los IDs fallaron, usar un placeholder
            console.warn("Todos los IDs de producto fallaron al analizarse para la descripción de IA. Usando descripción predeterminada.");
            finalDescriptionForSolicitud = "Solicitud de artículos (IDs no procesados)";
        }
      }
      
      // Crear la cabecera de la solicitud
      const { data: solicitudData, error: solicitudError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: finalDescriptionForSolicitud,
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id,
        })
        .select('id')
        .single();

      if (solicitudError) throw solicitudError;
      if (!solicitudData) throw new Error("No se pudo crear la cabecera de la solicitud.");

      const solicitudId = solicitudData.id;

      // Insertar detalles de la solicitud
      if (requestData.customRequest && requestData.description) {
        // Insertar una sola línea de detalle para solicitud personalizada
        const { error: detalleError } = await supabase.from('solicitudcompra_detalle').insert({
          solicitud_compra_id: solicitudId,
          producto_id: null, // Sin producto_id específico para personalizadas
          cantidad: 1, // Asumir cantidad 1 para item personalizado, o añadir campo en formulario
          descripcion_producto_personalizado: requestData.description,
        });
        if (detalleError) throw detalleError;

      } else if (!requestData.customRequest && requestData.products && requestData.products.length > 0) {
        // Insertar múltiples detalles para solicitud estándar
        const detalles = requestData.products.map(p => ({
          solicitud_compra_id: solicitudId,
          producto_id: parseInt(p.productId),
          cantidad: p.quantity,
          descripcion_producto_personalizado: null,
        })).filter(d => !isNaN(d.producto_id)); // Doble verificación, aunque ya debería estar filtrado
        
        if (detalles.length > 0) {
            const { error: detalleError } = await supabase.from('solicitudcompra_detalle').insert(detalles);
            if (detalleError) throw detalleError;
        }
      }
      
      // Notificar a los administradores usando el servicio
      const adminUserIds = await fetchAdminUserIds();
      if (adminUserIds.length > 0) {
        const notificationsPayload: NotificacionInsert[] = adminUserIds.map(adminUserId => ({
          user_id: adminUserId,
          title: 'Nueva Solicitud de Compra',
          description: `El empleado ${userProfile.empleado?.nombre || 'Desconocido'} (${userProfile.departamento?.nombre || 'Dpto. Desc.'}) ha creado la solicitud #${solicitudId}: ${finalDescriptionForSolicitud}.`,
          type: 'nueva_solicitud',
        }));
        const notifResult = await createNotifications(notificationsPayload);
        if (!notifResult.success) {
            console.warn("No se pudieron crear algunas notificaciones para administradores:", notifResult.error);
        }
      } else {
        console.warn("No se encontraron IDs de administradores para notificar sobre nueva solicitud.");
      }

      alert('¡Solicitud creada exitosamente!');
      navigate('/solicitudes'); 
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error al enviar solicitud:', errorMessage, error);
      alert(`Error al crear la solicitud: ${errorMessage}`);
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Crear Nueva Solicitud de Compra</h1>
        <RequestForm
          onSubmit={handleSubmitRequest}
          onCancel={() => navigate(-1)} // Volver a la página anterior
          isSubmitting={submittingRequest}
        />
      </div>
    </div>
  );
};

export default RequestFormPage;