import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { Database, SolicitudCompra, SolicitudCompraDetalle, Producto } from './types';

if (!SUPABASE_URL) {
  throw new Error("La URL de Supabase no está definida. Por favor, verifica tu configuración.");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("La Clave Anónima de Supabase no está definida. Por favor, verifica tu configuración.");
}

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const agruparSolicitudes = async (solicitudId: number) => {
  type FetchedSolicitudConDetalles = Pick<SolicitudCompra, 'id' | 'fecha_solicitud' | 'estado' | 'empleado_id' | 'departamento_id' | 'descripcion'> & {
    detalles: Array<{
      producto_id: number | null;
      producto: Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> | null;
    }> | null; 
  };

  const { data: currentSolicitudData, error: currentSolicitudError } = await supabase
    .from('solicitudcompra')
    .select('id, fecha_solicitud, estado, empleado_id, departamento_id, descripcion, detalles:solicitudcompra_detalle(producto_id, producto:producto_id(id, descripcion, categoria_id))')
    .eq('id', solicitudId)
    .single<FetchedSolicitudConDetalles>();

  if (currentSolicitudError || !currentSolicitudData) {
    console.error("Error al obtener la solicitud actual para agrupación:", currentSolicitudError);
    return { porProducto: [], porCategoria: [] };
  }

  const currentSolicitud = currentSolicitudData;

  if (!currentSolicitud.detalles || currentSolicitud.detalles.length === 0) {
    console.warn("La solicitud actual no tiene detalles o el array de detalles está vacío para agrupación:", currentSolicitud);
    return { porProducto: [], porCategoria: [] };
  }

  const productosIds = currentSolicitud.detalles
    .map(d => d.producto_id)
    .filter(id => id !== null) as number[];

  const categoriasIds = currentSolicitud.detalles
    .filter(d => d.producto?.categoria_id !== null && d.producto?.categoria_id !== undefined)
    .map(d => d.producto!.categoria_id) as number[];

  if (productosIds.length === 0 && categoriasIds.length === 0) {
    return { porProducto: [], porCategoria: [] };
  }

  let query = supabase
    .from('solicitudcompra')
    .select(`
      id,
      estado,
      detalles!inner(
        producto_id, 
        cantidad, 
        producto:producto_id(id, descripcion, categoria_id) 
      ),
      empleado:empleado_id(nombre, apellido)
    `)
    .neq('id', solicitudId)
    .eq('estado', 'Pendiente');

  if (productosIds.length > 0) {
    query = query.filter('detalles.producto_id', 'in', `(${productosIds.join(',')})`);
  }

  const { data: agrupables, error: agrupablesError } = await query;

  if (agrupablesError) {
    console.error("Error al obtener solicitudes agrupables:", agrupablesError);
    return { porProducto: [], porCategoria: [] };
  }

  return {
    porProducto: agruparPorProducto(agrupables || []),
    porCategoria: agruparPorCategoria(agrupables || [], categoriasIds),
  };
};

const agruparPorProducto = (solicitudes: any[]) => {
  const grupos: { [key: number]: { producto_id: number; descripcion?: string; cantidadTotal: number; solicitudes: Set<number>; detalles: any[] } } = {};
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach((detalle: any) => {
      if (!detalle.producto_id) return;
      const productoId = detalle.producto_id;
      const descripcionProducto = detalle.producto?.descripcion || 'N/D';

      if (!grupos[productoId]) {
        grupos[productoId] = {
          producto_id: productoId,
          descripcion: descripcionProducto,
          cantidadTotal: 0,
          solicitudes: new Set(),
          detalles: []
        };
      }
      grupos[productoId].cantidadTotal += detalle.cantidad;
      grupos[productoId].solicitudes.add(solicitud.id);
      grupos[productoId].detalles.push({ ...detalle, solicitudEmpleado: solicitud.empleado });
    });
  });
  return Object.values(grupos);
};

const agruparPorCategoria = (solicitudes: any[], categoriasPermitidas: number[]) => {
  const grupos: { [key: number]: { categoria_id: number; cantidadTotal: number; solicitudes: Set<number>; productos: Set<number>; detalles: any[] } } = {};
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach((detalle: any) => {
      const categoriaId = detalle.producto?.categoria_id;
      if (!categoriaId) return;
      if (categoriasPermitidas.length > 0 && !categoriasPermitidas.includes(categoriaId)) return;

      if (!grupos[categoriaId]) {
        grupos[categoriaId] = {
          categoria_id: categoriaId,
          cantidadTotal: 0,
          solicitudes: new Set(),
          productos: new Set(),
          detalles: []
        };
      }
      grupos[categoriaId].cantidadTotal += detalle.cantidad;
      grupos[categoriaId].solicitudes.add(solicitud.id);
      if (detalle.producto_id) grupos[categoriaId].productos.add(detalle.producto_id);
      grupos[categoriaId].detalles.push({ ...detalle, solicitudEmpleado: solicitud.empleado });
    });
  });
  return Object.values(grupos);
};