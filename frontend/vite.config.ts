import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - bibliotecas grandes separadas
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-chime': ['amazon-chime-sdk-js'],
          'vendor-ui': ['lucide-react'],
        }
      }
    },
    // Aumentar limite de warning para 600KB (ainda queremos otimizar)
    chunkSizeWarningLimit: 600,
  }
});
