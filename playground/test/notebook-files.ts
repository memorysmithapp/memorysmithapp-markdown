// The demonstration notebooks read from disk, for the tests: the same files the page reads with
// `import.meta.glob`, keyed by their path under `notebooks/`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { buildNotebooks, type Notebook } from '../src/notebooks.js';

export const NOTEBOOKS_DIR = resolve(__dirname, '..', '..', 'notebooks');

export function readNotebooks(): Notebook[] {
  const files: Record<string, string> = {};
  const kept: Record<string, string[]> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const key = relative(NOTEBOOKS_DIR, full).split('\\').join('/');
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.md')) files[key] = readFileSync(full, 'utf8');
      else if (key.split('/')[1] === 'assets') {
        const slug = key.split('/')[0] ?? '';
        kept[slug] = [...(kept[slug] ?? []), entry.normalize('NFC')];
      }
    }
  };
  walk(NOTEBOOKS_DIR);
  return buildNotebooks(files, kept);
}
