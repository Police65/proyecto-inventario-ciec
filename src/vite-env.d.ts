/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENROUTER_API_KEY: string
  readonly VITE_GEMINI_API_KEY: string
  // add more env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// If you are using process.env for Gemini API key via Vite's define
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
