// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Configuración principal de Supabase
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

// Funciones de agrupación
export const agruparSolicitudes = async (solicitudId) => {
  const { data: currentSolicitud } = await supabase
    .from('solicitudcompra')
    .select('*, detalles:solicitudcompra_detalle(*, producto:producto_id(categoria_id))')
    .eq('id', solicitudId)
    .single();

  const productosIds = currentSolicitud.detalles.map(d => d.producto_id);
  const categoriasIds = currentSolicitud.detalles.map(d => d.producto.categoria_id);

  // Corregir la sintaxis de la consulta
  const { data: agrupables } = await supabase
    .from('solicitudcompra')
    .select(`
      *,
      detalles:solicitudcompra_detalle(*, producto:producto_id(categoria_id)),
      empleado:empleado_id(nombre, apellido)
    `)
    .or(`and(estado.eq.Pendiente,detalles.producto_id.in.(${productosIds.join(',')}),
          and(estado.eq.Pendiente,producto.categoria_id.in.(${categoriasIds.join(',')}))`)
    .neq('id', solicitudId);

  return {
    porProducto: agruparPorProducto(agrupables),
    porCategoria: agruparPorCategoria(agrupables)
  };
};

// Funciones helper
const agruparPorProducto = (solicitudes) => {
  const grupos = {};
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach(detalle => {
      const productoId = detalle.producto_id;
      if (!grupos[productoId]) {
        grupos[productoId] = {
          producto: detalle.producto_id,
          cantidadTotal: 0,
          solicitudes: new Set(),
          detalles: []
        };
      }
      grupos[productoId].cantidadTotal += detalle.cantidad;
      grupos[productoId].solicitudes.add(solicitud.id);
      grupos[productoId].detalles.push(detalle);
    });
  });
  return Object.values(grupos);
};

const agruparPorCategoria = (solicitudes) => {
  const grupos = {};
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach(detalle => {
      const categoriaId = detalle.producto?.categoria_id;
      if (!grupos[categoriaId]) {
        grupos[categoriaId] = {
          categoria: categoriaId,
          cantidadTotal: 0,
          solicitudes: new Set(),
          productos: new Set(),
          detalles: []
        };
      }
      grupos[categoriaId].cantidadTotal += detalle.cantidad;
      grupos[categoriaId].solicitudes.add(solicitud.id);
      grupos[categoriaId].productos.add(detalle.producto_id);
      grupos[categoriaId].detalles.push(detalle);
    });
  });
  return Object.values(grupos);
};