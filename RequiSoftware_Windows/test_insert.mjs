import fs from 'fs';
const url = 'https://pckbdperupovxrniubrl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2JkcGVydXBvdnhybml1YnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNDM1MTIsImV4cCI6MjA1NTcxOTUxMn0.p1qIe03QXpwmMKGeiobK-i5Sv_2ANYkSUQ-eUfydOis';

async function test() {
  const req = await fetch(`${url}/rest/v1/productos_rezagados`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify([{
      orden_compra_id: null,
      producto_id: 1, // ID válido asumido o dejemos como 2 a ver
      cantidad: 10,
      motivo: 'Test post',
      solicitud_id: null
    }])
  });
  const res = await req.json();
  console.log(res);
}

test();
