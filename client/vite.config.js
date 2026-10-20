import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { venueTemplateMetadata } from "./build/venueTemplateMetadata.js";

export default defineConfig(({ mode }) => ({
  define:
    mode === "e2e"
      ? {
          "import.meta.env.VITE_VENUE_API_URL": JSON.stringify("/api"),
          "import.meta.env.VITE_VENUE_GOOGLE_CLIENT_ID": JSON.stringify(""),
          "import.meta.env.VITE_PUBLIC_VENUE_DOMAIN": JSON.stringify(""),
          "import.meta.env.VITE_VENUE_PLATFORM_URL": JSON.stringify(""),
        }
      : {},
  plugins: [venueTemplateMetadata(), react(), tailwindcss()],
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
