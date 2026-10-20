import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { venueTemplateMetadata } from "./build/venueTemplateMetadata.js";

export default defineConfig(({ mode }) => ({
  define:
    mode === "e2e"
      ? {
          "import.meta.env.VITE_VENUE_API_URL": JSON.stringify("/api"),
          "import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID": JSON.stringify(
            "disposable-browser-google-client",
          ),
          "import.meta.env.VITE_PUBLIC_VENUE_DOMAIN": JSON.stringify(""),
          "import.meta.env.VITE_VENUE_PLATFORM_URL": JSON.stringify(""),
        }
      : {},
  plugins: [
    venueTemplateMetadata(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.js",
      // Owner routes add the manifest and register explicitly. Public venue
      // pages, including those on customer subdomains, must not opt in.
      manifest: false,
      injectRegister: false,
      registerType: "prompt",
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: [
          "assets/*.{js,css,woff,woff2,png,jpg,jpeg,webp,avif,svg}",
          "pwa-icons/*.png",
          "favicon.svg",
          "theme-init.js",
          "offline.html",
          "offline.css",
          "offline.js",
        ],
        // App HTML and anything outside this explicit static list stay live.
        globIgnores: ["**/index.html", "**/*.map", "**/sw.js"],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
}));
