import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'menu.html'),
        cart: resolve(__dirname, 'cart.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        'order-confirmation': resolve(__dirname, 'order-confirmation.html'),
        'admin/index': resolve(__dirname, 'admin/index.html'),
        'tools/qr-generator': resolve(__dirname, 'tools/qr-generator.html')
      }
    }
  },
  publicDir: false, // we handle assets manually
  server: {
    port: 3000
  }
});