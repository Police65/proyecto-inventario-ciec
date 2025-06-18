export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? "";
export const OPENROUTER_API_URL: string = import.meta.env.VITE_APP_OPENROUTER_API_URL ?? "";
export const OPENROUTER_API_KEY: string = import.meta.env.VITE_APP_OPENROUTER_API_KEY ?? "";
//Clave de la API de luis miguel para el calendario de eventos
export const PARTNER_SUPABASE_URL: string = import.meta.env.VITE_APP_PARTNER_SUPABASE_URL ?? "";
export const PARTNER_SUPABASE_ANON_KEY: string = import.meta.env.VITE_APP_PARTNER_SUPABASE_ANON_KEY ?? "";
// Umbral para notificaciones de órdenes de compra con alto valor (en Bs.)
export const THRESHOLD_ORDEN_GRANDE = 5000000; // Ejemplo: 5 Millones de Bolívares
