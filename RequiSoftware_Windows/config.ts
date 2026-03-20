// config.ts
// Las claves ahora se cargan de forma segura desde las variables de entorno (.env)

export const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

// --- Configuración de la Base de Datos del Compañero (Calendario de Eventos) ---

export const PARTNER_SUPABASE_URL = (import.meta as any).env.VITE_PARTNER_SUPABASE_URL || "";
export const PARTNER_SUPABASE_ANON_KEY = (import.meta as any).env.VITE_PARTNER_SUPABASE_ANON_KEY || "";

// Umbral para notificaciones de órdenes de compra con alto valor (en Bs.)
export const THRESHOLD_ORDEN_GRANDE = 5000000; // Ejemplo: 5 Millones de Bolívares
