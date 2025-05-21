const API_URL = import.meta.env.VITE_APP_OPENROUTER_API_URL;
const API_KEY = import.meta.env.VITE_APP_OPENROUTER_API_KEY;
import { supabase } from "../supabaseClient";

async function getProductNames(productIds) {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('id, descripcion')
      .in('id', productIds);
    if (error) throw error;
    return data.map(p => p.descripcion);
  } catch (error) {
    console.error('Error obteniendo nombres de productos:', error);
    return productIds.map(id => `Producto ${id}`);
  }
}

async function generateDescription(products) {
  try {
    const productIds = products.map(p => p.productId);
    const productNames = await getProductNames(productIds);
    const productList = productNames.join(", ");
    const prompt = `Genera una descripción corta (máximo 5 palabras) para una solicitud de compra que incluye: ${productList}. La descripción debe resumir el propósito o categoría general de los productos basándote en su naturaleza.`;
    console.log("Prompt enviado:", prompt);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`, // Añadido "Bearer"
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Respuesta de la API:", data);

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error("Respuesta inválida de la API");
    }
  } catch (error) {
    console.error("Error en generateDescription:", error);
    return "Solicitud múltiple";
  }
}

export { generateDescription, getProductNames };