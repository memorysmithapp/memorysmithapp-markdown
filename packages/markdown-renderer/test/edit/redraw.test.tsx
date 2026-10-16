/**
 * A block the editor draws keeps its element while the author types elsewhere and the host renders
 * again (#99): it is drawn again in place, never removed and added, and a block that is made anew
 * holds the height it was drawn at until it is drawn, so the page never collapses under the caret.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { rememberHeight } from '../../src/edit/heights.js';
import { metricsField } from '../../src/edit/live.js';
import { mount, type Mounted } from '../render.js';

const CALLOUT = '> [!note] A title\n> Some text in it.';
const TABLE = '| A | B |\n| --- | --- |\n| a | b |';
const NOTE = `---\nname: A note\nstatus: draft\n---\n\n${CALLOUT}\n\n${TABLE}\n\nA paragraph the author types in.\n\n$$\nx^2\n$$\n`;

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

async function editorOf(): Promise<EditorView> {
  await settle();
  return EditorView.findFromDOM(mounted!.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

/** Counts the drawn blocks taken out of the page from now on. */
function watchRemovals(view: EditorView): () => number {
  let removed = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node instanceof HTMLElement && (node.classList.contains('cm-ms-block') || node.classList.contains('cm-ms-inline-block'))) removed++;
      }
    }
  });
  observer.observe(view.contentDOM, { childList: true, subtree: true });
  return () => {
    observer.takeRecords().length;
    observer.disconnect();
    return removed;
  };
}

/** The note's editor, its host given again with every function under a new identity. */
const editor = (markdown: string) => (
  <NoteEditor markdown={markdown} onChange={() => undefined} resolve={(name) => (name ? null : null)} suggest={() => []} />
);

describe('a drawn block', () => {
  it('is never removed while the author types in a paragraph, below it or above it', async () => {
    mounted = await mount(editor(NOTE));
    const view = await editorOf();
    const blocks = view.contentDOM.querySelectorAll('.cm-ms-block').length;
    expect(blocks).toBeGreaterThan(2);
    const removed = watchRemovals(view);
    const below = NOTE.indexOf('types in.') + 'types in'.length;
    for (const key of 'abc') {
      const at = view.state.selection.main.head;
      await act(async () => view.dispatch({ changes: { from: below, insert: key }, selection: { anchor: at } }));
    }
    // Typed above the blocks, which moves every one of them.
    await act(async () => view.dispatch({ changes: { from: NOTE.indexOf('> [!note]') - 1, insert: 'Above. ' } }));
    await settle();
    expect(removed()).toBe(0);
    expect(view.contentDOM.querySelectorAll('.cm-ms-block').length).toBe(blocks);
  });

  it('is not drawn anew when the host renders again with the same meaning', async () => {
    mounted = await mount(editor(NOTE));
    const view = await editorOf();
    const callout = view.contentDOM.querySelector('.cm-ms-block .callout')!.closest('.cm-ms-block');
    const removed = watchRemovals(view);
    for (let i = 0; i < 3; i++) await act(async () => mounted!.root.render(editor(NOTE)));
    await settle();
    expect(removed()).toBe(0);
    expect(view.contentDOM.querySelector('.cm-ms-block .callout')!.closest('.cm-ms-block')).toBe(callout);
  });

  it('keeps its element when its own source changes, drawing the new one in it', async () => {
    mounted = await mount(editor(NOTE));
    const view = await editorOf();
    const table = view.contentDOM.querySelector('.cm-ms-block table')!.closest('.cm-ms-block');
    const removed = watchRemovals(view);
    await act(async () => view.dispatch({ changes: { from: NOTE.indexOf('| a |') + 2, to: NOTE.indexOf('| a |') + 3, insert: 'z' } }));
    await settle();
    expect(removed()).toBe(0);
    expect(view.contentDOM.querySelector('.cm-ms-block table')!.closest('.cm-ms-block')).toBe(table);
    expect(table!.textContent).toContain('z');
  });

  it('made anew, holds the height it was drawn at until it is drawn', async () => {
    mounted = await mount(editor('Text.\n'));
    const view = await editorOf();
    rememberHeight(`callout\u0000${CALLOUT}`, view.state.field(metricsField), 321);
    await act(async () => view.dispatch({ changes: { from: view.state.doc.length, insert: `\n${CALLOUT}\n` } }));
    // Before React drew it: the element is empty, and holds the height.
    const held = [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-ms-block')].map((block) => block.style.minHeight);
    expect(held).toContain('321px');
  });
});
