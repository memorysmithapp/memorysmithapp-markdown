/**
 * Embedding one note in another, drawn: a whole note, a section, a block, the
 * states the page shows while the host answers, and the one level an embed
 * expands before it becomes a link.
 */

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EMBED_LIMIT } from '../src/embeds.js';
import { notebook } from './notebook.js';
import { draw, html } from './render.js';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

const NORMA = [
  '---',
  'name: Norma 4.2',
  '---',
  '',
  '# Norma 4.2',
  '',
  'Intro.',
  '',
  '## Exceções',
  '',
  'A primeira exceção. ^primeira',
  '',
  '## Vigência',
  '',
  'Outra seção.',
].join('\n');

describe('an embed of a note', () => {
  it('draws the whole body in place, never its frontmatter, and names where it came from', async () => {
    const note = await draw('Antes.\n\n![[Norma 4.2]]\n\nDepois.', notebook({ 'Norma 4.2': NORMA }));
    await settle();
    const figure = note.container.querySelector('figure.embed');
    expect(figure?.querySelector('.embed-body h1')?.textContent).toBe('Norma 4.2');
    expect(figure?.textContent).not.toContain('name:');
    const caption = figure?.querySelector('figcaption.embed-source a');
    expect(caption?.textContent).toBe('Norma 4.2');
    expect(caption?.getAttribute('href')).toBe('/notes/Norma%204.2');
    const texts = [...note.container.querySelectorAll(':scope > .markdown > .markdown > p')].map((p) => p.textContent);
    expect(texts).toEqual(['Antes.', 'Depois.']);
    note.unmount();
  });

  it('draws a section, from its heading to the next one of its level', async () => {
    const note = await draw('![[Norma 4.2#Exceções]]', notebook({ 'Norma 4.2': NORMA }));
    await settle();
    const body = note.container.querySelector('.embed-body');
    expect(body?.querySelector('h2')?.textContent).toBe('Exceções');
    expect(body?.textContent).not.toContain('Vigência');
    expect(note.container.querySelector('figcaption')?.textContent).toBe('Norma 4.2 › Exceções');
    note.unmount();
  });

  it('draws a block, without its identifier', async () => {
    const note = await draw('![[Norma 4.2#^primeira]]', notebook({ 'Norma 4.2': NORMA }));
    await settle();
    expect(note.container.querySelector('.embed-body')?.textContent).toBe('A primeira exceção.');
    expect(note.container.querySelector('figcaption')?.textContent).toBe('Norma 4.2 › ^primeira');
    note.unmount();
  });

  it('says the section is not in the note, in the words of the host', async () => {
    const host = { ...notebook({ 'Norma 4.2': NORMA }), strings: { embedSectionMissing: (s: string) => `A seção "${s}" não existe nesta nota.` } };
    const note = await draw('![[Norma 4.2#Revogação]]', host);
    await settle();
    expect(note.container.querySelector('.embed-missing')?.textContent).toBe('A seção "Revogação" não existe nesta nota.');
    note.unmount();
  });

  it('draws the shape of what is coming while the host answers', () => {
    const out = html('![[Norma 4.2]]', notebook({ 'Norma 4.2': NORMA }));
    expect(out).toContain('<div class="skeleton-region" aria-busy="true" aria-live="polite">');
    expect(out).toContain('<figure class="embed embed-skeleton">');
    expect(out).toContain('<span class="visually-hidden">Loading…</span>');
  });

  it('is pending when the note does not exist, or the host fails', async () => {
    const failing = { ...notebook({ 'Norma 4.2': NORMA }), loadNote: () => Promise.reject(new Error('offline')) };
    for (const host of [notebook({}), failing]) {
      const note = await draw('![[Norma 4.2]]', host);
      await settle();
      expect(note.container.querySelector('p.embed-pending > span.wikilink-pending')?.textContent).toBe('Norma 4.2');
      note.unmount();
    }
  });

  it('is pending without asking when no single note reaches the target, or the host loads nothing', () => {
    const loadNote = vi.fn();
    const several = { ...notebook({ x: 'x' }), reaches: () => 2, loadNote };
    expect(html('![[x]]', several)).toContain('class="embed-pending"');
    expect(loadNote).not.toHaveBeenCalled();
    expect(html('![[x]]')).toContain('class="embed-pending"');
  });

  it('names a note with no name as unnamed', async () => {
    const host = { ...notebook({ x: 'Corpo.' }), loadNote: async () => ({ markdown: 'Corpo.', name: null, address: null }) };
    const note = await draw('![[x]]', host);
    await settle();
    expect(note.container.querySelector('figcaption')?.innerHTML).toBe('Unnamed note');
    note.unmount();
  });
});

describe('one level, and only one', () => {
  it('draws an embed nested three levels deep as one level and a link', async () => {
    const host = notebook({
      A: 'A abre.\n\n![[B]]',
      B: 'B diz:\n\n![[C]]',
      C: 'C diz:\n\n![[D]]',
      D: 'D, o fundo.',
    });
    const note = await draw('![[A]]', host);
    await settle();
    expect(note.container.querySelectorAll('figure.embed')).toHaveLength(1);
    const body = note.container.querySelector('.embed-body');
    expect(body?.textContent).toContain('A abre.');
    const link = body?.querySelector('a.wikilink');
    expect(link?.textContent).toBe('B');
    expect(link?.getAttribute('href')).toBe('/notes/B');
    expect(body?.textContent).not.toContain('B diz');
    note.unmount();
  });

  it('breaks the cycle of two notes that embed each other', async () => {
    const note = await draw('![[A]]', notebook({ A: 'A embute ![[B]]', B: 'B embute ![[A]]' }));
    await settle();
    expect(note.container.querySelectorAll('figure.embed')).toHaveLength(1);
    note.unmount();
  });

  it(`expands ${EMBED_LIMIT} embeds and keeps the rest as links`, async () => {
    const names = Array.from({ length: EMBED_LIMIT + 2 }, (_, i) => `Nota ${i}`);
    const host = notebook(Object.fromEntries(names.map((name) => [name, `Corpo de ${name}.`])));
    const note = await draw(names.map((name) => `![[${name}]]`).join('\n\n'), host);
    await settle();
    expect(note.container.querySelectorAll('figure.embed')).toHaveLength(EMBED_LIMIT);
    const tail = [...note.container.querySelectorAll('a.wikilink')].map((a) => a.textContent);
    expect(tail).toEqual([`Nota ${EMBED_LIMIT}`, `Nota ${EMBED_LIMIT + 1}`]);
    note.unmount();
  });
});

describe('an embed where no block fits', () => {
  it('keeps the table whole, and draws the embed in its cell as a link', async () => {
    const markdown = '| Regra | Onde |\n|---|---|\n| A geral | ![[Lei 14.133]] |\n\n![[Outra]]';
    const note = await draw(markdown, notebook({ 'Lei 14.133': 'Lei.', Outra: 'Outra nota.' }));
    await settle();
    expect(note.container.querySelectorAll('table')).toHaveLength(1);
    expect(note.container.querySelector('td a.wikilink')?.textContent).toBe('Lei 14.133');
    expect(note.container.querySelectorAll('figure.embed')).toHaveLength(1);
    expect(note.container.textContent).not.toContain('![[');
    note.unmount();
  });

  it('leaves an embed written inside a fence alone', () => {
    const out = html('```\n![[Lei 14.133]]\n```', notebook({ 'Lei 14.133': 'Lei.' }));
    expect(out).toContain('![[Lei 14.133]]');
    expect(out).not.toContain('embed');
  });
});
