import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { RequestForm } from '../components/requests/RequestForm';
import { UserProfile, NotificacionInsert, SolicitudCompra } from '../types';
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

interface RequestFormData {
    products: ProductLineForSubmit[];
    description: string; 
    quoteFile: File | null;
}

const RequestFormPage: React.FC = () => {
  const { userProfile } = useOutletContext<RequestFormPageContext>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<SolicitudCompra | undefined>(undefined);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    // Comprobar si hay una solicitud para editar o clonar en el estado de navegación
    const state = location.state as { requestToClone?: SolicitudCompra; requestToEdit?: SolicitudCompra } | null;
    
    if (state?.requestToEdit) {
      setRequestToEdit(state.requestToEdit);
      setIsUpdateMode(true);
    } else if (state?.requestToClone) {
      // Si es clonación, usamos los datos pero no activamos modo edición (se creará una nueva)
      setRequestToEdit(state.requestToClone);
      setIsUpdateMode(false);
    }
  }, [location.state]);

  const handleUpdateRequest = async (requestData: RequestFormData) => {
    if (!requestToEdit) return;
    setSubmittingRequest(true);

    try {
        let finalDescription = requestToEdit.descripcion || "";
        
        // Regenerar descripción si ha cambiado algo significativo
        const productInputsForAI: any[] = requestData.products
            .filter(p => !p.isNew && p.productId)
            .map(p => ({
                productId: parseInt(p.productId, 10),
                quantity: p.quantity,
            }));

        // Si hay productos existentes, intentamos generar la descripción
        if (productInputsForAI.length > 0) {
            finalDescription = await aiGenerateDescription(productInputsForAI);
        } else {
            const newProductNames = requestData.products.filter(p => p.isNew).map(p => p.newProductDescription);
            finalDescription = newProductNames.length > 0 ? `Solicitud de ${newProductNames.join(', ')}` : "Solicitud Modificada";
        }
        
        // Mantener adjuntos si existen en la descripción original
        const attachmentRegex = /\[Adjunto: .*?\]\(.*?\)/;
        const existingAttachment = requestToEdit.descripcion?.match(attachmentRegex);
        
        let descriptionToSave = finalDescription.substring(0, 255);
        if (existingAttachment && !requestData.quoteFile) {
             descriptionToSave += `\n\n${existingAttachment[0]}`;
        }

        // Actualizar cabecera
        const { error: updateError } = await supabase
            .from('solicitudcompra')
            .update({ 
                descripcion: descriptionToSave,
                updated_at: new Date().toISOString() 
            })
            .eq('id', requestToEdit.id);
        
        if (updateError) throw updateError;

        // Actualizar detalles: Eliminar y Reinsertar
        const { error: deleteError } = await supabase
            .from('solicitudcompra_detalle')
            .delete()
            .eq('solicitud_compra_id', requestToEdit.id);
        
        if (deleteError) throw deleteError;

        const detalles = requestData.products.map(p => {
            if (p.isNew) {
                const isCreatingNewCategory = p.newProductCategoryId === 'new';
                return {
                    solicitud_compra_id: requestToEdit.id,
                    producto_id: null,
                    cantidad: p.quantity,
                    descripcion_producto_personalizado: p.newProductDescription,
                    categoria_producto_sugerida_id: isCreatingNewCategory ? null : parseInt(p.newProductCategoryId, 10),
                    categoria_sugerida_nombre: isCreatingNewCategory ? p.newProductNewCategoryName : null,
                };
            } else {
                return {
                    solicitud_compra_id: requestToEdit.id,
                    producto_id: parseInt(p.productId, 10),
                    cantidad: p.quantity,
                    descripcion_producto_personalizado: null,
                    categoria_producto_sugerida_id: null,
                    categoria_sugerida_nombre: null,
                };
            }
        }).filter(d => d.cantidad > 0);

        if (detalles.length > 0) {
            const { error: insertError } = await supabase.from('solicitudcompra_detalle').insert(detalles);
            if (insertError) throw insertError;
        }

        // Manejo de archivo adjunto nuevo
        if (requestData.quoteFile) {
            const file = requestData.quoteFile;
            const filePath = `public/quotes/${requestToEdit.id}/${file.name}`;
            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file, { upsert: true });

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
                if (publicUrl) {
                    const markdownLink = `\n\n[Adjunto: ${file.name}](${publicUrl})`;
                    // Actualizar descripción nuevamente con el link
                    await supabase.from('solicitudcompra').update({ descripcion: descriptionToSave + markdownLink }).eq('id', requestToEdit.id);
                }
            }
        }

        setFeedbackMessage('¡Solicitud actualizada exitosamente!');
        setFeedbackType('success');
        setShowFeedback(true);
        
        setTimeout(() => {
            navigate(-1); // Volver atrás
        }, 2000);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error al actualizar solicitud:', errorMessage, error);
        setFeedbackMessage(`Error al actualizar: ${errorMessage}`);
        setFeedbackType('error');
        setShowFeedback(true);
    } finally {
        setSubmittingRequest(false);
    }
  };

  const handleSubmitRequest = async (requestData: RequestFormData) => {
    if (isUpdateMode) {
        await handleUpdateRequest(requestData);
        return;
    }

    setSubmittingRequest(true);
    if (!userProfile?.empleado_id || !userProfile.departamento_id) {
      setFeedbackMessage("Error: Perfil de usuario incompleto. Contacte al administrador.");
      setFeedbackType('error');
      setShowFeedback(true);
      setSubmittingRequest(false);
      return;
    }

    if (!requestData.products || requestData.products.length === 0) {
        setFeedbackMessage('Debe añadir al menos un producto a la solicitud.');
        setFeedbackType('error');
        setShowFeedback(true);
        setSubmittingRequest(false);
        return;
    }

    try {
      let finalDescriptionForSolicitud = "";
      
      // @ts-ignore
      if (!finalDescriptionForSolicitud) {
          const productInputsForAI: any[] = requestData.products
              .filter(p => !p.isNew && p.productId)
              .map(p => ({
                  productId: parseInt(p.productId, 10),
                  quantity: p.quantity,
              }));

          if (productInputsForAI.length > 0) {
              finalDescriptionForSolicitud = await aiGenerateDescription(productInputsForAI);
          } else {
              const newProductNames = requestData.products
                  .filter(p => p.isNew && p.newProductDescription)
                  .map(p => p.newProductDescription);
              
              finalDescriptionForSolicitud = newProductNames.length > 0
                  ? `Solicitud de ${newProductNames.join(', ')}`
                  : "Solicitud de Compra General";
          }
      }
      
      const { data: solicitudData, error: solicitudError } = await supabase
        .from('solicitudcompra')
        .insert({
          descripcion: finalDescriptionForSolicitud.substring(0, 255),
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id,
        })
        .select('id, codigo_visible')
        .single();

      if (solicitudError) throw solicitudError;
      if (!solicitudData) throw new Error("No se pudo crear la cabecera de la solicitud.");
      const solicitudId = solicitudData.id;
      
      let descriptionWithAttachment = finalDescriptionForSolicitud;

      if (requestData.quoteFile) {
        const file = requestData.quoteFile;
        const filePath = `public/quotes/${solicitudId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);

        if (uploadError) {
          console.warn("Error al subir archivo adjunto, la solicitud se creó sin él:", uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
          if (publicUrl) {
            const markdownLink = `\n\n[Adjunto: ${file.name}](${publicUrl})`;
            descriptionWithAttachment += markdownLink;
            await supabase.from('solicitudcompra').update({ descripcion: descriptionWithAttachment }).eq('id', solicitudId);
          }
        }
      }

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
      setSubmittingRequest(false);
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            {isUpdateMode ? 'Editar Solicitud de Compra' : 'Crear Nueva Solicitud de Compra'}
          </h1>
          <RequestForm
            onSubmit={handleSubmitRequest}
            onCancel={() => navigate(-1)}
            isSubmitting={submittingRequest}
            initialData={requestToEdit}
          />
        </div>
      </div>
    </>
  );
};

export default RequestFormPage;