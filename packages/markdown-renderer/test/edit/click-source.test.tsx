/**
 * The click that reveals a drawn block's source puts the caret where the author clicked, in the
 * source (#102), not at the end of the block's first line.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { sourceOffsetOf } from '../../src/edit/click-source.js';
import { mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  delete (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

/** The text node drawn inside `root` whose text holds `text`. */
function textNode(root: Element, text: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.includes(text)) return node as Text;
  throw new Error(`no text "${text}" drawn`);
}

/** Clicks the block drawing `root` at `offset` of the text holding `text`, as the browser reports the point. */
async function clickAt(root: HTMLElement, text: string, offset: number): Promise<void> {
  const node = textNode(root, text);
  const at = node.textContent!.indexOf(text) + offset;
  (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint = () => ({ offsetNode: node, offset: at });
  await act(async () => node.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
  await settle();
}

/** The block the callout is drawn in. */
const calloutOf = (view: EditorView) => view.contentDOM.querySelector('.edit-callout')!.closest<HTMLElement>('.cm-ms-block')!;

async function open(markdown: string): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={markdown} onChange={() => undefined} />);
  await settle();
  return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

describe('a click on a drawn callout', () => {
  const NOTE = 'Text.\n\n> [!note] A title\n> The body of the callout.\n> A second line.\n\nAfter.\n';

  it('puts the caret in the body line it clicked, at the offset clicked', async () => {
    const view = await open(NOTE);
    const callout = calloutOf(view);
    await clickAt(callout, 'The body of the callout.', 'The body of the callout.'.length);
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    expect(line.text).toBe('> The body of the callout.');
    expect(head).toBe(line.to);
  });

  it('maps a click on a later line of its paragraph, and on its title', async () => {
    const view = await open(NOTE);
    await clickAt(calloutOf(view), 'second', 2);
    expect(view.state.selection.main.head).toBe(NOTE.indexOf('second') + 2);

    // The source is revealed now; drawn again once the caret leaves it.
    await act(async () => view.dispatch({ selection: { anchor: 0 } }));
    await settle();
    await clickAt(calloutOf(view), 'A title', 1);
    expect(view.state.selection.main.head).toBe(NOTE.indexOf('A title') + 1);
  });

  it('goes to the end of its first line when the text clicked is not in the source', async () => {
    const view = await open(NOTE);
    const callout = calloutOf(view);
    (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint = () => null;
    await act(async () => callout.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    await settle();
    expect(view.state.selection.main.head).toBe(NOTE.indexOf('A title') + 'A title'.length);
  });
});

describe('the offset in the source of a drawn text', () => {
  const draw = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root;
  };

  it('is the occurrence the drawing shows, when the same text is drawn twice', () => {
    const root = draw('<p>same</p><p>same</p>');
    const second = root.querySelectorAll('p')[1]!.firstChild!;
    expect(sourceOffsetOf(root, '> same\n> \n> same', second, 1)).toBe('> same\n> \n> '.length + 1);
    root.remove();
  });

  it('is found from the text beside the pointer when the line as drawn is not written', () => {
    const root = draw('<p>a * star and more</p>');
    const node = root.querySelector('p')!.firstChild!;
    const source = '> a \\* star and more';
    expect(sourceOffsetOf(root, source, node, 'a * star'.length)).toBe(source.indexOf(' and'));
    root.remove();
  });

  it('is none for text the source does not write', () => {
    const root = draw('<p>x²</p>');
    expect(sourceOffsetOf(root, '$$\nx^2\n$$', root.querySelector('p')!.firstChild!, 1)).toBeNull();
    root.remove();
  });
});
