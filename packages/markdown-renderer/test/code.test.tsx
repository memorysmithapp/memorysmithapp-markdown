/**
 * Code as the reading page draws it: the three branches of a fence in their
 * order, the tokens as elements, the frame and its Copy button, and a diagram
 * that fails without taking anything else down.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draw, html } from './render.js';

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async (_code: string, _options?: unknown): Promise<unknown> => ({ diagramType: 'flowchart' })),
  render: vi.fn(async (_id: string, _code: string) => ({ svg: '<svg data-testid="diagram"></svg>' })),
}));
vi.mock('mermaid', () => ({ default: mermaid }));

beforeEach(() => {
  mermaid.initialize.mockClear();
  mermaid.parse.mockClear();
  mermaid.render.mockClear();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

describe('an empty fence', () => {
  it('is an empty block of code, with a language or without one (#38)', () => {
    for (const [fence, open] of [
      ['```bash\n```', '<code class="language-bash">'],
      ['```promql\n```', '<code class="language-promql">'],
      ['```\n```', '<code>'],
    ] as const) {
      const out = html(fence);
      expect(out, fence).toContain(`<div class="code-block"><pre>${open}</code></pre>`);
      expect(out, fence).not.toContain('undefined');
    }
  });

  it('copies nothing, since nothing was typed', async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const note = await draw('```bash\n```');
    await act(async () => note.container.querySelector<HTMLButtonElement>('.code-copy')?.click());
    expect(writeText).toHaveBeenCalledWith('');
    note.unmount();
  });
});

describe('a fence that names a language the highlighter carries', () => {
  it('is drawn in tokens', () => {
    const out = html('```sql\nselect 1 from notes;\n```');
    expect(out).toContain('class="language-sql"');
    expect(out).toContain('<span class="token keyword">select</span>');
  });

  it('draws a payload inside it as text, never as markup', async () => {
    const note = await draw('```html\n<img src=x onerror="window.__stolen = 1">\n```');
    const code = note.container.querySelector('code.language-html');
    expect(code).not.toBeNull();
    expect(code?.querySelector('img')).toBeNull();
    expect(note.container.querySelector('img')).toBeNull();
    expect(code?.textContent).toBe('<img src=x onerror="window.__stolen = 1">');
    expect((window as { __stolen?: number }).__stolen).toBeUndefined();
    note.unmount();
  });

  it('keeps the bytes, only splitting them into spans', async () => {
    const source = '{\n    "a":   1,\n\t"b": [ 2 ]  \n}';
    const note = await draw('```json\n' + source + '\n```');
    expect(note.container.querySelector('code.language-json')?.textContent).toBe(source);
    note.unmount();
  });
});

describe('every other fence', () => {
  it('is plain code for a language nobody registered', () => {
    const out = html('```brainfuck\n+++[->+++<]\n```');
    expect(out).toContain('+++[-&gt;+++&lt;]');
    expect(out).not.toContain('class="token');
  });

  it('is plain code with no info string', () => {
    expect(html('```\nplain\n```')).toContain('<pre><code>plain\n</code></pre>');
  });

  it('never highlights a code span', () => {
    expect(html('Escreva `select 1` no console.')).toContain('<code>select 1</code>');
  });
});

describe('the frame and its Copy button', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frames a block, highlighted or not, with the button inside the frame', () => {
    for (const fence of ['```ts\nconst a = 1;\n```', '```\nplain\n```']) {
      expect(html(fence)).toMatch(/<div class="code-block"><pre>[\s\S]*<\/pre><button[^>]*code-copy/);
    }
    expect(html('```\nx\n```', { strings: { copy: 'Copiar' } })).toContain('aria-label="Copiar"');
  });

  it('leaves inline code with no frame and nothing to copy', () => {
    const out = html('Rode `pnpm test` antes.');
    expect(out).not.toContain('code-block');
  });

  it('copies the fence content byte for byte', async () => {
    const written: string[] = [];
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: async (text: string) => void written.push(text) },
    });
    const content = 'const tab =\t"x";  \n\n  if (a < b && c > d) { return `<b>`; }\n// fim ';
    for (const info of ['ts', '', 'unknown-language']) {
      const note = await draw('```' + info + '\n' + content + '\n```\n\nDepois.');
      const button = note.container.querySelector<HTMLButtonElement>('button.code-copy');
      await act(async () => {
        button?.click();
      });
      expect(written.at(-1)).toBe(content);
      expect(button?.getAttribute('title')).toBe('Copied');
      note.unmount();
    }
  });
});

describe('a mermaid diagram', () => {
  it('is drawn by Mermaid, unframed, with nothing to copy', async () => {
    const note = await draw('```mermaid\ngraph TD\n  A --> B\n```', { theme: 'dark' });
    await settle();
    expect(note.container.querySelector('.mermaid-diagram svg')).not.toBeNull();
    expect(note.container.querySelector('.code-block')).toBeNull();
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    expect(mermaid.render.mock.calls[0]?.[1]).toBe('graph TD\n  A --> B');
    note.unmount();
  });

  it('takes the neutral theme in a light host, which is the default', async () => {
    const note = await draw('```mermaid\ngraph TD\n  A --> B\n```');
    await settle();
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'neutral' }));
    note.unmount();
  });

  it('shows its source when Mermaid cannot read it, and nothing outside its block changes', async () => {
    mermaid.parse.mockResolvedValueOnce(false);
    const markdown = 'Antes do diagrama.\n\n```mermaid\nnot a diagram ((\n```\n\nDepois do diagrama.';
    const note = await draw(markdown);
    await settle();
    const without = await draw('Antes do diagrama.\n\nDepois do diagrama.');
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(note.container.querySelector('.mermaid-diagram')).toBeNull();
    expect(note.container.querySelector('pre code')?.textContent).toBe('not a diagram ((');
    const paragraphs = (root: HTMLElement) => [...root.querySelectorAll('p')].map((p) => p.outerHTML);
    expect(paragraphs(note.container)).toEqual(paragraphs(without.container));
    note.unmount();
    without.unmount();
  });

  it('shows its source when drawing throws, and removes what Mermaid left behind', async () => {
    mermaid.render.mockImplementationOnce(async (id: string) => {
      const scratch = document.createElement('div');
      scratch.id = `d${id}`;
      document.body.appendChild(scratch);
      throw new Error('boom');
    });
    const note = await draw('```mermaid\ngraph TD\n  A --> B\n```');
    await settle();
    expect(note.container.querySelector('pre code')?.textContent).toBe('graph TD\n  A --> B');
    expect(document.querySelector('[id^="dmmd-"]')).toBeNull();
    note.unmount();
  });

  it('is imported lazily, out of the code that draws the rest of the note', () => {
    const dist = resolve(__dirname, '..', 'dist');
    const files = readdirSync(dist).filter((name) => name.endsWith('.js'));
    for (const name of files) {
      const text = readFileSync(join(dist, name), 'utf8');
      expect(text, name).not.toMatch(/^import[^;]*['"]mermaid['"]/m);
    }
    expect(readFileSync(join(dist, 'MermaidDiagram.js'), 'utf8')).toContain("import('mermaid')");
  });
});
