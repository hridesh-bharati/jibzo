// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  define: {
    global: "window",
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  base: "./", // relative paths for deploy
  optimizeDeps: {
    include: ["react-pdf", "pdfjs-dist"],
  },
});
