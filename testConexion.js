import { supabase } from './src/supabaseClientTest.js'; // Asegúrate de que la ruta sea correcta


async function verificarConexion() {
  try {
    console.log('Verificando conexión con la base de datos...');

    // Realiza una consulta simple a la tabla "Proveedor"
    const { data, error } = await supabase
      .from('proveedor')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error al conectar con la base de datos:', error.message);
    } else {
      console.log('✅ Conexión exitosa. Datos obtenidos:', data);
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
  }
}

// Ejecuta la función para verificar la conexión
verificarConexion();