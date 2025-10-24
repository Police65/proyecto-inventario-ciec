import React, { useState } from 'react';
// @ts-ignore
import { useNavigate, useOutletContext } from 'react-router-dom';
import { RequestForm } from '../components/requests/RequestForm';
import { UserProfile, NotificacionInsert } from '../types';
import { generateDescription as aiGenerateDescription } from '../services/aiService';
import { createNotifications, fetchAdminUserIds } from '../services/notificationService';
import FeedbackModal from '../components/core/FeedbackModal';
import { supabase } from '../supabaseClient';

interface RequestFormPageContext {
  userProfile: UserProfile;
}

interface ProductLineForSubmit {
  id: string;
  isNew: boolean;
  productId: string;
  newProductDescription: string;
  newProductCategoryId: string;
  newProductNewCategoryName: string;
  quantity: number;
}

const RequestFormPage: React.FC = () => {
  const { userProfile } = useOutletContext<RequestFormPageContext>();
  const navigate = useNavigate();
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  const handleSubmitRequest = async (requestData: { products: ProductLineForSubmit[] }) => {
    setSubmittingRequest(true);
    if (!userProfile?.empleado_id || !userProfile.departamento_id) {
      setFeedbackMessage("Error: Perfil de usuario incompleto. Contacte al administrador.");
      setFeedbackType('error');
      setShowFeedback(true);
      setSubmittingRequest(false);
      return;
    }

    // Validations are now mostly handled inside RequestForm, but a final check is good.
    if (!requestData.products || requestData.products.length === 0) {
        setFeedbackMessage('Debe añadir al menos un producto a la solicitud.');
        setFeedbackType('error');
        setShowFeedback(true);
        setSubmittingRequest(false);
        return;
    }

    try {
      // Intentar generar descripción con IA para la solicitud
      const productsForAI = requestData.products.map(p => ({
        // Para la IA, solo necesitamos un nombre y cantidad.
        // Si es un producto nuevo, usamos su descripción. Si es existente, necesitaremos buscarlo.
        // Por simplicidad aquí para la descripción de la IA, solo pasaremos los nombres que ya tenemos.
        productName: p.isNew ? p.newProductDescription : `Producto ID ${p.productId}`, 
        quantity: p.quantity
      }));
      
      const productNamesForAI = (await Promise.all(requestData.products.map(async p => {
        if(p.isNew) return p.newProductDescription;
        const {data} = await supabase.from('producto').select('descripcion').eq('id', p.productId).single();
        return data?.descripcion || `Producto ID ${p.productId}`;
      }))).filter(Boolean);


      const finalDescriptionForSolicitud = productNamesForAI.length > 0
        ? `Solicitud de: ${productNamesForAI.join(', ')}`
        : "Solicitud de Compra";
      
      // Crear la cabecera de la solicitud
      const { data: solicitudData, error: solicitudError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: finalDescriptionForSolicitud.substring(0, 255), // Truncate to fit if needed
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id,
        })
        .select('id, codigo_visible')
        .single();

      if (solicitudError) throw solicitudError;
      if (!solicitudData) throw new Error("No se pudo crear la cabecera de la solicitud.");
      const solicitudId = solicitudData.id;

      // Mapear y filtrar detalles para la inserción
      const detalles = requestData.products.map(p => {
        if (p.isNew) {
          const isCreatingNewCategory = p.newProductCategoryId === 'new';
          return {
            solicitud_compra_id: solicitudId,
            producto_id: null,
            cantidad: p.quantity,
            descripcion_producto_personalizado: p.newProductDescription,
            categoria_producto_sugerida_id: isCreatingNewCategory ? null : parseInt(p.newProductCategoryId, 10),
            categoria_sugerida_nombre: isCreatingNewCategory ? p.newProductNewCategoryName : null,
          };
        } else {
          return {
            solicitud_compra_id: solicitudId,
            producto_id: parseInt(p.productId, 10),
            cantidad: p.quantity,
            descripcion_producto_personalizado: null,
            categoria_producto_sugerida_id: null,
            categoria_sugerida_nombre: null,
          };
        }
      }).filter(d => d.cantidad > 0);
      
      if (detalles.length > 0) {
        const { error: detalleError } = await supabase.from('solicitudcompra_detalle').insert(detalles);
        if (detalleError) throw detalleError;
      }
      
      // Notificar a los administradores
      const adminUserIds = await fetchAdminUserIds();
      if (adminUserIds.length > 0) {
        const notificationsPayload: NotificacionInsert[] = adminUserIds.map(adminUserId => ({
          user_id: adminUserId,
          title: 'Nueva Solicitud de Compra',
          description: `El empleado ${userProfile.empleado?.nombre || 'Desconocido'} (${userProfile.departamento?.nombre || 'Dpto. Desc.'}) ha creado la solicitud #${solicitudData.codigo_visible || solicitudId}: ${finalDescriptionForSolicitud}.`,
          type: 'nueva_solicitud',
        }));
        await createNotifications(notificationsPayload);
      }
      
      setFeedbackMessage('¡Solicitud creada exitosamente!');
      setFeedbackType('success');
      setShowFeedback(true);
      
      setTimeout(() => {
        navigate('/solicitudes');
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error al enviar solicitud:', errorMessage, error);
      setFeedbackMessage(`Error al crear la solicitud: ${errorMessage}`);
      setFeedbackType('error');
      setShowFeedback(true);
      setSubmittingRequest(false); // Only stop submitting on error
    }
  };

  return (
    <>
      <FeedbackModal
        show={showFeedback}
        type={feedbackType}
        message={feedbackMessage}
        onClose={() => setShowFeedback(false)}
      />
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Crear Nueva Solicitud de Compra</h1>
          <RequestForm
            onSubmit={handleSubmitRequest}
            onCancel={() => navigate(-1)}
            isSubmitting={submittingRequest}
          />
        </div>
      </div>
    </>
  );
};

export default RequestFormPage;