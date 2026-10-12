/**
 * A click on a task box changes exactly one character of the note, the right
 * one — through the host, which applies the ordinal the package reports with
 * `toggleTaskAt`. Every enabled box of a note is clicked in turn, in a note
 * that puts boxes before and after embeds, inside callouts and in nested
 * lists, and the change is compared with the source byte by byte.
 */

import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { NoteBody, toggleTaskAt } from '../src/index.js';
import { notebook } from './notebook.js';
import { mount } from './render.js';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

/** The one position where two strings of the same length differ, or the reason they are not that. */
function oneCharacterChange(before: string, after: string): number {
  expect(after.length).toBe(before.length);
  const changed = [...before].map((character, index) => (character === after[index] ? -1 : index)).filter((index) => index >= 0);
  expect(changed).toHaveLength(1);
  return changed[0] ?? -1;
}

const NOTE = [
  '---',
  'name: Roteiro',
  'tags: [a, b]',
  '---',
  '',
  '# Roteiro',
  '',
  '- [ ] Ler a norma',
  '- [x] Resumir o artigo 75',
  '  - [ ] Um item aninhado',
  '    1. [X] Mais fundo, numerado',
  '',
  '![[Outra nota]]',
  '',
  '> [!todo] No callout',
  '> - [ ] Dentro do callout',
  '> - [x] Também dentro',
  '',
  '```markdown',
  '- [ ] Um exemplo, não uma caixa',
  '```',
  '',
  '* [ ] Depois do embed e do exemplo',
  '',
  '![[Outra nota#Pendências]]',
  '',
  '+ [ ] A última',
].join('\n');

const OTHER = '# Outra\n\n## Pendências\n\n- [ ] Uma caixa de outra nota\n';

describe('ticking each box of a note', () => {
  it('changes exactly the one character of that box, and nothing else', async () => {
    const toggled: number[] = [];
    const note = await mount(
      <NoteBody markdown={NOTE} writable onToggleTask={(ordinal) => toggled.push(ordinal)} {...notebook({ 'Outra nota': OTHER })} />,
    );
    await settle();

    const enabled = [...note.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not([disabled])')];
    const labels = enabled.map((box) => (box.closest('li')?.textContent ?? '').trim().split('\n')[0]?.trim());
    expect(labels).toEqual([
      'Ler a norma',
      'Resumir o artigo 75',
      'Um item aninhado',
      'Mais fundo, numerado',
      'Dentro do callout',
      'Também dentro',
      'Depois do embed e do exemplo',
      'A última',
    ]);

    for (const [index, box] of enabled.entries()) {
      await act(async () => box.click());
      const ordinal = toggled.at(-1) ?? -1;
      const after = toggleTaskAt(NOTE, ordinal);
      expect(after, labels[index]).not.toBeNull();
      const at = oneCharacterChange(NOTE, after ?? '');
      // The character that changed is the one between the brackets of the box
      // that was clicked: its line is the line of the label.
      const end = NOTE.indexOf('\n', at);
      const line = NOTE.slice(NOTE.lastIndexOf('\n', at) + 1, end === -1 ? undefined : end);
      expect(line, labels[index]).toContain(labels[index]);
      expect(NOTE[at - 1]).toBe('[');
      expect(NOTE[at + 1]).toBe(']');
    }
    expect(toggled).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    note.unmount();
  });

  it('leaves the boxes of an embedded note disabled: they belong to another note', async () => {
    const note = await mount(<NoteBody markdown={NOTE} writable onToggleTask={() => undefined} {...notebook({ 'Outra nota': OTHER })} />);
    await settle();
    const embedded = note.container.querySelectorAll<HTMLInputElement>('figure.embed input[type="checkbox"]');
    expect(embedded.length).toBeGreaterThan(0);
    for (const box of embedded) expect(box.disabled).toBe(true);
    note.unmount();
  });

  it('reports nothing and enables nothing when the host does not make the note writable', async () => {
    const toggled: number[] = [];
    const note = await mount(<NoteBody markdown={NOTE} onToggleTask={(ordinal) => toggled.push(ordinal)} />);
    const boxes = [...note.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((box) => box.disabled)).toBe(true);
    note.unmount();
  });
});
