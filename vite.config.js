import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true also prints a LAN address, so a phone on the same network can
  // open the schedule link or scan the QR code.
  server: { port: 5173, open: true, host: true },
})
