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
    outDir: "dist_electron",
    emptyOutDir: true,
    minify: "esbuild", 
    target: "chrome100",
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "desktop.html"),
      },
      output: {
        format: 'iife', 
        inlineDynamicImports: true, 
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
