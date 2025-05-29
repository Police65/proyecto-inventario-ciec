
import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import RequestForm from '../components/requests/RequestForm';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { generateDescription as aiGenerateDescription } from '../services/aiService';


interface RequestFormPageContext {
  userProfile: UserProfile;
}

const RequestFormPage: React.FC = () => {
  const { userProfile } = useOutletContext<RequestFormPageContext>();
  const navigate = useNavigate();

  const handleSubmitRequest = async (requestData: { products: { productId: string; quantity: number }[] | null; description: string | null, customRequest: boolean }) => {
    if (!userProfile?.empleado_id || !userProfile.departamento_id) {
      alert("Error: Perfil de usuario incompleto. Contacte al administrador.");
      return;
    }

    try {
      let finalDescription = "Solicitud de Compra";
      if (requestData.customRequest && requestData.description) {
        finalDescription = requestData.description;
      } else if (!requestData.customRequest && requestData.products && requestData.products.length > 0) {
        const productsForAI = requestData.products.map(p => ({
          productId: parseInt(p.productId, 10),
          quantity: p.quantity
        })).filter(p => !isNaN(p.productId));

        if (productsForAI.length > 0) {
            finalDescription = await aiGenerateDescription(productsForAI);
        } else if (requestData.products.length > 0) {
            console.warn("All product IDs failed to parse for AI description. Using default.");
            finalDescription = "Solicitud de artículos (IDs no procesados)";
        }
      }
      
      const { data: solicitudData, error: solicitudError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: finalDescription,
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id,
        })
        .select('id')
        .single();

      if (solicitudError) throw solicitudError;
      if (!solicitudData) throw new Error("No se pudo crear la cabecera de la solicitud.");

      const solicitudId = solicitudData.id;

      if (!requestData.customRequest && requestData.products && requestData.products.length > 0) {
        const detalles = requestData.products.map(p => ({
          solicitud_compra_id: solicitudId,
          producto_id: parseInt(p.productId),
          cantidad: p.quantity,
        })).filter(d => !isNaN(d.producto_id)); 
        
        if (detalles.length > 0) {
            const { error: detalleError } = await supabase.from('solicitudcompra_detalle').insert(detalles);
            if (detalleError) throw detalleError;
        }
      }
      
      const { data: admins, error: adminError } = await supabase
        .from('user_profile')
        .select('id')
        .eq('rol', 'admin');
      
      if (adminError) {
        console.error("Error fetching admins for notification:", adminError.message, adminError.details, adminError.code);
      }

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
            user_id: admin.id,
            title: 'Nueva Solicitud de Compra',
            description: `El empleado ${userProfile.empleado?.nombre || 'Desconocido'} ha creado la solicitud #${solicitudId}: ${finalDescription}.`,
            created_at: new Date().toISOString(),
            type: 'nueva_solicitud',
            read: false,
            related_id: solicitudId
        }));
        const { error: notifError } = await supabase.from('notificaciones').insert(notifications);
        if (notifError) {
            console.error("Error creating notifications:", notifError.message, notifError.details, notifError.code);
        }
      }


      alert('Solicitud creada exitosamente!');
      navigate('/solicitudes'); 
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error submitting request:', errorMessage, error);
      alert(`Error al crear la solicitud: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Crear Nueva Solicitud de Compra</h1>
        <RequestForm
          onSubmit={handleSubmitRequest}
          onCancel={() => navigate(-1)} 
        />
      </div>
    </div>
  );
};

export default RequestFormPage;
