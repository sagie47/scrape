import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:3000',
      '/status': 'http://localhost:3000',
      '/outputs': 'http://localhost:3000',
      '/screenshot': 'http://localhost:3000',
      '/analyze-single': 'http://localhost:3000',
      '/stop': 'http://localhost:3000',
      '/jobs': 'http://localhost:3000',
      '/scrape-leads': 'http://localhost:3000',
      '/analyze-leads': 'http://localhost:3000',
      '/export-leads': 'http://localhost:3000',
      '/leads': 'http://localhost:3000',
      '/generate-outreach': 'http://localhost:3000',
    },
  },
})
