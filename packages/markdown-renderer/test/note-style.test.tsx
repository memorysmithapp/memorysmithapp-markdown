// How a note is set, as its notebook's style says (#164): the face and the alignment of its
// headings, text and tables, which the host hands the renderer as `noteStyle`. A note with no
// style is drawn exactly as before; a value the style cannot take is ignored.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../src/edit/index.js';
import { html, mount, type Mounted } from './render.js';

const NOTE = '# Ata\n\nO condomínio deliberou, por maioria.\n\n| Item | Valor |\n|---|:---:|\n| Cadeiras | 480 |\n';
const root = (drawn: string): string => /^<div class="markdown[^"]*"[^>]*>/.exec(drawn)?.[0] ?? '';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('a note with no style', () => {
  it('carries no style and no language on its root', () => {
    const drawn = root(html(NOTE));
    expect(drawn).not.toContain('--ms-');
    expect(drawn).not.toContain('lang=');
  });
});

describe("a note drawn in its notebook's style", () => {
  it('sets the face and each alignment on its root', () => {
    const drawn = root(html(NOTE, { noteStyle: { font: 'serif', headings: 'center', text: 'right', tables: 'left' } }));
    expect(drawn).toContain('--ms-face:var(--ms-font-serif)');
    expect(drawn).toContain('--ms-face-heading:var(--ms-font-serif)');
    expect(drawn).toContain('--ms-align-headings:center');
    expect(drawn).toContain('--ms-align-text:right');
    expect(drawn).toContain('--ms-align-tables:left');
    expect(drawn).not.toContain('lang=');
  });

  it('hyphenates justified text in the language the host gives', () => {
    expect(root(html(NOTE, { noteStyle: { text: 'justify' } }))).toMatch(/lang="en-US"/);
    const drawn = root(html(NOTE, { noteStyle: { tables: 'justify' }, strings: { locale: 'pt-BR' } }));
    expect(drawn).toContain('lang="pt-BR"');
    expect(drawn).toContain('--ms-hyphens-tables:auto');
  });

  it('keeps the alignment a column declares, which its cells carry', () => {
    expect(html(NOTE, { noteStyle: { tables: 'justify' } })).toContain('<td style="text-align:center">480</td>');
  });

  it('ignores a key or a value a style cannot take', () => {
    const style = { font: 'mono', text: 'middle', colour: 'red' } as unknown as { font: 'sans' };
    expect(root(html(NOTE, { noteStyle: style }))).not.toContain('--ms-');
  });

  it('is drawn in edit mode too', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} noteStyle={{ font: 'serif', text: 'justify' }} />);
    await act(async () => undefined);
    const editing = mounted.container.querySelector<HTMLElement>('.markdown-editing')!;
    expect(editing.style.getPropertyValue('--ms-face')).toBe('var(--ms-font-serif)');
    expect(editing.getAttribute('lang')).toBe('en-US');
  });
});

describe('the stylesheet', () => {
  const read = (file: string): string => readFileSync(resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('reads each alignment with the start of the line as its fallback, in the structure every theme imports', () => {
    const structure = read('structure.css');
    expect(/\.markdown :is\(p, li\) \{([^}]*)\}/.exec(structure)?.[1]).toContain('text-align: var(--ms-align-text, start);');
    expect(/\.markdown :is\(h1, h2, h3, h4, h5, h6\) \{([^}]*)\}/.exec(structure)?.[1]).toContain('text-align: var(--ms-align-headings, start);');
    expect(structure).toContain('text-align: var(--ms-align-tables, start);');
  });

  it('draws the note, its headings and its title in the face a style chooses, else its own', () => {
    const theme = read('theme-default.css');
    expect(theme).toContain('font-family: var(--ms-face, var(--ms-font-sans));');
    expect(theme).toContain('font-family: var(--ms-face-heading, var(--ms-font-heading));');
    expect(theme).toContain('font-family: var(--ms-face-heading, var(--ms-title-font));');
    expect(theme).toContain("--ms-font-serif: var(--markdown-font-serif, Georgia, 'Times New Roman', serif);");
  });
});
