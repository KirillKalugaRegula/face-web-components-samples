import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const faceApiProxy = {
  "/face-api": {
    target: "http://192.168.0.70:41101",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/face-api/, ""),
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: faceApiProxy },
  preview: { proxy: faceApiProxy },
});
