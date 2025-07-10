export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? "";

export const GEMINI_API_KEY: string = import.meta.env.VITE_APP_GEMINI_API_KEY_GOOGLE ?? "";
//Clave de la API de luis miguel para el calendario de eventos
export const PARTNER_SUPABASE_URL: string = import.meta.env.VITE_APP_PARTNER_SUPABASE_URL ?? "";
export const PARTNER_SUPABASE_ANON_KEY: string = import.meta.env.VITE_APP_PARTNER_SUPABASE_ANON_KEY ?? "";

// Umbral para notificaciones de órdenes de compra con alto valor (en Bs.)
export const THRESHOLD_ORDEN_GRANDE = 5000000; // Ejemplo: 5 Millones de Bolívares