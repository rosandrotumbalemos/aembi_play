import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Player Aembi Play — PWA que roda em tela cheia no dispositivo ligado à TV.
// Service Worker cuida do cache dos vídeos (via Cache API) para reprodução
// offline, conforme protocolo descrito em docs/PROJECT_BRIEF.md (seção 5).
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Aembi Play — Player",
        short_name: "Aembi Player",
        description: "Player de sinalização digital Aembi Play",
        theme_color: "#000000",
        background_color: "#000000",
        display: "fullscreen",
        orientation: "any",
        icons: [
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // Os vídeos são baixados e versionados manualmente pelo player
        // (ver src/manifest.ts) — o Workbox cuida só do app shell.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: {
    port: 4000,
    // Escuta em todas as interfaces — o player normalmente é testado a
    // partir de outro dispositivo na rede local (TV box, celular), não só
    // localhost.
    host: true,
  },
});
