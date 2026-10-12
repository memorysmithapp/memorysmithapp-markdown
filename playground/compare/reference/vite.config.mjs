// The Vite configuration of the reference page, run from inside the checkout of MemorySmith.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const notebooks = process.env.MARKDOWN_NOTEBOOKS;

export default defineConfig({
  root: here,
  plugins: [
    react(),
    {
      // The pictures the notes keep, at the address the playground serves them at.
      name: 'notebook-assets',
      configureServer(server) {
        server.middlewares.use('/notes/', (request, response, next) => {
          const match = /^\/([^/]+)\/assets\/([^/?]+)/.exec(request.url ?? '');
          if (!match || !notebooks) return next();
          response.setHeader('content-type', 'image/png');
          response.end(readFileSync(join(notebooks, decodeURIComponent(match[1]), 'assets', decodeURIComponent(match[2]))));
        });
      },
    },
  ],
  resolve: {
    alias: [
      // The API is answered from the notebooks.
      { find: /^\.\/backend$/, replacement: join(here, 'backend.ts') },
      { find: /^\.\.\/api\/backend$/, replacement: join(here, 'backend.ts') },
      { find: '@real-backend', replacement: resolve(here, '..', 'src', 'shared', 'api', 'backend.ts') },
    ],
  },
  server: { fs: { allow: [resolve(here, '..', '..')] } },
});
