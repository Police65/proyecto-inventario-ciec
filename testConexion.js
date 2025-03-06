import { supabase } from './src/supabaseClientTest.js'; 
async function verificarConexion() {
  try {
    console.log('Verificando conexión con la base de datos...');

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

verificarConexion();