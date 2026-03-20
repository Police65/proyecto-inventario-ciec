import fs from 'fs';
const content = fs.readFileSync('./supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);
const url = urlMatch[1];
const key = keyMatch[1];

async function checkCols() {
  const req = await fetch(`${url}/rest/v1/productos_rezagados?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const res = await req.json();
  console.log('Row example:', res);
}
checkCols();
