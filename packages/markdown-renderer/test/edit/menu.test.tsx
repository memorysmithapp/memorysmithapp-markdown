/**
 * The editing menu of a right-click (#81): what the toolbar formats and inserts, where the author
 * is, with the clipboard's verbs; reached by keyboard; the browser's own menu kept with Shift and
 * wherever the editor's is not.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { shortcutText } from '../../src/edit/ContextMenu.js';
import { mount, type Mounted } from '../render.js';

const NOTE = 'Some text.\n';

// jsdom has no clipboard: the one a browser gives, as far as the menu asks of it.
Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('pasted') }, configurable: true });

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);
const $$ = <T extends Element>(selector: string) => [...mounted!.container.querySelectorAll<T>(selector)];

async function open(markdown = NOTE): Promise<{ view: EditorView; changes: string[] }> {
  const changes: string[] = [];
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(text) => void changes.push(text)} />);
  for (let i = 0; i < 50 && !$('.cm-editor'); i++) await act(async () => new Promise((done) => setTimeout(done, 10)));
  return { view: EditorView.findFromDOM($<HTMLElement>('.cm-editor')!)!, changes };
}

/** A right-click on the text; answers whether the browser's menu was left to it. */
async function rightClick(target: Element, shiftKey = false): Promise<boolean> {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 30, shiftKey });
  await act(async () => target.dispatchEvent(event));
  return !event.defaultPrevented;
}

const groups = () => $$('.edit-menu [role="group"]').map((group) => group.getAttribute('aria-label'));
const item = (label: string) => $$<HTMLButtonElement>('.edit-menu [role="menuitem"]').find((each) => each.querySelector('.edit-menu-label')?.textContent === label)!;

describe('the editing menu (#81)', () => {
  it('opens where the author right-clicks, with Format only for a selection', async () => {
    const { view } = await open();
    expect(await rightClick(view.contentDOM)).toBe(false);
    const menu = $<HTMLElement>('.edit-menu')!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.style.left).toBe('40px');
    expect(groups()).toEqual(['Edit', 'Insert']);
    // With nothing to cut or copy, the first entry that runs is Paste (#110).
    expect(document.activeElement).toBe(item('Paste'));
    await act(async () => item('Paste').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

    await act(async () => view.dispatch({ selection: { anchor: 0, head: 4 } }));
    await rightClick(view.contentDOM);
    expect(groups()).toEqual(['Edit', 'Format', 'Insert']);
    expect(item('Cut').getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(item('Cut'));
  });

  it('runs the entry chosen, as the toolbar does, and closes', async () => {
    const { view, changes } = await open();
    await act(async () => view.dispatch({ selection: { anchor: 0, head: 4 } }));
    await rightClick(view.contentDOM);
    await act(async () => item('Bold').click());
    expect(changes.at(-1)).toBe('**Some** text.\n');
    expect($('.edit-menu')).toBeNull();
    // Without a selection the clipboard has nothing to cut or copy.
    await act(async () => view.dispatch({ selection: { anchor: NOTE.length + 4 } }));
    await rightClick(view.contentDOM);
    expect(item('Cut').getAttribute('aria-disabled')).toBe('true');
    await act(async () => item('Divider').click());
    expect(changes.at(-1)).toContain('\n\n---');
  });

  it('is reached by keyboard: Shift+F10 opens it, the arrows move, Escape gives the text the focus back', async () => {
    const { view } = await open();
    await act(async () => view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })));
    expect($('.edit-menu')).not.toBeNull();
    const first = document.activeElement;
    await act(async () => first!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(item('Link'));
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(item('Attach a file'));
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect($('.edit-menu')).toBeNull();
    expect(document.activeElement).toBe(view.contentDOM);
  });

  it("leaves the browser's menu with Shift, in a drawn block's own field, and in a note it cannot edit", async () => {
    const { view } = await open('| a |\n| --- |\n| 1 |\n\nText.\n');
    expect(await rightClick(view.contentDOM, true)).toBe(true);
    expect($('.edit-menu')).toBeNull();
    const cell = $('.edit-cell')!;
    expect(await rightClick(cell)).toBe(true);
    expect($('.edit-menu')).toBeNull();
    mounted!.unmount();
    const mixed = await open('one\r\ntwo\n');
    expect(await rightClick(mixed.view.contentDOM)).toBe(true);
    expect($('.edit-menu')).toBeNull();
  });

  it('writes each shortcut as the keyboard does', () => {
    expect(shortcutText('Mod-Shift-x')).toBe('Ctrl+Shift+X');
    expect(shortcutText('Mod-/')).toBe('Ctrl+/');
  });
});
