
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PARTNER_SUPABASE_URL, PARTNER_SUPABASE_ANON_KEY } from './config';
import { SUPABASE_SERVICE_ROLE_KEY } from './serviceRoleSecret'; 
import { Database, SolicitudCompra, Producto, PartnerDatabaseSchema, PartnerEvent, PartnerMeeting } from './types'; 

interface AuthStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// Asegurar que las variables de configuración de Supabase estén provistas
if (!SUPABASE_URL) {
  throw new Error("La URL de Supabase no está definida. Por favor, revisa tu archivo de configuración (config.ts).");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("La Clave Anónima de Supabase no está definida. Por favor, revisa tu archivo de configuración (config.ts).");
}

// Cliente Supabase principal para operaciones de usuario (usa clave anónima)
// NOTE: Removed <Database> generic to prevent 'type never' errors due to strict schema validation issues.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage, // Usar sessionStorage para que la sesión dure solo mientras la pestaña del navegador esté abierta.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- NUEVO: Cliente Supabase de Administrador (usa clave de servicio) ---
// Este cliente solo debe usarse para operaciones que requieran privilegios de administrador.
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("La clave de servicio de Supabase (SERVICE_ROLE_KEY) no está definida en serviceRoleSecret.ts. Las operaciones de administrador fallarán.");
}
// NOTE: Removed <Database> generic
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});


// --- Cliente para la instancia Supabase del Compañero (Eventos Externos) ---
// NOTE: Typed as generic SupabaseClient or any to avoid schema issues
let partnerSupabaseInstance: SupabaseClient | null = null;

// Almacenamiento ficticio en memoria para evitar conflictos de GoTrueClient
const inMemoryStorage: AuthStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
};

if (PARTNER_SUPABASE_URL && PARTNER_SUPABASE_ANON_KEY) {
  try {
    // NOTE: Removed <PartnerDatabaseSchema> generic
    partnerSupabaseInstance = createClient(PARTNER_SUPABASE_URL, PARTNER_SUPABASE_ANON_KEY, {
      auth: {
        storage: inMemoryStorage,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
  } catch (e) {
    console.error("Error al inicializar el cliente Supabase del compañero (eventos externos):", e);
    partnerSupabaseInstance = null; 
  }
} else {
  console.warn("Configuración para la base de datos del compañero (eventos externos) no está completa. Funcionalidades relacionadas estarán limitadas.");
}
export const partnerSupabase = partnerSupabaseInstance;


// Obtener eventos externos desde la base de datos del compañero
export const fetchExternalEvents = async (limit = 20): Promise<PartnerEvent[]> => {
  if (!partnerSupabase) {
    console.warn("No se pueden obtener eventos externos: cliente Supabase del compañero no inicializado o configuración faltante.");
    return [];
  }
  try {
    const { data, error } = await partnerSupabase
      .from('events') 
      .select('*')
      .order('date', { ascending: false }) 
      .limit(limit);

    if (error) {
      console.error("Error al obtener eventos externos desde BD compañera:", error.message, error.details, error.code);
      return [];
    }
    return (data || []) as PartnerEvent[];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Excepción al obtener eventos externos:", errorMessage, err);
    return [];
  }
};

// Obtener reuniones externas desde la base de datos del compañero
export const fetchExternalMeetings = async (limit = 20): Promise<PartnerMeeting[]> => {
  if (!partnerSupabase) {
    console.warn("No se pueden obtener reuniones externas: cliente Supabase del compañero no inicializado o configuración faltante.");
    return [];
  }
  try {
    const { data, error } = await partnerSupabase
      .from('meetings') 
      .select('*')
      .order('date', { ascending: false }) 
      .limit(limit);

    if (error) {
      console.error("Error al obtener reuniones externas desde BD compañera:", error.message, error.details, error.code);
      return [];
    }
    return (data || []) as PartnerMeeting[];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Excepción al obtener reuniones externas:", errorMessage, err);
    return [];
  }
};

type AgrupableSolicitud = {
  id: number;
  estado: string;
  detalles: {
    producto_id: number | null;
    cantidad: number;
    producto: {
      id: number;
      descripcion: string;
      categoria_id: number | null;
    } | null;
  }[];
  empleado: {
    nombre: string;
    apellido: string;
  } | null;
};

// Agrupar Solicitudes (lógica para encontrar solicitudes similares para posible consolidación)
export const agruparSolicitudes = async (solicitudId: number) => {
  // Tipo para la solicitud actual con sus detalles y productos anidados
  type FetchedSolicitudConDetalles = Pick<SolicitudCompra, 'id' | 'fecha_solicitud' | 'estado' | 'empleado_id' | 'departamento_id' | 'descripcion'> & {
    detalles: Array<{
      producto_id: number | null;
      producto: Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> | null; 
    }> | null;
  };

  // Obtener la solicitud actual para saber qué productos y categorías buscar
  const { data: currentSolicitudData, error: currentSolicitudError } = await supabase
    .from('solicitudcompra')
    .select('id, fecha_solicitud, estado, empleado_id, departamento_id, descripcion, detalles:solicitudcompra_detalle(producto_id, producto:producto_id(id, descripcion, categoria_id))')
    .eq('id', solicitudId)
    .single<FetchedSolicitudConDetalles>();

  if (currentSolicitudError || !currentSolicitudData) {
    console.error("Error al obtener la solicitud actual para agrupar:", currentSolicitudError);
    return { porProducto: [], porCategoria: [] }; 
  }

  if (!currentSolicitudData.detalles || currentSolicitudData.detalles.length === 0) {
    console.warn("La solicitud actual no tiene detalles, no se puede agrupar:", currentSolicitudData);
    return { porProducto: [], porCategoria: [] };
  }

  // Extraer IDs de productos y categorías de la solicitud actual
  const productosIds = currentSolicitudData.detalles
    .filter(d => d.producto_id !== null)
    .map(d => d.producto_id) as number[];

  const categoriasIds = currentSolicitudData.detalles
    .filter(d => d.producto?.categoria_id !== null && d.producto?.categoria_id !== undefined)
    .map(d => d.producto!.categoria_id) as number[];

  // Si no hay IDs válidos, no hay nada que agrupar
  if (productosIds.length === 0 && categoriasIds.length === 0) {
    return { porProducto: [], porCategoria: [] };
  }

  // Construir la consulta para encontrar otras solicitudes 'Pendiente' que contengan los mismos productos
  let query = supabase
    .from('solicitudcompra')
    .select(`
      id,
      estado,
      detalles:solicitudcompra_detalle!inner( 
        producto_id,
        cantidad,
        producto:producto_id(id, descripcion, categoria_id)
      ),
      empleado:empleado_id(nombre, apellido)
    `)
    .neq('id', solicitudId) // Excluir la solicitud actual
    .eq('estado', 'Pendiente'); // Solo buscar entre pendientes

  // Filtrar por los IDs de producto de la solicitud actual, si los hay
  if (productosIds.length > 0) {
    query = query.filter('detalles.producto_id', 'in', `(${productosIds.join(',')})`);
  }

  const { data: agrupables, error: agrupablesError } = await query.returns<AgrupableSolicitud[]>();

  if (agrupablesError) {
    console.error("Error al obtener solicitudes agrupables:", agrupablesError);
    return { porProducto: [], porCategoria: [] };
  }

  // Procesar las solicitudes encontradas para agruparlas
  return {
    porProducto: agruparPorProducto(agrupables || []),
    porCategoria: agruparPorCategoria(agrupables || [], categoriasIds), // Pasar las categorías de la solicitud actual para filtrar
  };
};

// Función auxiliar para agrupar por producto
const agruparPorProducto = (solicitudes: AgrupableSolicitud[]) => {
  const grupos: { [key: number]: { producto_id: number; descripcion?: string; cantidadTotal: number; solicitudes: Set<number>; detalles: any[] } } = {};
  
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach((detalle) => {
      if (!detalle.producto_id || !detalle.producto) return; 

      const productoId = detalle.producto_id;
      const descripcionProducto = detalle.producto.descripcion || 'N/D';

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

// Función auxiliar para agrupar por categoría
const agruparPorCategoria = (solicitudes: AgrupableSolicitud[], categoriasPermitidas: number[]) => {
  const grupos: { [key: number]: { categoria_id: number; cantidadTotal: number; solicitudes: Set<number>; productos: Set<number>; detalles: any[] } } = {};
  
  solicitudes?.forEach(solicitud => {
    solicitud.detalles?.forEach((detalle) => {
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
