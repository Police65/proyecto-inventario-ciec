
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PARTNER_SUPABASE_URL, PARTNER_SUPABASE_ANON_KEY } from './config';
import { SUPABASE_SERVICE_ROLE_KEY } from './serviceRoleSecret';
import { Database, SolicitudCompra, Producto, PartnerDatabaseSchema, PartnerEvent, PartnerMeeting } from './types';

interface AuthStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Configuración de Supabase incompleta.");
}

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

let partnerSupabaseInstance: SupabaseClient<PartnerDatabaseSchema> | null = null;
const inMemoryStorage: AuthStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
};

if (PARTNER_SUPABASE_URL && PARTNER_SUPABASE_ANON_KEY) {
  try {
    partnerSupabaseInstance = createClient<PartnerDatabaseSchema>(PARTNER_SUPABASE_URL, PARTNER_SUPABASE_ANON_KEY, {
      auth: {
        storage: inMemoryStorage,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
  } catch (e) {
    console.error("Error al inicializar el cliente Supabase del compañero:", e);
  }
}
export const partnerSupabase = partnerSupabaseInstance;

/**
 * Obtiene eventos de la DB externa. 
 * Se eliminan filtros agresivos para asegurar compatibilidad si el compañero cambió el esquema.
 */
export const fetchExternalEvents = async (limit = 50): Promise<PartnerEvent[]> => {
  if (!partnerSupabase) return [];
  try {
    // Consultamos solo columnas básicas que suelen ser estándar
    const { data, error } = await partnerSupabase
      .from('events') 
      .select('*') // Traemos todo para evitar errores de "columna no encontrada"
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
        throw error;
    }
    
    // Filtrado manual seguro post-consulta si las columnas existen
    const filteredData = (data || []).filter((item: any) => item.is_cancelled !== true);
    
    console.log(`[Sync] ${filteredData.length} eventos externos recibidos.`);
    return filteredData as PartnerEvent[];
  } catch (err: any) {
    console.error("Error crítico fetchExternalEvents:", err.message || err);
    throw new Error(err.message || "Error al conectar con la tabla 'events' externa.");
  }
};

/**
 * Obtiene reuniones de la DB externa.
 */
export const fetchExternalMeetings = async (limit = 50): Promise<PartnerMeeting[]> => {
  if (!partnerSupabase) return [];
  try {
    const { data, error } = await partnerSupabase
      .from('meetings') 
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
        throw error;
    }

    const filteredData = (data || []).filter((item: any) => item.is_cancelled !== true);
    console.log(`[Sync] ${filteredData.length} reuniones externas recibidas.`);
    return filteredData as PartnerMeeting[];
  } catch (err: any) {
    console.error("Error crítico fetchExternalMeetings:", err.message || err);
    throw new Error(err.message || "Error al conectar con la tabla 'meetings' externa.");
  }
};

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

  if (currentSolicitudError || !currentSolicitudData) return { porProducto: [], porCategoria: [] };

  const productosIds = currentSolicitudData.detalles?.filter(d => d.producto_id !== null).map(d => d.producto_id) as number[] || [];
  const categoriasIds = currentSolicitudData.detalles?.filter(d => d.producto?.categoria_id != null).map(d => d.producto!.categoria_id) as number[] || [];

  if (productosIds.length === 0) return { porProducto: [], porCategoria: [] };

  const { data: agrupables, error: agrupablesError } = await supabase
    .from('solicitudcompra')
    .select(`
      id, estado,
      detalles:solicitudcompra_detalle!inner(producto_id, cantidad, producto:producto_id(id, descripcion, categoria_id)),
      empleado:empleado_id(nombre, apellido)
    `)
    .neq('id', solicitudId)
    .eq('estado', 'Pendiente')
    .filter('detalles.producto_id', 'in', `(${productosIds.join(',')})`);

  if (agrupablesError) return { porProducto: [], porCategoria: [] };

  return {
    porProducto: agruparPorProducto(agrupables || []),
    porCategoria: agruparPorCategoria(agrupables || [], categoriasIds),
  };
};

const agruparPorProducto = (solicitudes: any[]) => {
  const grupos: { [key: number]: any } = {};
  solicitudes.forEach(sol => {
    sol.detalles?.forEach((det: any) => {
      if (!det.producto_id) return;
      if (!grupos[det.producto_id]) {
        grupos[det.producto_id] = { producto_id: det.producto_id, descripcion: det.producto.descripcion, cantidadTotal: 0, solicitudes: new Set() };
      }
      grupos[det.producto_id].cantidadTotal += det.cantidad;
      grupos[det.producto_id].solicitudes.add(sol.id);
    });
  });
  return Object.values(grupos);
};

const agruparPorCategoria = (solicitudes: any[], categoriasPermitidas: number[]) => {
  const grupos: { [key: number]: any } = {};
  solicitudes.forEach(sol => {
    sol.detalles?.forEach((det: any) => {
      const catId = det.producto?.categoria_id;
      if (!catId || !categoriasPermitidas.includes(catId)) return;
      if (!grupos[catId]) {
        grupos[catId] = { categoria_id: catId, cantidadTotal: 0, solicitudes: new Set() };
      }
      grupos[catId].cantidadTotal += det.cantidad;
      grupos[catId].solicitudes.add(sol.id);
    });
  });
  return Object.values(grupos);
};
