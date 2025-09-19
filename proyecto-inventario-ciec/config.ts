// config.ts
// IMPORTANTE: Estas claves están directamente en el código para fines de demostración,
// según la solicitud del usuario para evitar archivos .env.
// En una aplicación real, deben gestionarse de forma segura (variables de entorno en backend).

export const SUPABASE_URL = "https://pckbdperupovxrniubrl.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2JkcGVydXBvdnhybml1YnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNDM1MTIsImV4cCI6MjA1NTcxOTUxMn0.p1qIe03QXpwmMKGeiobK-i5Sv_2ANYkSUQ-eUfydOis";

// --- Clave de API de Gemini ---
// La clave de la API de Gemini ahora se obtiene directamente de la variable de entorno
// `process.env.API_KEY` en los archivos de servicio donde se utiliza.
// Este enfoque es más seguro y se alinea con las mejores prácticas para manejar secretos.

// --- Configuración de la Base de Datos del Compañero (Calendario de Eventos) ---
// ADVERTENCIA: Exponer claves API en el código del frontend es un riesgo de seguridad.
// Idealmente, se debería acceder a estas a través de un proxy backend o funciones serverless
// que puedan almacenar y usar estas claves de forma segura.
export const PARTNER_SUPABASE_URL = "https://zsbyslmvvfzhpenfpxzm.supabase.co";
export const PARTNER_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYnlzbG12dmZ6aHBlbmZweHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNDY2MzEsImV4cCI6MjA2NDcyMjYzMX0.aFwhoeoNfV79RtZAZrMYjI6apUNimcTYmV_eBhcQSXs";

// Umbral para notificaciones de órdenes de compra con alto valor (en Bs.)
export const THRESHOLD_ORDEN_GRANDE = 5000000; // Ejemplo: 5 Millones de Bolívares