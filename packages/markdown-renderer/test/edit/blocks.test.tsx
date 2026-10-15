/**
 * The blocks the editor draws, used as an author uses them (#55, #56, #58): each control and each
 * field writes the bytes of what it changes, and the rest of the note reaches the host as it was.
 */

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

async function open(markdown: string): Promise<string[]> {
  const changes: string[] = [];
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => changes.push(next)} />);
  await settle();
  return changes;
}

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);

/** Types a value into a field as React sees it, and leaves it. */
async function fill(field: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  await settle();
}

describe('the properties form', () => {
  const NOTE = '---\nname: Old\ntags: [a, b]\nstatus: draft\n---\n\nBody.\n';

  it('renames the note through its title, and nothing else', async () => {
    const changes = await open(NOTE);
    await fill($<HTMLInputElement>('.edit-title')!, 'New');
    expect(changes.at(-1)).toBe(NOTE.replace('name: Old', 'name: New'));
  });

  it('changes a value, a key, and a list item', async () => {
    const changes = await open(NOTE);
    await fill($<HTMLInputElement>('input[aria-label="Value: status"]')!, 'final');
    expect(changes.at(-1)).toBe(NOTE.replace('draft', 'final'));
    await fill($<HTMLInputElement>('input[aria-label="Key: status"]')!, 'state');
    expect(changes.at(-1)).toBe(NOTE.replace('status: draft', 'state: final'));
    await act(async () => $<HTMLButtonElement>('button[aria-label="Remove a"]')!.click());
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('status: draft', 'state: final').replace('[a, b]', '[b]'));
  });

  it('edits a yes/no property as Yes or No, in the words the author used (#61)', async () => {
    const note = '---\nreviewed: true\npublished: No\n---\n\nBody.\n';
    const changes = await open(note);
    expect($('.edit-properties input[type="checkbox"]')).toBeNull();
    const choose = async (key: string, value: string) => {
      const select = $<HTMLSelectElement>(`select[aria-label="Value: ${key}"]`)!;
      await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await settle();
    };
    const reviewed = $<HTMLSelectElement>('select[aria-label="Value: reviewed"]')!;
    expect(reviewed.value).toBe('yes');
    expect([...reviewed.options].map((option) => option.textContent)).toEqual(['Yes', 'No']);
    await choose('reviewed', 'no');
    expect(changes.at(-1)).toBe(note.replace('true', 'false'));
    await choose('published', 'yes');
    expect(changes.at(-1)).toBe(note.replace('true', 'false').replace('No', 'Yes'));
  });

  it('makes a new property of the type chosen, its value field taking the focus (#70)', async () => {
    const add = async (key: string, type: string) => {
      const name = $<HTMLInputElement>('.edit-property-new input')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(name, key);
        name.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const select = $<HTMLSelectElement>('select[aria-label="Type of the new property"]')!;
      await act(async () => {
        select.value = type;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await act(async () => $<HTMLButtonElement>('.edit-property-new button[aria-label="Add a property"]')!.click());
      await settle();
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    const changes = await open(NOTE);
    expect([...$<HTMLSelectElement>('select[aria-label="Type of the new property"]')!.options].map((option) => option.textContent)).toEqual(['Text', 'List', 'Yes or no', 'Date']);

    await add('aliases', 'list');
    expect(changes.at(-1)).toBe(NOTE.replace('status: draft\n', 'status: draft\naliases: []\n'));
    // An empty list is still a list to the form: the field of its first item, with the focus.
    const first = $<HTMLInputElement>('input[aria-label="Add: aliases"]')!;
    expect(document.activeElement).toBe(first);
    const typeItem = async (value: string) => {
      const field = $<HTMLInputElement>('input[aria-label="Add: aliases"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      await settle();
    };
    // Items typed one after the other with Enter: the field keeps the focus for the next.
    await typeItem('First');
    expect(changes.at(-1)).toContain('aliases: [First]\n');
    expect(document.activeElement).toBe($('input[aria-label="Add: aliases"]'));
    await typeItem('Second');
    expect(changes.at(-1)).toContain('aliases: [First, Second]\n');
    expect(document.activeElement).toBe($('input[aria-label="Add: aliases"]'));

    await add('done', 'boolean');
    expect(changes.at(-1)).toContain('done: false\n');
    expect(document.activeElement).toBe($('select[aria-label="Value: done"]'));

    await add('due', 'date');
    expect(changes.at(-1)).toContain('due: 2026-10-15\n');
    expect(document.activeElement).toBe($('input[aria-label="Value: due"]'));

    await add('note', 'text');
    expect(changes.at(-1)).toContain('note:\n---');
    expect(document.activeElement).toBe($('input[aria-label="Value: note"]'));
    vi.useRealTimers();
  });

  it('gives a note with no frontmatter one, at its top', async () => {
    const changes = await open('# Title\n');
    await act(async () => $<HTMLButtonElement>('.edit-add-properties button')!.click());
    await settle();
    expect(changes.at(-1)).toBe('---\n---\n# Title\n');
    expect($('.edit-properties')).not.toBeNull();
  });
});

describe('a callout', () => {
  it('changes its type and its folding by rewriting its marker', async () => {
    const NOTE = 'Text.\n\n> [!note] Title\n> Body.\n';
    const changes = await open(NOTE);
    const [type, fold] = [...mounted!.container.querySelectorAll<HTMLSelectElement>('.edit-callout select')];
    await act(async () => {
      type!.value = 'warning';
      type!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('[!note]', '[!warning]'));
    const again = [...mounted!.container.querySelectorAll<HTMLSelectElement>('.edit-callout select')][1] ?? fold!;
    await act(async () => {
      again.value = '-';
      again.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('[!note]', '[!warning]-'));
  });
});

describe('a table', () => {
  const NOTE = 'Text.\n\n| a | b |\n| --- | :-: |\n| 1 | 2 |\n\nAfter.\n';

  it('edits a cell where it stands', async () => {
    const changes = await open(NOTE);
    const drawn = $<HTMLElement>('.edit-cell[data-row="2"][data-column="1"]')!;
    await act(async () => drawn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    await settle();
    const cell = $<HTMLElement>('.edit-cell[data-row="2"][data-column="1"][contenteditable]')!;
    cell.textContent = 'two';
    await act(async () => cell.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('| 1 | 2 |', '| 1 | two |'));
  });

  it('fills a new table cell by cell, and adds a row on Tab past its last cell (#68)', async () => {
    const empty = 'Text.\n\n|  |  |\n| --- | --- |\n|  |  |\n\nAfter.\n';
    const changes = await open(empty);
    const edit = async (row: number, column: number) => {
      const drawn = $<HTMLElement>(`.edit-cell[data-row="${row}"][data-column="${column}"]`)!;
      await act(async () => drawn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      await settle();
      return $<HTMLElement>(`.edit-cell[data-row="${row}"][data-column="${column}"][contenteditable]`)!;
    };
    const cell = await edit(2, 1);
    cell.textContent = 'last';
    await act(async () => cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    await settle();
    expect(changes.at(-1)).toBe(empty.replace('|  |  |\n\nAfter', '|  | last |\n|  |  |\n\nAfter'));
    // The new row's first cell is the one being edited, with the focus.
    const next = $<HTMLElement>('.edit-cell[data-row="3"][data-column="0"][contenteditable]');
    expect(next).not.toBeNull();
    expect(document.activeElement).toBe(next);
  });

  it('keeps what was typed in a cell when a control is used before leaving it (#69)', async () => {
    const changes = await open(NOTE);
    const edit = async (row: number, column: number) => {
      const drawn = $<HTMLElement>(`.edit-cell[data-row="${row}"][data-column="${column}"]`)!;
      await act(async () => drawn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      await settle();
      return $<HTMLElement>(`.edit-cell[data-row="${row}"][data-column="${column}"][contenteditable]`)!;
    };
    // The control keeps the focus where it is: the cell has not committed when it acts.
    (await edit(2, 0)).textContent = 'one';
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Align right"]')!.click());
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('| --- | :-: |', '| ---: | :-: |').replace('| 1 | 2 |', '| one | 2 |'));
    expect(changes).toHaveLength(1);

    (await edit(2, 1)).textContent = 'two';
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Add a column"]')!.click());
    await settle();
    expect(changes.at(-1)).toContain('| one | two |  |');
  });

  it('acts on the cell the author was in after the table is drawn again (#69)', async () => {
    const changes = await open(NOTE);
    const drawn = $<HTMLElement>('.edit-cell[data-row="2"][data-column="1"]')!;
    await act(async () => drawn.dispatchEvent(new FocusEvent('focus')));
    await act(async () => drawn.focus());
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Add a column"]')!.click());
    await settle();
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Align right"]')!.click());
    await settle();
    expect(changes.at(-1)).toContain('| --- | ---: | --- |');
  });

  it('adds a row and aligns a column from its controls', async () => {
    const changes = await open(NOTE);
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Add a row"]')!.click());
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('| 1 | 2 |', '| 1 | 2 |\n|  |  |'));
    await act(async () => $<HTMLButtonElement>('.edit-table button[aria-label="Align right"]')!.click());
    await settle();
    expect(changes.at(-1)).toContain('| ---: | :-: |');
  });
});
