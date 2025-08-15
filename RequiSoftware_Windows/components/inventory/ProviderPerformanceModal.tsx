import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { RendimientoProveedor } from '../../types';
import { XMarkIcon, CheckCircleIcon, StarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface ProviderPerformanceModalProps {
  show: boolean;
  onHide: () => void;
  orderId: number;
  proveedorId: number;
  proveedorNombre: string;
}

type FormData = Omit<RendimientoProveedor, 'id' | 'created_at' | 'updated_at' | 'proveedor' | 'orden_compra'>;

const ProviderPerformanceModal: React.FC<ProviderPerformanceModalProps> = ({ show, onHide, orderId, proveedorId, proveedorNombre }) => {
  const [formData, setFormData] = useState<Partial<FormData>>({
    orden_compra_id: orderId,
    proveedor_id: proveedorId,
    fecha_evaluacion: new Date().toISOString().split('T')[0],
    calidad_producto_evaluacion: null,
    cumplimiento_pedido_evaluacion: null,
    precio_competitividad_evaluacion: null,
    comunicacion_evaluacion: null,
  });
  const [existingEvaluation, setExistingEvaluation] = useState<RendimientoProveedor | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setLoading(true);
      setError(null);
      const fetchExistingEvaluation = async () => {
        const { data, error: fetchError } = await supabase
          .from('rendimiento_proveedor')
          .select('*')
          .eq('orden_compra_id', orderId)
          .eq('proveedor_id', proveedorId)
          .maybeSingle();

        if (fetchError) {
          setError('Error al cargar evaluación existente.');
          console.error(fetchError);
        } else if (data) {
          setExistingEvaluation(data);
          setFormData({
            ...data, // Spread existing data
            orden_compra_id: data.orden_compra_id, // Ensure these are correctly set
            proveedor_id: data.proveedor_id,
            fecha_evaluacion: data.fecha_evaluacion ? new Date(data.fecha_evaluacion).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          });
        } else {
            setExistingEvaluation(null); // No existing evaluation
            setFormData({ // Reset to default for new evaluation
                orden_compra_id: orderId,
                proveedor_id: proveedorId,
                fecha_evaluacion: new Date().toISOString().split('T')[0],
                calidad_producto_evaluacion: null,
                cumplimiento_pedido_evaluacion: null,
                precio_competitividad_evaluacion: null,
                comunicacion_evaluacion: null,
                tiempo_entrega_estimado_dias: null,
                tiempo_entrega_real_dias: null,
                observaciones: '',
            });
        }
        setLoading(false);
      };
      fetchExistingEvaluation();
    }
  }, [show, orderId, proveedorId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numValue = ['calidad_producto_evaluacion', 'cumplimiento_pedido_evaluacion', 'precio_competitividad_evaluacion', 'comunicacion_evaluacion', 'tiempo_entrega_estimado_dias', 'tiempo_entrega_real_dias'].includes(name)
      ? (value ? parseInt(value, 10) : null)
      : value;
    setFormData(prev => ({ ...prev, [name]: numValue }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Ensure all required fields from formData are present, even if null.
    // The DB schema handles defaults for some, but explicit nulls are better than undefined.
    const payload: Omit<RendimientoProveedor, 'id' | 'created_at' | 'updated_at' | 'proveedor' | 'orden_compra'> = {
        orden_compra_id: orderId,
        proveedor_id: proveedorId,
        fecha_evaluacion: formData.fecha_evaluacion || new Date().toISOString().split('T')[0],
        tiempo_entrega_estimado_dias: formData.tiempo_entrega_estimado_dias === undefined ? null : formData.tiempo_entrega_estimado_dias,
        tiempo_entrega_real_dias: formData.tiempo_entrega_real_dias === undefined ? null : formData.tiempo_entrega_real_dias,
        calidad_producto_evaluacion: formData.calidad_producto_evaluacion === undefined ? null : formData.calidad_producto_evaluacion,
        cumplimiento_pedido_evaluacion: formData.cumplimiento_pedido_evaluacion === undefined ? null : formData.cumplimiento_pedido_evaluacion,
        precio_competitividad_evaluacion: formData.precio_competitividad_evaluacion === undefined ? null : formData.precio_competitividad_evaluacion,
        comunicacion_evaluacion: formData.comunicacion_evaluacion === undefined ? null : formData.comunicacion_evaluacion,
        observaciones: formData.observaciones || null,
    };

    try {
      if (existingEvaluation?.id) {
        const { error: updateError } = await supabase
          .from('rendimiento_proveedor')
          .update(payload)
          .eq('id', existingEvaluation.id);
        if (updateError) throw updateError;
      } else {
        // For insert, ensure all fields in payload are valid or have defaults
        const { error: insertError } = await supabase
          .from('rendimiento_proveedor')
          .insert(payload);
        if (insertError) throw insertError;
      }
      alert('Evaluación guardada exitosamente.');
      onHide();
    } catch (err) {
      const e = err as Error;
      setError(`Error al guardar evaluación: ${e.message}`);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating: React.FC<{ name: keyof FormData; value: number | null | undefined; onChange: (name: keyof FormData, value: number) => void }> = ({ name, value, onChange }) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`w-6 h-6 cursor-pointer ${value && star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          onClick={() => onChange(name, star)}
        />
      ))}
    </div>
  );


  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Evaluar Proveedor: {proveedorNombre} (Orden #{orderId})
          </h3>
          <button onClick={onHide} disabled={submitting} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {loading ? <div className="p-6 flex-grow"><LoadingSpinner message="Cargando evaluación..." /></div> : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
            {error && <div className="p-2 text-sm text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-600 rounded-md">{error}</div>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fecha_evaluacion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Evaluación</label>
                    <input type="date" name="fecha_evaluacion" id="fecha_evaluacion" value={formData.fecha_evaluacion || ''} onChange={handleInputChange} required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingrese la fecha de evaluación.')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="tiempo_entrega_estimado_dias" className="block text-sm font-medium text-gray-700 dark:text-gray-300">T. Estimado (días)</label>
                    <input type="number" name="tiempo_entrega_estimado_dias" id="tiempo_entrega_estimado_dias" value={formData.tiempo_entrega_estimado_dias || ''} onChange={handleInputChange} min="0"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="tiempo_entrega_real_dias" className="block text-sm font-medium text-gray-700 dark:text-gray-300">T. Real (días)</label>
                    <input type="number" name="tiempo_entrega_real_dias" id="tiempo_entrega_real_dias" value={formData.tiempo_entrega_real_dias || ''} onChange={handleInputChange} min="0"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Calidad del Producto</label>
                <StarRating name="calidad_producto_evaluacion" value={formData.calidad_producto_evaluacion} onChange={(name, val) => setFormData(prev => ({...prev, [name]: val}))} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cumplimiento del Pedido</label>
                <StarRating name="cumplimiento_pedido_evaluacion" value={formData.cumplimiento_pedido_evaluacion} onChange={(name, val) => setFormData(prev => ({...prev, [name]: val}))} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Competitividad del Precio</label>
                <StarRating name="precio_competitividad_evaluacion" value={formData.precio_competitividad_evaluacion} onChange={(name, val) => setFormData(prev => ({...prev, [name]: val}))} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comunicación con Proveedor</label>
                <StarRating name="comunicacion_evaluacion" value={formData.comunicacion_evaluacion} onChange={(name, val) => setFormData(prev => ({...prev, [name]: val}))} />
            </div>
            
            <div>
              <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones</label>
              <textarea name="observaciones" id="observaciones" value={formData.observaciones || ''} onChange={handleInputChange} rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Detalles adicionales sobre el rendimiento del proveedor..." />
            </div>

            <div className="pt-4 flex justify-end space-x-3 border-t dark:border-gray-700">
              <button type="button" onClick={onHide} disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={submitting}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
                {submitting ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-1.5 -ml-1" />}
                {submitting ? "Guardando..." : (existingEvaluation ? "Actualizar Evaluación" : "Guardar Evaluación")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProviderPerformanceModal;