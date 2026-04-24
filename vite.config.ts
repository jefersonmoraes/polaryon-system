import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './', // Forçamos './' para garantir compatibilidade total com Electron/File Protocol
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist_electron",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        desktop: path.resolve(__dirname, 'desktop.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'ui-icons';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion')) return 'animations';
            if (id.includes('date-fns')) return 'date-utils';
            if (id.includes('@radix-ui')) return 'ui-core';
            return 'vendor';
          }
        }
      }
    }
  }
}));
