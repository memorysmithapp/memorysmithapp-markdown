/**
 * A double or a triple click selects the word or the line it starts on, even when its first press
 * moved the caret beside a formatted run and the markers that showed or hid moved the line under the
 * pointer before the second press (#114).
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

const NOTE = 'a **b** cd ef\n';

async function open(): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={NOTE} onChange={() => undefined} />);
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

/**
 * Presses `count` times where `where(press)` says the pointer is in the note at that press: what
 * the line drawn under a still pointer reads as, press after press.
 */
async function click(view: EditorView, count: number, where: (press: number) => number): Promise<string> {
  let press = 0;
  view.posAtCoords = (() => where(press)) as typeof view.posAtCoords;
  for (press = 0; press < count; press++) {
    await act(async () => {
      view.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: press + 1, button: 0 }));
      view.contentDOM.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: press + 1, button: 0 }));
    });
  }
  const range = view.state.selection.main;
  return view.state.sliceDoc(range.from, range.to);
}

describe('a double click beside a formatted run (#114)', () => {
  it.each([...'cd'].map((_, index) => index))('selects the word it starts on, at each of its letters, however the line moved under the pointer: %i', async (letter) => {
    const view = await open();
    const at = NOTE.indexOf('cd') + letter;
    // The first press reads the letter; by the second the markers moved `**` under the pointer.
    expect(await click(view, 2, (press) => (press === 0 ? at : NOTE.indexOf('**', 4)))).toBe('cd');
  });

  it('selects the word inside the run itself', async () => {
    const view = await open();
    expect(await click(view, 2, (press) => (press === 0 ? NOTE.indexOf('b') : NOTE.indexOf('cd')))).toBe('b');
  });

  it('selects the line for a triple click', async () => {
    const view = await open();
    expect(await click(view, 3, (press) => (press === 0 ? NOTE.indexOf('ef') : 0))).toBe('a **b** cd ef');
  });

});
