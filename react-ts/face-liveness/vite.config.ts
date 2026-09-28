import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const faceServiceTarget = process.env.VITE_FACE_SERVICE_TARGET || 'http://192.168.0.70:41101'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/face-api': {
        target: faceServiceTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/face-api/, ''),
      },
    },
  },
})
