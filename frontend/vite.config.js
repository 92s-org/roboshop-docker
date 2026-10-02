import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the UI on :5173 and sends /api calls to the
// running docker compose stack (frontend nginx on :80 by default)
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': process.env.API_TARGET || 'http://localhost:80'
        }
    }
});
