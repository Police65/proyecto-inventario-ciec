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

// Función para obtener solicitudes agrupables
export const getSolicitudesAgrupables = async (solicitudId) => {
  const { data: currentSolicitud } = await supabase
    .from('solicitudcompra')
    .select('detalles:solicitudcompra_detalle(producto_id)')
    .eq('id', solicitudId)
    .single();

  const productoIds = currentSolicitud.detalles.map(d => d.producto_id);

  const { data } = await supabase
    .from('solicitudcompra')
    .select(`
      *,
      detalles:solicitudcompra_detalle(producto_id, cantidad),
      empleado:empleado_id(nombre, apellido)
    `)
    .eq('estado', 'Pendiente')
    .in('id', 
      supabase
        .from('solicitudcompra_detalle')
        .select('solicitud_compra_id')
        .in('producto_id', productoIds)
    )
    .neq('id', solicitudId);

  return data || [];
};

// Función para crear orden consolidada
export const crearOrdenConsolidada = async (solicitudes, proveedorId) => {
  const { data: orden, error } = await supabase
    .from('ordencompra')
    .insert({
      estado_orden: 'borrador',
      proveedor_id: proveedorId,
      fecha_orden: new Date().toISOString(),
      estado: 'Consolidada'
    })
    .select('*')
    .single();

  if (error) throw error;

  // Insertar relación en orden_solicitud
  const relaciones = solicitudes.map(s => ({
    orden_id: orden.id,
    solicitud_id: s.id
  }));
  
  await supabase
    .from('orden_solicitud')
    .insert(relaciones);

  // Insertar detalles de la orden
  const detalles = solicitudes.flatMap(s => 
    s.detalles.map(d => ({
      orden_compra_id: orden.id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      precio_unitario: 0
    }))
  );

  await supabase.from('ordencompra_detalle').insert(detalles);
  
  // Actualizar estado de las solicitudes
  await supabase
    .from('solicitudcompra')
    .update({ estado: 'En Proceso' })
    .in('id', solicitudes.map(s => s.id));

  return orden;
};

// Función para obtener solicitudes de una orden
export const getSolicitudesDeOrden = async (ordenId) => {
  const { data } = await supabase
    .from('orden_solicitud')
    .select('solicitud_id')
    .eq('orden_id', ordenId);

  const solicitudIds = data?.map(item => item.solicitud_id) || [];

  const { data: solicitudes } = await supabase
    .from('solicitudcompra')
    .select('*')
    .in('id', solicitudIds);

  return solicitudes;
};