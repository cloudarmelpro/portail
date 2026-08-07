import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    // Playwright a son propre lanceur : l'inclure ici ferait tourner les
    // parcours de bout en bout à chaque exécution unitaire.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
