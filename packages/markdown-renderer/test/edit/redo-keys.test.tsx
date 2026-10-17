/**
 * Ctrl+Shift+Z redoes, as Ctrl+Y does, on every platform and not only on Linux (#120).
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function open(): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={'one\n'} onChange={() => undefined} />);
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

const key = async (view: EditorView, init: KeyboardEventInit) =>
  act(async () => view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })));

describe('the keys that redo (#120)', () => {
  // jsdom names no platform, as CodeMirror's Linux-only binding needs: it is Windows' case.
  it.each([
    ['Ctrl+Shift+Z', { key: 'Z', code: 'KeyZ', keyCode: 90, ctrlKey: true, shiftKey: true }],
    ['Ctrl+Y', { key: 'y', code: 'KeyY', keyCode: 89, ctrlKey: true }],
  ])('%s brings back the change undone, and undoes nothing more', async (_name, redoKey) => {
    const view = await open();
    for (const text of [' two', ' three']) {
      await act(async () => view.dispatch({ changes: { from: view.state.doc.line(1).to, insert: text }, userEvent: 'input.type' }));
      // Two separate steps of the history.
      await act(async () => new Promise((done) => setTimeout(done, 600)));
    }
    expect(view.state.doc.toString()).toBe('one two three\n');
    await key(view, { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true });
    await key(view, { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true });
    expect(view.state.doc.toString()).toBe('one\n');
    await key(view, redoKey);
    expect(view.state.doc.toString()).toBe('one two\n');
  });

  it('names both on the Redo button', async () => {
    await open();
    expect(mounted!.container.querySelector('button[aria-label="Redo"]')!.getAttribute('title')).toBe('Redo (Mod-Shift-Z, Mod-Y)');
  });
});
