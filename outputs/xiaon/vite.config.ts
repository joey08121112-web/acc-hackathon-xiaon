import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: process.env.XIAON_API_TARGET ?? 'http://127.0.0.1:18920', changeOrigin: false } } },
});
