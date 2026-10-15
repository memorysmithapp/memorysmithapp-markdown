import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const NOTEBOOKS = resolve(__dirname, '..', 'notebooks');

/** The files the notebooks keep, by name: `notebooks/<slug>/assets/<name>`. */
function keptFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const slug of readdirSync(NOTEBOOKS)) {
    const assets = join(NOTEBOOKS, slug, 'assets');
    if (!existsSync(assets)) continue;
    for (const name of readdirSync(assets)) files.set(name, join(assets, name));
  }
  return files;
}

/**
 * A note writes its pictures as `../assets/<name>`, relative to where it sits
 * in its notebook, and the page addresses a note as `/notes/<slug>/<path>`, so
 * a picture reaches `/notes/<slug>/assets/<name>`: this serves the notebooks'
 * kept files there.
 */
function notebookAssets(): Plugin {
  return {
    name: 'notebook-assets',
    configureServer(server) {
      server.middlewares.use('/notes/', (request, response, next) => {
        const match = /^\/[^/]+\/assets\/([^/?]+)/.exec(request.url ?? '');
        const file = match?.[1] ? keptFiles().get(decodeURIComponent(match[1])) : undefined;
        if (!file) return next();
        response.setHeader('content-type', file.endsWith('.png') ? 'image/png' : 'application/octet-stream');
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const slug of readdirSync(NOTEBOOKS)) {
        const assets = join(NOTEBOOKS, slug, 'assets');
        if (!existsSync(assets)) continue;
        for (const name of readdirSync(assets)) {
          this.emitFile({ type: 'asset', fileName: `notes/${slug}/assets/${name}`, source: readFileSync(join(assets, name)) });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), notebookAssets()],
  // The samples of `fixtures/files/` of a type the bundler does not know as an asset (#77).
  assetsInclude: ['**/*.docx', '**/*.xlsx', '**/*.pptx', '**/*.weba', '**/*.mov'],
});
