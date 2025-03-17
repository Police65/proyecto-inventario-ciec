import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Funciones helper para agrupación
export const agruparSolicitudes = async (solicitudId) => {
  // Obtener la solicitud actual
  const { data: currentSolicitud } = await supabase
    .from('solicitudcompra')
    .select('*, detalles:solicitudcompra_detalle(*)')
    .eq('id', solicitudId)
    .single();

  // Obtener posibles agrupaciones por producto o categoría
  const { data: agrupables } = await supabase
    .from('solicitudcompra')
    .select(`
      *,
      detalles:solicitudcompra_detalle(*),
      producto:producto(id, categoria_id)
    `)
    .or(`and(estado.eq.Pendiente,detalles.producto_id.in.(${currentSolicitud.detalles.map(d => d.producto_id).join(',')})),
          and(estado.eq.Pendiente,producto.categoria_id.in.(${currentSolicitud.detalles.map(d => d.producto?.categoria_id).join(',')}))`)
    .neq('id', solicitudId);

  return agrupables || [];
};

export const crearOrdenConsolidada = async (solicitudes, proveedorId, productosSeleccionados) => {
  // Crear la orden
  const { data: orden, error } = await supabase
    .from('ordencompra')
    .insert({
      proveedor_id: proveedorId,
      estado: 'Borrador',
      fecha_orden: new Date().toISOString()
    })
    .select('*')
    .single();

  // Insertar detalles de la orden
  const detalles = productosSeleccionados.map(p => ({
    orden_compra_id: orden.id,
    producto_id: p.producto_id,
    cantidad: p.cantidad,
    precio_unitario: 0
  }));

  await supabase.from('ordencompra_detalle').insert(detalles);

  // Vincular solicitudes con la orden
  const relaciones = solicitudes.map(s => ({
    orden_id: orden.id,
    solicitud_id: s.id
  }));
  
  await supabase.from('orden_solicitud').insert(relaciones);

  // Actualizar estado de las solicitudes
  await supabase
    .from('solicitudcompra')
    .update({ estado: 'En Proceso' })
    .in('id', solicitudes.map(s => s.id));

  return orden;
};

export const obtenerProductosPendientes = async () => {
  return await supabase
    .from('solicitudcompra_detalle')
    .select(`
      producto_id,
      cantidad,
      producto:producto_id(descripcion, categoria_id),
      solicitud:solicitud_compra_id(estado)
    `)
    .eq('solicitud.estado', 'Pendiente');
};