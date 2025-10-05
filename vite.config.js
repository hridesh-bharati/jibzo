import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import history from "connect-history-api-fallback";

export default defineConfig({
  plugins: [
    react(),

    // ✅ Progressive Web App (PWA) configuration
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/*.png",
        "manifest.webmanifest"
      ],
      manifest: {
        name: "Jibzo Web App",
        short_name: "Jibzo",
        description: "Jibzo is a modern social networking web app.",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/", // ✅ Clean URL for APK launch
        scope: "/", // ✅ Root scope only
        id: "/", // ✅ Ensures PWA opens at root, prevents extra params
        categories: ["social", "communication"],
        lang: "en",
        dir: "ltr",
        icons: [
          {
            src: "/icons/logo-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      // ✅ Service Worker caching configuration
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Firebase Storage images/files
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-storage-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          {
            // Firestore / Firebase Realtime DB
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "firebase-data-cache",
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-cache",
            },
          },
          {
            // Images and static assets
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],

  // ✅ Dev server settings
  server: {
    host: true,
    port: 5173,

    // Support for client-side routing during dev (SPA)
    middlewareMode: false,
    setupMiddlewares(middlewares) {
      middlewares.push(history());
      return middlewares;
    },
  },

  // ✅ Build optimization
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          firebase: ["firebase/app", "firebase/auth", "firebase/database"],
          ui: ["react-bootstrap", "bootstrap"],
        },
      },
    },
  },

  base: "./",
  publicDir: "public",
});
