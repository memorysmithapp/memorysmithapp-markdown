/**
 * Footnotes in a note an embed cuts into runs (§7.12): a reference above the
 * embed meets its definition below it, the note numbers its footnotes once,
 * draws one section at its end, and every way back reaches its reference.
 */

import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { notebook } from './notebook.js';
import { draw, html } from './render.js';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

const HOST = notebook({ Casta: 'O açúcar engana. ^brix\n\nOutro bloco[^x].\n\n[^x]: Da casta.' });

const refs = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLAnchorElement>(':scope > .markdown > .markdown a[data-footnote-ref]')].map(
    (a) => ({ text: a.textContent, id: a.id, href: a.getAttribute('href') }),
  );

describe('a footnote across an embed', () => {
  it('is drawn when the embed separates its reference from its definition', async () => {
    const note = await draw('Antes[^fonte].\n\n![[Casta#^brix]]\n\nDepois.\n\n[^fonte]: Um livro.', HOST);
    await settle();
    expect(note.container.textContent).not.toContain('[^fonte]');
    expect(refs(note.container)).toEqual([
      { text: '1', id: 'user-content-fnref-fonte', href: '#user-content-fn-fonte' },
    ]);
    const sections = note.container.querySelectorAll('section[data-footnotes]');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.querySelector('li#user-content-fn-fonte')?.textContent).toContain('Um livro.');
    note.unmount();
  });

  it('numbers the footnotes on both sides in one sequence, with ids that never repeat', async () => {
    const markdown = [
      'Um[^b] e dois[^a].',
      '',
      '[^a]: Primeira definida.',
      '',
      '![[Casta#^brix]]',
      '',
      'De novo[^a], e três[^c].',
      '',
      '[^b]: Segunda.',
      '',
      '[^c]: Terceira.',
    ].join('\n');
    const note = await draw(markdown, HOST);
    await settle();
    expect(refs(note.container).map(({ text, id }) => [text, id])).toEqual([
      ['1', 'user-content-fnref-b'],
      ['2', 'user-content-fnref-a'],
      ['2', 'user-content-fnref-a-2'],
      ['3', 'user-content-fnref-c'],
    ]);
    const sections = note.container.querySelectorAll('section[data-footnotes]');
    expect(sections).toHaveLength(1);
    const items = [...sections[0]!.querySelectorAll('ol > li')].map((li) => li.id);
    expect(items).toEqual(['user-content-fn-b', 'user-content-fn-a', 'user-content-fn-c']);
    // Both uses of `a` have their way back, to ids that exist.
    const back = [...sections[0]!.querySelectorAll<HTMLAnchorElement>('a[data-footnote-backref]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(back).toEqual([
      '#user-content-fnref-b',
      '#user-content-fnref-a',
      '#user-content-fnref-a-2',
      '#user-content-fnref-c',
    ]);
    for (const href of back) expect(note.container.querySelector(`[id="${href!.slice(1)}"]`)).not.toBeNull();
    const ids = [...note.container.querySelectorAll(':scope > .markdown [id]')]
      .filter((element) => !element.closest('.embed'))
      .map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    note.unmount();
  });

  it('draws the section at the end of the note, below an embed that ends it', async () => {
    const note = await draw('Texto[^n].\n\n[^n]: Nota.\n\n![[Casta#^brix]]', HOST);
    await settle();
    const children = [...note.container.querySelector(':scope > .markdown')!.children];
    const section = children.findIndex((child) => child.querySelector('section[data-footnotes]'));
    const embed = children.findIndex((child) => child.matches('figure.embed'));
    // After the title the default theme draws: the run, the embed, then the section.
    expect(embed).toBe(2);
    expect(section).toBe(3);
    expect(note.container.querySelectorAll('section[data-footnotes]')).toHaveLength(1);
    note.unmount();
  });

  it('brings a way back to a reference in another run into view', async () => {
    const note = await draw('Antes[^fonte].\n\n![[Casta#^brix]]\n\n[^fonte]: Um livro.', HOST);
    await settle();
    let scrolled: Element | null = null;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled = this;
    };
    const back = note.container.querySelector<HTMLAnchorElement>('a[data-footnote-backref]');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    back?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect((scrolled as Element | null)?.id).toBe('user-content-fnref-fonte');
    note.unmount();
  });

  it('leaves the footnotes of the embedded note to the embed', async () => {
    const note = await draw('Antes[^fonte].\n\n![[Casta]]\n\n[^fonte]: Um livro.', HOST);
    await settle();
    const embed = note.container.querySelector('figure.embed');
    expect(embed?.querySelectorAll('section[data-footnotes]')).toHaveLength(1);
    expect(embed?.querySelector('section[data-footnotes]')?.textContent).toContain('Da casta.');
    const own = [...note.container.querySelectorAll('section[data-footnotes]')].filter((s) => !s.closest('.embed'));
    expect(own).toHaveLength(1);
    expect(own[0]?.textContent).not.toContain('Da casta.');
    note.unmount();
  });

  it('keeps the task boxes of the runs on their ordinals', async () => {
    const seen: number[] = [];
    const markdown = '- [ ] um[^n]\n\n![[Casta#^brix]]\n\n- [ ] dois\n\n[^n]: Nota.';
    const note = await draw(markdown, { ...HOST, writable: true, onToggleTask: (ordinal) => seen.push(ordinal) });
    await settle();
    const boxes = [...note.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes).toHaveLength(2);
    for (const box of boxes) await act(async () => box.click());
    expect(seen).toEqual([0, 1]);
    note.unmount();
  });
});

describe('a note the plan leaves alone', () => {
  it('is drawn as before when a definition sits inside a quote', () => {
    const out = html('Antes[^q].\n\n![[Casta#^brix]]\n\n> [^q]: Citada.', HOST);
    expect(out).toContain('[^q]');
  });
});
