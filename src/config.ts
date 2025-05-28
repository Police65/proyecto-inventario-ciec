// config.ts

// Supabase Config
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// OpenRouter Config
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// Gemini API Key is handled by Vite's 'define' feature in vite.config.ts,
// making process.env.API_KEY directly available to the @google/genai SDK.
// It sources its value from VITE_GEMINI_API_KEY in your .env file.
// No need to export GEMINI_API_KEY from here if the SDK uses process.env.API_KEY.

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase URL or Anon Key is not configured. Check your .env file.");
}
if (!OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "YOUR_OPENROUTER_API_KEY_PLACEHOLDER_IF_ANY") { // check if it's not a placeholder you might use
  // console.warn("OpenRouter API Key is not configured. AI features relying on OpenRouter may not work. Check your .env file.");
}
if (!import.meta.env.VITE_GEMINI_API_KEY) {
  // console.warn("Gemini API Key (VITE_GEMINI_API_KEY) is not configured. AI features relying on Gemini may not work. Check your .env file.");
}
