const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const content = fs.readFileSync('./supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

(async () => {
    const rezagados = [{
        orden_compra_id: null,
        producto_id: 1, // Any valid product ID
        cantidad: 10,
        motivo: 'Test',
        solicitud_id: null
    }];
    console.log("Trying to insert into productos_rezagados:", rezagados);
    const result = await supabase.from('productos_rezagados').insert(rezagados);
    console.log("Result:", JSON.stringify(result, null, 2));
    process.exit(0);
})();
