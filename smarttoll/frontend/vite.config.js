import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api is forwarded to the Laravel dev server. Override with API_URL, e.g.
//   API_URL=http://localhost:8001 npm run dev   (when php artisan serve uses another port)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': process.env.API_URL || 'http://localhost:8000' } },
});
