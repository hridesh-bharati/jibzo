// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // auto-update SW
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],

      manifest: {
        name: "jibzo web app",
        short_name: "jibzo",
        description: "jibzo is the social networking web app",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icons/logo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/logo-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        runtimeCaching: [
          // CSS / JS caching
          {
            urlPattern: /\.(?:css|js)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
            },
          },
          // Google Fonts CSS
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts font files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
            },
          },
        ],
      },
    }),
  ],

  server: {
    host: true,
    port: 5173,
  },

  define: {
    global: "window", // for crypto-browserify etc
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

  base: "/", // safer for CSS & assets in PWA

  optimizeDeps: {
    include: ["react-pdf", "pdfjs-dist"],
  },
});
