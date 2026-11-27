import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// При разработка /api се препраща към услугата; в контейнера това прави nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
