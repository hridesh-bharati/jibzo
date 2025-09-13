// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  define: {
    global: "window",
  },
  build: {
    outDir: 'dist',       // default, just to be explicit
    assetsDir: 'assets',  // default folder for JS/CSS/images
  },
  base: './',             // ✅ important for relative asset paths on Vercel
  optimizeDeps: {
    include: ["react-pdf", "pdfjs-dist"],
  },
})





