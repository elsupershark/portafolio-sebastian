import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /* En desarrollo, las llamadas del chat se reenvian al servidor Python */
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});