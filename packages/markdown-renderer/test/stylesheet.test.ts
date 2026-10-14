/**
 * The stylesheet styles the note and never the page: every selector is under
 * `.markdown`, and every value a host may set is a `--markdown-*` custom
 * property that `ARCHITECTURE.md` lists.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { html } from './render.js';

const PACKAGE = resolve(__dirname, '..');
// The default theme as `styles.css` assembles it: what every theme needs, then its look.
const entry = readFileSync(resolve(PACKAGE, 'styles.css'), 'utf8');
const css = [...entry.matchAll(/@import '\.\/([\w-]+\.css)';/g)]
  .map((match) => readFileSync(resolve(PACKAGE, match[1]!), 'utf8'))
  .join('\n');

/** The selectors of every style rule, with at-rules opened and keyframes skipped. */
function selectors(text: string): string[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: string[] = [];
  let depth = 0;
  let keyframes = -1;
  let buffer = '';
  for (const character of source) {
    if (character === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude.startsWith('@keyframes')) keyframes = depth;
      else if (!prelude.startsWith('@') && keyframes === -1) found.push(prelude);
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === keyframes) keyframes = -1;
      buffer = '';
    } else if (character === ';') {
      buffer = '';
    } else {
      buffer += character;
    }
  }
  // A selector list splits on the commas outside parentheses.
  return found.flatMap((list) => {
    const parts: string[] = [];
    let level = 0;
    let current = '';
    for (const character of list) {
      if (character === '(') level += 1;
      if (character === ')') level -= 1;
      if (character === ',' && level === 0) {
        parts.push(current.trim());
        current = '';
      } else current += character;
    }
    parts.push(current.trim());
    return parts.map((part) => part.replace(/\s+/g, ' '));
  });
}

describe('the stylesheet', () => {
  const all = selectors(css);

  it('is the structure and the default theme, in that order', () => {
    expect([...entry.matchAll(/@import '\.\/([\w-]+\.css)';/g)].map((match) => match[1])).toEqual([
      'structure.css',
      'theme-default.css',
    ]);
  });

  it('has rules to check, so an empty parse cannot pass', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('matches nothing outside .markdown', () => {
    const outside = all.filter((selector) => !/^\.markdown(?![\w-])/.test(selector));
    expect(outside).toEqual([]);
  });

  it('sets its values only on the root of a note, which carries the theme', () => {
    const declaring = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*--ms-[\w-]+\s*:/g) ?? [];
    for (const block of declaring) expect(block.trim()).toMatch(/^\.markdown\[data-theme(='dark')?\]/);
  });

  it('lists in ARCHITECTURE.md every custom property a host may set', () => {
    const architecture = readFileSync(resolve(PACKAGE, '..', '..', 'ARCHITECTURE.md'), 'utf8');
    const publicProperties = [...new Set(css.match(/--markdown-[\w-]+/g) ?? [])];
    expect(publicProperties.length).toBeGreaterThan(20);
    for (const property of publicProperties) expect(architecture, property).toContain(`\`${property}\``);
  });

  it("keeps a property key at its own height, so its icon sits on the key's first line", () => {
    const rule = /\.markdown \.metadata-property-key \{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
    expect(rule).toContain('align-self: start;');
  });

  it('gives a dark value to every colour it gives a light one', () => {
    const dark = css.slice(css.indexOf(".markdown[data-theme='dark'] {"));
    for (const property of ['bg', 'surface', 'border', 'text', 'text-soft', 'accent', 'pending', 'code-bg', 'callout-info', 'callout-quote']) {
      expect(dark, property).toContain(`--ms-${property}: var(--markdown-${property},`);
    }
  });
});

describe('the root of a note', () => {
  it('carries the theme the host draws in', () => {
    expect(html('x')).toMatch(/^<div class="markdown markdown-theme-default" data-theme="light">/);
    expect(html('x', { theme: 'dark' })).toMatch(/^<div class="markdown markdown-theme-default" data-theme="dark">/);
  });
});
