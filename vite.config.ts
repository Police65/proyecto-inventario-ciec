import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production) from the project root
  const env = loadEnv(mode, '', ''); // process.cwd() is the default for the second arg if empty string is passed.

  return {
    plugins: [react()],
    define: {
      // Make process.env.API_KEY available in client code for Gemini SDK
      // It takes its value from VITE_GEMINI_API_KEY in the .env file.
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
    },
    server: {
      port: 5173, 
      open: true   
    }
  }
})