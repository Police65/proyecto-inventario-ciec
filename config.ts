
// config.ts
// IMPORTANT: These keys are hardcoded for demonstration purposes as per the user's request
// to avoid .env files. In a real application, these should be managed securely.

export const SUPABASE_URL = "https://pckbdperupovxrniubrl.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2JkcGVydXBvdnhybml1YnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNDM1MTIsImV4cCI6MjA1NTcxOTUxMn0.p1qIe03QXpwmMKGeiobK-i5Sv_2ANYkSUQ-eUfydOis";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// IMPORTANT: The user should replace this with their actual OpenRouter API Key.
// This key is exposed in the frontend and is not secure for production.
export const OPENROUTER_API_KEY = "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"; // Updated API Key

// Gemini API Key should be handled via process.env.API_KEY in the execution environment
// as per Gemini API guidelines if Gemini specific features are added.
// export const GEMINI_API_KEY = process.env.API_KEY;