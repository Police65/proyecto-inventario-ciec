
import { supabase } from '../supabaseClient';
import { OPENROUTER_API_URL, OPENROUTER_API_KEY } from '../config';

interface ProductInput {
  productId: number;
  quantity: number;
}

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : "https://example.com";

async function getProductNames(productIds: number[]): Promise<string[]> {
  if (productIds.length === 0) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('id, descripcion')
      .in('id', productIds);

    if (error) {
      console.error('Error de Supabase al obtener nombres de productos:', error.message, error.details, error.code);
      return productIds.map(id => `Error al obtener Producto ID ${id}`);
    }

    const nameMap = new Map(
      (data || []).map(p => [
        p.id,
        p.descripcion || `Descripción no disponible (ID: ${p.id})` 
      ])
    );

    return productIds.map((id): string => {
      const valueFromMap = nameMap.get(id);
      if (typeof valueFromMap === 'string') {
        return valueFromMap;
      }
      return `Producto ID ${id} (nombre no encontrado)`;
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Fallo en getProductNames:', errorMessage, e);
    return productIds.map(id => `Error para Producto ID ${id}`);
  }
}

async function generateDescription(products: ProductInput[]): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.warn("La clave API de OpenRouter no está configurada. Usando descripción predeterminada.");
    return "Solicitud de compra de varios artículos";
  }

  try {
    const productIds = products.map(p => p.productId);
    const productNames = await getProductNames(productIds);

    if (productNames.length === 0) return "Solicitud de compra (sin detalles)";

    const productList = productNames.join(", ");
    const prompt = `Genera una descripción corta y concisa en español (máximo 5 palabras, idealmente 2-3 palabras) para una solicitud de compra que incluye los siguientes artículos: ${productList}. La descripción debe ser un resumen general del tipo de artículos. Por ejemplo, si los artículos son "Resma de papel, Bolígrafos, Grapadora", una buena descripción podría ser "Suministros de Oficina". Si son "Laptop, Monitor, Teclado", podría ser "Equipamiento Informático".`;

    console.log("Prompt enviado a OpenRouter:", prompt);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": "RequiSoftware CIEC",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3-30b-a3b:free", 
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error en la API de OpenRouter: ${response.status} ${response.statusText} - Cuerpo: ${errorBody}`);
      throw new Error(`Error en la API de OpenRouter: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Respuesta de OpenRouter API (raw):", JSON.stringify(data, null, 2));

    if (data && data.choices && data.choices.length > 0) {
      const firstChoice = data.choices[0];
      if (firstChoice.message && typeof firstChoice.message.content === 'string') {
        if (firstChoice.message.content.trim() === "") {
          if (firstChoice.finish_reason === 'length') {
            console.warn("La respuesta de la API de IA fue una cadena vacía y finish_reason fue 'length'. max_tokens podría ser demasiado bajo o el prompt necesita ajuste. Usando descripción de respaldo.", "Respuesta completa:", JSON.stringify(firstChoice, null, 2));
            return "Solicitud (Respuesta IA truncada)";
          } else {
            console.warn("La respuesta de la API de IA fue una cadena vacía. Usando descripción de respaldo.", "Respuesta completa:", JSON.stringify(firstChoice, null, 2));
            return "Solicitud (Respuesta IA vacía)";
          }
        }
        let generatedDesc = firstChoice.message.content.trim();
        generatedDesc = generatedDesc.replace(/["*]/g, ''); 
        const words = generatedDesc.split(/\s+/);
        if (words.length > 7) { 
            generatedDesc = words.slice(0, 7).join(" ") + "...";
        }
        return generatedDesc || "Solicitud Múltiple";
      } else {
        console.error("La primera opción de la respuesta de la API no tiene la propiedad 'content' como cadena o el objeto 'message'. Respuesta completa:", JSON.stringify(firstChoice, null, 2), "Datos completos:", JSON.stringify(data, null, 2));
        throw new Error("Estructura de mensaje inválida en la respuesta de la API (sin 'content' o 'message').");
      }
    } else {
      console.error("La respuesta de la API no tiene el array 'choices' o está vacío. Datos completos:", JSON.stringify(data, null, 2));
      throw new Error("Estructura de respuesta inválida de la API (sin 'choices' o 'choices' vacío).");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error en generateDescription:", errorMessage, error);
    if (error instanceof TypeError && errorMessage.includes('JSON')) {
        console.error("Potencialmente, la respuesta de la API no fue un JSON válido.");
    }
    return "Solicitud de compra (error en IA)";
  }
}

export { getProductNames, generateDescription };