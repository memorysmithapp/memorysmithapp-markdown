#!/usr/bin/env node
// Whether the renderer draws what MemorySmith's reading page draws: every note of the two
// demonstration notebooks, in light and dark, at a desktop and a phone width, compared by image.
//
// The reference is MemorySmith's own reading surface at the commit the renderer was extracted
// from — `WritableContent` and its stylesheet, mounted by `reference/main.tsx` inside a checkout of
// that commit, over the same notebooks with the API answered from them — and never a screenshot of
// the production site, whose chrome, data and fonts would differ for reasons unrelated to
// rendering. The other side is the playground, `?bare=1`, which draws the same note with the
// package and its stylesheet in a column of the same measure.
//
// Run from the root: `pnpm --filter playground compare`. It needs a checkout of MemorySmith at the
// pinned commit with its frontend's dependencies installed: `MEMORYSMITH_CHECKOUT` names one, or
// the script clones and installs it into `playground/compare/.memorysmith` the first time. It
// writes every pair and its difference under `playground/compare/out/`, prints a table, and exits
// non-zero when a pair differs past the tolerance and is not a difference listed below.

import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND = resolve(HERE, '..');
const ROOT = resolve(PLAYGROUND, '..');
const NOTEBOOKS = join(ROOT, 'notebooks');
const OUT = join(HERE, 'out');

/** The commit MemorySmith's reading page is compared at: the one the renderer was extracted from. */
export const COMMIT = '4b67c7e7160566df498b375a62f33942cff10f5e';
const REPOSITORY = 'https://github.com/memorysmithapp/memorysmithapp.git';

/** The share of pixels that may differ before a pair is a difference: antialiasing, not drawing. */
export const TOLERANCE = 0.002;

/** The widths compared: a desktop, and a phone. */
const WIDTHS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const THEMES = ['light', 'dark'];

/**
 * Pairs that differ on purpose, by `<slug>/<path>`, each with the reason a person reads in the
 * report. A difference listed here is reported and does not fail the run; one that is not fails it.
 */
export const DELIBERATE = {
  'enologia/01 Castas/Índice de Polifenóis Totais.md':
    'Its footnote is referenced above an embed and defined below it: MemorySmith draws the reference as text and no notes, the renderer draws the footnote (RN-RENDER-013).',
  'continuity-engineering/01 Objectives/Failure domain.md':
    'A callout title holding inline code: MemorySmith lays each run of the title out as a column of its own, the renderer draws the title as one sentence beside its icon (#42). Its picture is written `![…](../assets/…)`: MemorySmith asks the path of the page for it, the renderer draws the kept file it names as its embed draws it, a block with its margins (#104).',
  'continuity-engineering/02 Runbooks/Failing over the payments database.md':
    'It embeds Failure domain, whose callout title holds inline code: MemorySmith lays each run of the title out as a column of its own, the renderer draws the title as one sentence beside its icon (#42), and whose picture is written `![…](../assets/…)`, which the renderer draws as the kept file it names (#104).',
  'continuity-engineering/03 Reviews/Exercise 2026-03 · Region loss.md':
    'A callout title holding bold text: MemorySmith lays each run of the title out as a column of its own, the renderer draws the title as one sentence beside its icon (#42).',
  'enologia/02 Protocolos/Vinificação em tinto.md':
    'Two callout titles holding bold text, which MemorySmith lays out as columns and the renderer as one sentence (#42), and a callout of type `atenção`, which MemorySmith draws as a quotation beginning with its marker and the renderer as a callout titled Atenção (#43); one of those titles holds a link, which MemorySmith draws in the colour and weight of the title and the renderer underlines (#45).',
  'code-samples/02 Loaded on demand/C Sharp.md':
    'Its fence names a language outside the fifteen MemorySmith highlights at this commit: MemorySmith draws it as plain code, the renderer fetches its grammar and highlights it (#84).',
  'code-samples/02 Loaded on demand/Dockerfile.md':
    'Its fence names a language outside the fifteen MemorySmith highlights at this commit: MemorySmith draws it as plain code, the renderer fetches its grammar and highlights it (#84).',
  'code-samples/02 Loaded on demand/Go.md':
    'Its fence names a language outside the fifteen MemorySmith highlights at this commit: MemorySmith draws it as plain code, the renderer fetches its grammar and highlights it (#84).',
  'code-samples/02 Loaded on demand/Rust.md':
    'Its fence names a language outside the fifteen MemorySmith highlights at this commit: MemorySmith draws it as plain code, the renderer fetches its grammar and highlights it (#84).',
  'enologia/01 Castas/Índice.md':
    'A callout title holding inline code: MemorySmith lays each run of the title out as a column of its own, the renderer draws the title as one sentence beside its icon (#42). Its picture is written `![…](../assets/…)`: MemorySmith asks the path of the page for it, the renderer draws the kept file it names as its embed draws it, a block with its margins (#104).',
  'enologia/03 Safras/Índice.md':
    'Its picture is written `![…](../assets/curva-2026.png)`: MemorySmith asks the path of the page for it, the renderer draws the kept file it names as its embed draws it, a block with its margins, which moves the text under it (#104).',
};

const REFERENCE_PORT = 5301;
const RENDERER_PORT = 5302;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
}

/** A checkout of MemorySmith at the pinned commit, with its frontend installed. */
function checkout() {
  const dir = process.env.MEMORYSMITH_CHECKOUT ? resolve(process.env.MEMORYSMITH_CHECKOUT) : join(HERE, '.memorysmith');
  if (!existsSync(join(dir, '.git'))) {
    run('git', ['clone', '--quiet', REPOSITORY, dir]);
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  if (head !== COMMIT) run('git', ['checkout', '--quiet', COMMIT], { cwd: dir });
  if (!existsSync(join(dir, 'memorysmith-frontend', 'node_modules'))) {
    run('corepack', ['pnpm', 'install', '--frozen-lockfile', '--filter', 'memorysmith-frontend...'], {
      cwd: dir,
      env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
    });
  }
  return dir;
}

/** The notes of the notebooks, and the files they keep, as the reference page reads them. */
function readNotebooks() {
  const files = [];
  const kept = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const [slug, ...rest] = relative(NOTEBOOKS, full).split(/[\\/]/);
      if (statSync(full).isDirectory()) walk(full);
      else if (rest[0] === 'assets') kept[slug] = [...(kept[slug] ?? []), entry.normalize('NFC')];
      else if (entry.endsWith('.md') && !['GUIDANCE.md', 'STRUCTURE.md', 'TEMPLATE.md'].includes(entry)) {
        files.push({ slug, path: rest.join('/'), markdown: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(NOTEBOOKS);
  return { files: files.sort((a, b) => `${a.slug}/${a.path}`.localeCompare(`${b.slug}/${b.path}`)), kept };
}

function serve(command, args, options, port) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  let log = '';
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));
  return {
    child,
    async ready() {
      for (let i = 0; i < 120; i++) {
        try {
          const response = await fetch(`http://localhost:${port}/`);
          if (response.ok) return;
        } catch {
          // not yet
        }
        await new Promise((done) => setTimeout(done, 500));
      }
      throw new Error(`the server on ${port} did not start:\n${log}`);
    },
  };
}

/** The address of a note, the same on both pages, so a relative picture reaches the same file. */
const addressOf = (file) => `/notes/${[file.slug, ...file.path.replace(/\.md$/, '').split('/')].map(encodeURIComponent).join('/')}`;

async function shoot(page, url, selector) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(selector);
  await page.evaluate(() => document.fonts.ready);
  // Whatever the page still waits for: a diagram, an embed, a picture.
  await page.waitForFunction(
    () =>
      !document.querySelector('.mermaid-loading, .skeleton-region') &&
      [...document.images].every((image) => image.complete),
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(300);
  return PNG.sync.read(await page.locator(selector).screenshot({ animations: 'disabled' }));
}

/** The share of pixels that differ, over the larger of the two images, and the image of the difference. */
function difference(a, b) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (image) => {
    const padded = new PNG({ width, height });
    padded.data.fill(255);
    PNG.bitblt(image, padded, 0, 0, image.width, image.height, 0, 0);
    return padded;
  };
  const diff = new PNG({ width, height });
  const count = pixelmatch(pad(a).data, pad(b).data, diff.data, width, height, { threshold: 0.1 });
  return { ratio: count / (width * height), diff, sizes: `${a.width}×${a.height} / ${b.width}×${b.height}` };
}

async function main() {
  const dir = checkout();
  const harness = join(dir, 'memorysmith-frontend', 'compare-harness');
  rmSync(harness, { recursive: true, force: true });
  cpSync(join(HERE, 'reference'), harness, { recursive: true });
  const notebooks = readNotebooks();
  writeFileSync(join(harness, 'notebooks.json'), JSON.stringify(notebooks));

  run('pnpm', ['--filter', './packages/**', 'build'], { cwd: ROOT });

  const reference = serve(
    join(dir, 'memorysmith-frontend', 'node_modules', '.bin', 'vite'),
    ['--config', 'compare-harness/vite.config.mjs', '--port', String(REFERENCE_PORT), '--strictPort'],
    { cwd: join(dir, 'memorysmith-frontend'), env: { ...process.env, MARKDOWN_NOTEBOOKS: NOTEBOOKS } },
    REFERENCE_PORT,
  );
  const renderer = serve(
    join(PLAYGROUND, 'node_modules', '.bin', 'vite'),
    ['--port', String(RENDERER_PORT), '--strictPort'],
    { cwd: PLAYGROUND },
    RENDERER_PORT,
  );
  const only = process.argv[2];
  const results = [];
  let browser;
  try {
    await Promise.all([reference.ready(), renderer.ready()]);
    browser = await chromium.launch();
    rmSync(OUT, { recursive: true, force: true });
    for (const file of notebooks.files) {
      const key = `${file.slug}/${file.path}`;
      if (only && !key.includes(only)) continue;
      for (const [widthName, viewport] of Object.entries(WIDTHS)) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        for (const theme of THEMES) {
          const address = addressOf(file);
          const a = await shoot(page, `http://localhost:${REFERENCE_PORT}${address}?theme=${theme}`, 'article.content-pane');
          const b = await shoot(page, `http://localhost:${RENDERER_PORT}${address}?theme=${theme}&bare=1`, 'article.pane');
          const { ratio, diff, sizes } = difference(a, b);
          const base = join(OUT, file.slug, `${file.path.replace(/\.md$/, '')} · ${theme} · ${widthName}`);
          mkdirSync(dirname(base), { recursive: true });
          writeFileSync(`${base} · reference.png`, PNG.sync.write(a));
          writeFileSync(`${base} · renderer.png`, PNG.sync.write(b));
          writeFileSync(`${base} · diff.png`, PNG.sync.write(diff));
          const deliberate = DELIBERATE[key];
          results.push({ key, theme, width: widthName, ratio, sizes, matches: ratio <= TOLERANCE, deliberate });
          console.log(`${ratio <= TOLERANCE ? 'same' : deliberate ? 'deliberate' : 'DIFFERS'}  ${(ratio * 100).toFixed(3).padStart(7)}%  ${sizes.padEnd(21)}  ${theme.padEnd(5)}  ${widthName.padEnd(7)}  ${key}`);
        }
        await page.close();
      }
    }
  } finally {
    await browser?.close();
    reference.child.kill();
    renderer.child.kill();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ commit: COMMIT, tolerance: TOLERANCE, results }, null, 2));
  const failing = results.filter((result) => !result.matches && !result.deliberate);
  console.log(`\n${results.length} pairs, ${results.filter((r) => r.matches).length} within ${TOLERANCE * 100}%, ${failing.length} differing unexplained.`);
  process.exitCode = failing.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
