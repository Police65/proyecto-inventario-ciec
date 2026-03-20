import fs from 'fs';
const content = fs.readFileSync('./supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);
const url = urlMatch[1];
const key = keyMatch[1];

async function queries() {
    const rezQuery = await fetch(`${url}/rest/v1/productos_rezagados?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("Rezagados in DB:", await rezQuery.json());

    const ordQuery = await fetch(`${url}/rest/v1/ordencompra?select=*&order=created_at.desc&limit=2`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("Recent orders:", await ordQuery.json());

    const solQuery = await fetch(`${url}/rest/v1/solicitudcompra?select=*,detalles:solicitudcompra_detalle(*)&order=created_at.desc&limit=5`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("Recent solicitides:", JSON.stringify(await solQuery.json(), null, 2));
}

queries();
