import { supabase } from '../supabaseClient';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '../config';

interface ProductInput {
  productId: number;
  quantity: number;
}

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
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("La clave API de Gemini no está configurada en config.ts");
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    const productIds = products.map(p => p.productId);
    const productNames = await getProductNames(productIds);

    if (productNames.length === 0) return "Solicitud de compra (sin detalles)";

    const productList = productNames.join(", ");
    const prompt = `Como asistente de RequiSoftware para la Cámara de Industriales, genera una descripción corta y concisa en español (máximo 5 palabras, idealmente 2-3 palabras) para una solicitud de compra que incluye los siguientes artículos: ${productList}. La descripción debe ser un resumen general del tipo de artículos. Por ejemplo, si los artículos son "Resma de papel, Bolígrafos, Grapadora", una buena descripción podría ser "Suministros de Oficina". Si son "Laptop, Monitor, Teclado", podría ser "Equipamiento Informático".`;

    console.log("Prompt enviado a Gemini:", prompt);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          maxOutputTokens: 50,
      }
    });

    const responseText = response.text;
    console.log("Respuesta de Gemini API (raw):", responseText);

    if (!responseText) {
      console.warn("La respuesta de la API de IA fue una cadena vacía. Usando descripción de respaldo.");
      return "Solicitud de artículos variados";
    }

    let generatedDesc = responseText.trim().replace(/["*]/g, '');
    const words = generatedDesc.split(/\s+/);
    if (words.length > 7) { 
        generatedDesc = words.slice(0, 7).join(" ") + "...";
    }
    return generatedDesc || "Solicitud Múltiple";

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error en generateDescription con Gemini:", errorMessage, error);
    return "Solicitud de compra (error en IA)";
  }
}

export { getProductNames, generateDescription };