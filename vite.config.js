import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/TAFL-Project/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});

