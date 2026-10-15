import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Everything runs in the browser: there is no server and no database.
// The "servers" and "tables" on the page are plain objects in memory.
export default defineConfig({
  plugins: [react()],
})
