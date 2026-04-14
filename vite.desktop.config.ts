import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Configuração exclusiva para o Terminal Desktop (Otimizada para Robô)
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist", // Mantém dist para compatibilidade com o electron-builder atual
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "desktop.html"),
      },
      output: {
        // Chunks agressivos para performance
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-core';
            if (id.includes('lucide')) return 'icons';
            return 'vendor-desktop';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
