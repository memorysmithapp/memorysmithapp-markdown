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
    const architecture = readFileSync(resolve(PACKAGE, '..', '..', 'docs', 'ARCHITECTURE.md'), 'utf8');
    const publicProperties = [...new Set(css.match(/--markdown-[\w-]+/g) ?? [])];
    expect(publicProperties.length).toBeGreaterThan(20);
    for (const property of publicProperties) expect(architecture, property).toContain(`\`${property}\``);
  });

  it("keeps a property key at its own height, so its icon sits on the key's first line", () => {
    const rule = /\.markdown \.metadata-property-key \{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
    expect(rule).toContain('align-self: start;');
  });

  it('keeps an empty block of code a line high, so its Copy button fits inside it (#38)', () => {
    const rule = /\.markdown \.code-block > pre > code:empty::before \{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
    expect(rule).toContain("content: '\\200b';");
  });

  it('cuts away the separator of a toolbar group that starts a row, so every row starts alike (#80)', () => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const group = [...source.matchAll(/\.markdown \.edit-toolbar-group \{([^}]*)\}/g)].map((match) => match[1]).join('');
    expect(group).toContain('margin-inline-start: -1px;');
    expect(group).toContain('border-inline-start: 1px solid');
    const tools = [...source.matchAll(/\.markdown \.edit-toolbar-tools \{([^}]*)\}/g)].map((match) => match[1]).join('');
    expect(tools).toContain('clip-path: inset(-0.5rem -0.5rem -0.5rem 0);');
    expect(source).not.toContain('.edit-toolbar-group + .edit-toolbar-group');
  });

  it('positions the root of a note, so nothing out of the flow hangs from the page, whatever the theme (#93)', () => {
    const structure = readFileSync(resolve(PACKAGE, 'structure.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /(?:^|\})\s*\.markdown \{([^}]*)\}/.exec(structure)?.[1] ?? '';
    expect(rule).toContain('position: relative;');
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/(?:^|\})\s*\.markdown \{[^}]*position: (?!relative)/);
  });

  it("hides a responsive button's word below --markdown-button-words-from, in a container that is never the editor (#96)", () => {
    const structure = readFileSync(resolve(PACKAGE, 'structure.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const word = /\.markdown \[data-buttons='responsive'\] \.note-button-word \{([^}]*)\}/.exec(structure)?.[1] ?? '';
    expect(word).toContain('overflow: hidden;');
    expect(word).toContain('max-width: calc(clamp(0px, (100cqi - var(--markdown-button-words-from, 560px)) * 1000, 1px) * 10000);');
    expect(structure).toMatch(/\.markdown\.has-responsive-buttons,\s*\.markdown \.has-responsive-buttons \{\s*container-type: inline-size;/);
    expect(css).not.toMatch(/markdown-editing[^{]*\{[^}]*container-type/);
  });

  it('keeps the corner of a note that is read in view while it scrolls, and in the bar in edit mode (#97)', () => {
    const structure = readFileSync(resolve(PACKAGE, 'structure.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const corner = /(?:^|\})\s*\.markdown \.note-corner \{([^}]*)\}/.exec(structure)?.[1] ?? '';
    expect(corner).toContain('float: right;');
    expect(corner).toContain('position: sticky;');
    expect(corner).toContain('top: 0;');
    const inBar = /\.markdown \.edit-corner \.note-corner \{([^}]*)\}/.exec(structure)?.[1] ?? '';
    expect(inBar).toContain('position: relative;');
  });

  it('keeps an empty table cell wide enough to click, whatever the theme (#68)', () => {
    const structure = readFileSync(resolve(PACKAGE, 'structure.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.markdown \.edit-cell \{([^}]*)\}/.exec(structure)?.[1] ?? '';
    expect(rule).toContain('display: block;');
    expect(rule).toMatch(/min-width: [1-9]/);
    expect(rule).toMatch(/min-height: [1-9]/);
  });

  it('keeps the words of a callout title one item of its row, so they wrap as a sentence (#42)', () => {
    const rule = /\.markdown \.callout-title-text \{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
    expect(rule).toContain('flex: 1 1 auto;');
  });

  it('underlines a link in a callout title, whose colour may be the title\'s own (#45)', () => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.markdown \.callout-title :is\(a, \.wikilink\):not\(\.wikilink-pending, \[data-footnote-ref\]\) \{([^}]*)\}/.exec(source)?.[1] ?? '';
    expect(rule).toContain('text-decoration: var(--ms-callout-title-link-decoration);');
    expect(source).toContain('--ms-callout-title-link-decoration: var(--markdown-callout-title-link-decoration, underline 1px);');
    // The blue family's title is the accent, which is why the colour alone cannot mark the link.
    expect(source).toContain('--ms-callout-info: var(--markdown-callout-info, 15, 86, 215);');
    expect(source).toContain('--ms-accent: var(--markdown-accent, #0f56d7);');
  });

  it("styles a parameter by its attribute, which a Prism token never carries (#140)", () => {
    const parameter = selectors(css).filter((selector) => /\.parameter\b/.test(selector));
    expect(parameter.length).toBeGreaterThan(0);
    for (const selector of parameter) expect(selector).toMatch(/\.parameter\[data-parameter\]/);
    // What the page draws for a reference carries it, and what Prism draws for a shell flag does not.
    expect(html('Ask {{client}}.\n')).toContain('class="parameter" data-parameter="client"');
    const flag = html('```bash\nset -euo pipefail\n```\n');
    expect(flag).toContain('token parameter');
    expect(flag).not.toContain('data-parameter');
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
