import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Mismo origen en desarrollo: la cookie del refresh token viaja sin CORS
    // /tenants pertenece al frontend: no debe coincidir con el prefijo /tenant.
    proxy: { "^/auth(?:/|$)": api, "^/admin(?:/|$)": api, "^/tenant(?:/|$)": api, "^/public(?:/|$)": api },
  },
});
