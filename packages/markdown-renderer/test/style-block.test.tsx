// The `:::{style}` block (`SPEC.md` §7.16, #164): a passage drawn in its own face and alignment, its
// fences and options blanked so every offset and line is kept, its content the note's own.

import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Markdown } from '../src/Markdown.js';
import { NoteBody } from '../src/index.js';
import { findStyleBlocks, styleAt } from '../src/style-block.js';
import { html, mount, type Mounted } from './render.js';

const BLOCK = ':::{style}\n---\ntext: justify\nheadings: center\n---\n# Ata\n\nO condomínio deliberou.\n:::\n';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('findStyleBlocks', () => {
  it('blanks the fences and the options, keeping every offset and every line', () => {
    const found = findStyleBlocks(`Before.\n\n${BLOCK}\nAfter.\n`);
    expect(found.text).toHaveLength(`Before.\n\n${BLOCK}\nAfter.\n`.length);
    expect(found.text.split('\n')).toHaveLength(`Before.\n\n${BLOCK}\nAfter.\n`.split('\n').length);
    expect(found.text).not.toMatch(/:::|---|text: justify/);
    expect(found.blocks).toEqual([{ open: 3, close: 11, from: 8, to: 10, style: { text: 'justify', headings: 'center' }, depth: 0 }]);
    expect(found.problems).toEqual([]);
  });

  it('reads keys and values with case folded, and quoted values', () => {
    expect(findStyleBlocks(':::{style}\n---\nFont: "Serif"\nTables: JUSTIFY\n---\nx\n:::\n').blocks[0]?.style).toEqual({ font: 'serif', tables: 'justify' });
  });

  it('has no options where no `---` closes them, and draws those lines as content', () => {
    const found = findStyleBlocks(':::{style}\n---\ntext: justify\n\nBody.\n:::\n');
    expect(found.blocks[0]?.style).toEqual({});
    expect(found.text).toContain('text: justify');
  });

  it('nests a block in another, the inner one closing first, and merges them innermost last', () => {
    const found = findStyleBlocks('::::{style}\n---\ntext: justify\nfont: serif\n---\nOuter.\n\n:::{style}\n---\ntext: center\n---\nInner.\n:::\n\nOuter again.\n::::\n');
    expect(found.blocks.map(({ open, close, depth }) => ({ open, close, depth }))).toEqual([
      { open: 1, close: 16, depth: 0 },
      { open: 8, close: 13, depth: 1 },
    ]);
    expect(styleAt(found.blocks, 12)).toEqual({ text: 'center', font: 'serif' });
    expect(styleAt(found.blocks, 15)).toEqual({ text: 'justify', font: 'serif' });
  });

  it('runs a block never closed to the end of the text, and says so', () => {
    const found = findStyleBlocks('Before.\n:::{style}\nAfter.\n');
    expect(found.blocks[0]).toMatchObject({ open: 2, close: null, from: 3, to: 4 });
    expect(found.problems.map(({ code, line }) => [code, line])).toEqual([['style-unclosed', 2]]);
  });

  it('leaves a fence inside code alone, and a line of colons that closes nothing as text', () => {
    expect(findStyleBlocks('```\n:::{style}\n:::\n```\n').blocks).toEqual([]);
    const stray = findStyleBlocks(':::\nText.\n');
    expect(stray.blocks).toEqual([]);
    expect(stray.text).toBe(':::\nText.\n');
  });

  it('reads no block inside a quote, nor one four spaces in', () => {
    expect(findStyleBlocks('> :::{style}\n> x\n> :::\n').blocks).toEqual([]);
    expect(findStyleBlocks('    :::{style}\n    x\n    :::\n').blocks).toEqual([]);
  });
});

describe('a style block, drawn', () => {
  it('draws what it holds in an element carrying what it sets, and nothing of its fences or options', () => {
    const drawn = html(`Before.\n\n${BLOCK}\nAfter.\n`);
    expect(drawn).toContain('<p>Before.</p>');
    expect(drawn).toContain('<div class="style-block" style="--ms-align-headings:center;--ms-align-text:justify;--ms-hyphens-text:auto" data-headings="center" data-text="justify" lang="en-US"><h1>Ata</h1><p>O condomínio deliberou.</p></div>');
    expect(drawn).toContain('<p>After.</p>');
    expect(drawn).not.toMatch(/:::|<hr|<h2/);
  });

  it('nests an inner block inside the outer one', () => {
    const drawn = html(':::{style}\n---\nfont: serif\n---\nOuter.\n\n:::{style}\n---\ntext: right\n---\nInner.\n:::\n:::\n');
    expect(drawn).toMatch(/<div class="style-block" style="--ms-face:var\(--ms-font-serif\);--ms-face-heading:var\(--ms-font-serif\)" data-font="serif"><p>Outer.<\/p><div class="style-block" style="--ms-align-text:right;--ms-hyphens-text:manual" data-text="right"><p>Inner.<\/p><\/div><\/div>/);
  });

  it('keeps the alignment a column declares over what the block sets for tables', () => {
    expect(html(':::{style}\n---\ntables: justify\n---\n| a | b |\n|---|---:|\n| 1 | 2 |\n:::\n')).toContain('<td style="text-align:right">2</td>');
  });

  it('draws a block with no options as written, in an element that sets nothing', () => {
    expect(html(':::{style}\nJust text.\n:::\n')).toContain('<div class="style-block"><p>Just text.</p></div>');
  });

  it('draws a note with no block exactly as before', () => {
    expect(html('# Title\n\nText.\n')).not.toContain('style-block');
  });

  it('draws an embed it holds in its style, and the runs on either side of it too', () => {
    const drawn = html(':::{style}\n---\ntext: justify\n---\nBefore.\n\n![[Other]]\n\nAfter.\n:::\n', { resolve: () => '/notes/other', loadNote: async () => null });
    const blocks = drawn.match(/<div class="style-block"[^>]*>/g) ?? [];
    expect(blocks.length).toBe(3);
    expect(drawn).toMatch(/<div class="style-block"[^>]*><p>Before.<\/p><\/div><\/div><div class="style-block" style="[^"]*" data-text="justify" lang="en-US"><div class="skeleton-region"/);
  });

  it('is drawn as it is in print', () => {
    expect(html(BLOCK, { printing: true })).toContain('<div class="style-block"');
  });

  it("is found in an embedded note's own text, which is drawn on its own", () => {
    expect(renderToStaticMarkup(<Markdown>{BLOCK}</Markdown>)).toContain('<div class="style-block"');
  });

  it('ticks the task box the reader clicked, after a block, as before', async () => {
    const onToggleTask = vi.fn();
    mounted = await mount(<NoteBody markdown={`${BLOCK}\n- [ ] first\n- [ ] second\n`} actions={false} writable onToggleTask={onToggleTask} />);
    const boxes = mounted.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => boxes[1]!.click());
    expect(onToggleTask).toHaveBeenCalledWith(1);
  });
});
