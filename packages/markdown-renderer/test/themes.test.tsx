/**
 * Themes, level by level: a property changes what it names, a theme's CSS
 * reaches the note and nothing outside it, every slot is called with its
 * documented props — and no slot can undo what the notation means.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  customPropertyOf,
  defineTheme,
  THEME_PROPERTIES,
  THEME_SLOTS,
  type ThemeComponents,
} from '../src/index.js';
import { notebook } from './notebook.js';
import { draw, html } from './render.js';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

describe('a theme', () => {
  it('is checked when it is defined', () => {
    expect(() => defineTheme({ name: 'Acme' })).toThrow(/lower case/);
    expect(() => defineTheme({ name: 'acme', properties: { colour: 'red' } as never })).toThrow(/not a theme property/);
    expect(() => defineTheme({ name: 'acme', components: { paragraph: () => null } as never })).toThrow(/not a slot/);
    expect(defineTheme({ name: 'acme-2' }).name).toBe('acme-2');
  });

  it('leaves `light` and `dark` meaning the default theme in that scheme', () => {
    expect(html('x', { theme: 'dark' })).toMatch(/^<div class="markdown markdown-theme-default" data-theme="dark">/);
    expect(html('x')).toMatch(/^<div class="markdown markdown-theme-default" data-theme="light">/);
  });

  it('is drawn in the scheme asked for, or in its only one', () => {
    const both = defineTheme({ name: 'both' });
    const night = defineTheme({ name: 'night', schemes: ['dark'] });
    expect(html('x', { theme: both, scheme: 'dark' })).toContain('data-theme="dark"');
    expect(html('x', { theme: both })).toContain('data-theme="light"');
    expect(html('x', { theme: night, scheme: 'light' })).toContain('data-theme="dark"');
  });
});

describe('level 1: properties', () => {
  const PACKAGE = resolve(__dirname, '..');
  const css = readFileSync(resolve(PACKAGE, 'theme-default.css'), 'utf8');

  it('names exactly the custom properties the default theme reads', () => {
    const read = new Set(css.match(/--markdown-[\w-]+/g) ?? []);
    expect(new Set(THEME_PROPERTIES.map(customPropertyOf))).toEqual(read);
  });

  it('writes each property on the root of the note', () => {
    const theme = defineTheme({ name: 'paper', properties: { bg: '#fdf6e3', textSoft: '#777', h1Size: '2.4em' } });
    const out = html('x', { theme });
    expect(out).toContain('--markdown-bg:#fdf6e3');
    expect(out).toContain('--markdown-text-soft:#777');
    expect(out).toContain('--markdown-h1-size:2.4em');
    expect(out).toContain('class="markdown markdown-theme-paper"');
  });

  it('writes the values of the scheme being drawn', () => {
    const theme = defineTheme({ name: 'two', properties: { light: { bg: 'white' }, dark: { bg: 'black' } } });
    expect(html('x', { theme, scheme: 'light' })).toContain('--markdown-bg:white');
    expect(html('x', { theme, scheme: 'dark' })).toContain('--markdown-bg:black');
  });

  it('writes nothing for the default theme, which is the stylesheet as it is', () => {
    expect(html('x')).not.toContain('style=');
  });
});

describe('level 2: its own CSS', () => {
  it('reaches the note through the class of the theme, and nothing outside it', async () => {
    const style = document.createElement('style');
    style.textContent = '.markdown-theme-acme p { color: rgb(1, 2, 3); }';
    document.head.appendChild(style);
    const outside = document.createElement('p');
    document.body.appendChild(outside);
    const note = await draw('Inside.', { theme: defineTheme({ name: 'acme' }) });
    expect(getComputedStyle(note.container.querySelector('p')!).color).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(outside).color).not.toBe('rgb(1, 2, 3)');
    const plain = await draw('Default.');
    expect(getComputedStyle(plain.container.querySelector('p')!).color).not.toBe('rgb(1, 2, 3)');
    note.unmount();
    plain.unmount();
    outside.remove();
    style.remove();
  });
});

const NOTE = [
  '# Title',
  '',
  '> [!warning]- Careful',
  '> Body of the callout.',
  '',
  '> A plain quotation.',
  '',
  '| a | b |',
  '|:--|--:|',
  '| 1 | 2 |',
  '',
  '```ts',
  'const x = 1;',
  '```',
  '',
  'Some `inline` code[^n], [[Known]] and [[Unknown]].',
  '',
  '- [ ] a task',
  '',
  '![[Known]]',
  '',
  '[^n]: A note.',
].join('\n');

describe('level 3: slots', () => {
  it('lists every slot it calls', () => {
    expect(THEME_SLOTS).toEqual([
      'callout', 'calloutIcon', 'table', 'codeBlock', 'inlineCode', 'heading', 'blockquote',
      'embed', 'footnotes', 'taskBox', 'wikilink', 'diagram', 'properties',
    ]);
  });

  it('calls each slot with the notation already interpreted', async () => {
    const seen: Partial<Record<keyof ThemeComponents, unknown[]>> = {};
    const spy = (name: keyof ThemeComponents) => (props: { children?: React.ReactNode }) => {
      (seen[name] ??= []).push(props);
      return <span data-slot={name}>{props.children ?? null}</span>;
    };
    const theme = defineTheme({
      name: 'spy',
      components: Object.fromEntries(
        THEME_SLOTS.filter((name) => name !== 'calloutIcon' && name !== 'diagram').map((name) => [name, spy(name)]),
      ),
    });
    const host = notebook({ Known: 'Known body.' });
    const note = await draw(NOTE, { ...host, theme, writable: true, onToggleTask: () => undefined });
    await settle();

    const callout = seen.callout?.[0] as { kind: string; fold: string; icon: unknown };
    expect(callout).toMatchObject({ kind: 'warning', fold: '-', icon: null });
    expect(seen.heading).toContainEqual(expect.objectContaining({ level: 1 }));
    expect(seen.blockquote).toHaveLength(1);
    expect(seen.table?.[0]).toMatchObject({ align: ['left', 'right'] });
    expect(seen.codeBlock?.[0]).toMatchObject({ language: 'ts', code: 'const x = 1;' });
    expect(seen.inlineCode).toHaveLength(1);
    expect(seen.footnotes?.[0]).toMatchObject({ label: 'Notes' });
    expect(seen.taskBox?.[0]).toMatchObject({ checked: false, enabled: true });
    expect(seen.wikilink?.map((props) => (props as { pending: boolean }).pending)).toEqual(
      expect.arrayContaining([true, false]),
    );
    expect((seen.embed ?? []).map((props) => (props as { state: string }).state)).toContain('ready');
    // The code inside the block is not a code span.
    expect(note.container.querySelectorAll('[data-slot="inlineCode"]')).toHaveLength(1);
    note.unmount();
  });

  it('draws an icon the theme gives a kind in the title, in place of the stylesheet one', () => {
    const theme = defineTheme({ name: 'icons', icons: { warning: <svg data-icon="w" /> } });
    const out = html('> [!warning] Careful\n> Body.\n\n> [!note] Plain', { theme });
    expect(out).toContain('<div class="callout-title has-icon"><span class="callout-icon" aria-hidden="true"><svg data-icon="w"></svg></span><span class="callout-title-text">Careful</span></div>');
    expect(out).toContain('<div class="callout-title"><span class="callout-title-text">Plain</span></div>');
  });

  it('asks the calloutIcon slot for a kind the icons leave out', () => {
    const calloutIcon = vi.fn(({ kind }: { kind: string }) => <i>{kind}</i>);
    const out = html('> [!tip] Hint', { theme: defineTheme({ name: 'icons', components: { calloutIcon } }) });
    expect(calloutIcon).toHaveBeenCalledWith(expect.objectContaining({ kind: 'tip' }), undefined);
    expect(out).toContain('<span class="callout-icon" aria-hidden="true"><i>tip</i></span>');
  });
});

describe('no slot undoes what the notation means', () => {
  const everything = defineTheme({
    name: 'everything',
    components: {
      callout: ({ children }) => <aside>{children}</aside>,
      blockquote: ({ children }) => <div>{children}</div>,
      heading: ({ children }) => <b>{children}</b>,
      table: ({ children }) => <table>{children}</table>,
      inlineCode: ({ children }) => <kbd>{children}</kbd>,
      wikilink: ({ link, children }) => link(<em>{children}</em>),
      taskBox: ({ checked, toggle }) => (
        <button type="button" data-checked={checked} onClick={toggle}>
          box
        </button>
      ),
    },
  });

  it('draws raw HTML as its text', () => {
    const out = html('# <script>alert(1)</script>\n\n> <img src=x onerror=alert(1)>', { theme: everything });
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('leaves a refused address refused', () => {
    const out = html('> [run](javascript:alert(1))', { theme: everything });
    expect(out).toContain('class="link-refused"');
    expect(out).not.toContain('javascript:');
  });

  it('leads a wikilink only where the host resolved it, or to the pending marker', () => {
    const out = html('[[Known]] and [[Unknown]]', { ...notebook({ Known: '' }), theme: everything });
    expect(out).toContain('<a class="wikilink" href="/notes/Known"><em>Known</em></a>');
    expect(out).toMatch(/<span class="wikilink-pending"[^>]*><em>Unknown<\/em><\/span>/);
  });

  it('leads a wikilink no single note answers to the choice, when the host can ask', () => {
    const host = { ...notebook({ Known: '' }), choose: async () => ({ by: null, notes: [] }) };
    const out = html('[[Unknown]]', { ...host, theme: everything });
    expect(out).toMatch(/<span class="link-choice"><a href="#" class="wikilink-pending"[^>]*><em>Unknown<\/em><\/a><\/span>/);
  });

  it('reports a tick only from a box that is enabled, with the ordinal of the note', async () => {
    const ticks: number[] = [];
    const markdown = '- [ ] one\n- [x] two';
    const readOnly = await draw(markdown, { theme: everything, onToggleTask: (n) => ticks.push(n) });
    for (const button of readOnly.container.querySelectorAll('button')) await act(async () => button.click());
    expect(ticks).toEqual([]);
    readOnly.unmount();
    const writable = await draw(markdown, { theme: everything, writable: true, onToggleTask: (n) => ticks.push(n) });
    const buttons = [...writable.container.querySelectorAll('button')];
    expect(buttons.map((button) => button.dataset.checked)).toEqual(['false', 'true']);
    await act(async () => buttons[1]!.click());
    expect(ticks).toEqual([1]);
    writable.unmount();
  });

  it('copies the bytes of a block as typed, whatever frame the theme draws', () => {
    const codeBlock = vi.fn(({ copy, children }: { copy: unknown; children: unknown }) => (
      <figure>
        {children as never}
        {copy as never}
      </figure>
    ));
    html('```js\nconst a = "<b>";\n```', { theme: defineTheme({ name: 'frame', components: { codeBlock } }) });
    expect(codeBlock).toHaveBeenCalledWith(expect.objectContaining({ code: 'const a = "<b>";', language: 'js' }), undefined);
  });

  it('keeps the root the stylesheet scopes everything under', () => {
    expect(html('x', { theme: everything })).toMatch(/^<div class="markdown markdown-theme-everything" data-theme="light">/);
  });
});
