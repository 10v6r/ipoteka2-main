/**
 * Отдельная конфигурация для сборки виджета в формате IIFE (без CORS проблем)
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Заменяем process на объект для браузера
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process': JSON.stringify({ 
      env: { 
        NODE_ENV: 'production' 
      } 
    }),
    'global': 'window',
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'widget-entry.tsx'),
      name: 'MortgageCalculatorWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1000,
  },
});

