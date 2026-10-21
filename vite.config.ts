import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [vue(), tailwindcss()], base: process.env.VITE_BASE_PATH || '/', build: { sourcemap: false }, server: { port: 5173, strictPort: true } })
