/**
 * A parameter in the editor (§7.14, #134): a decoration over characters the author edits, never an
 * atomic block, and a note carrying one is returned byte for byte.
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

async function open(markdown: string, changes: string[]): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => changes.push(next)} />);
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

describe('a parameter in the editor', () => {
  it('is drawn over its characters, which stay text', async () => {
    const changes: string[] = [];
    const view = await open('O síndico {{síndico}} e [[{{client}}]].\n', changes);
    const drawn = [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-ms-parameter')];
    expect(drawn.map((each) => [each.textContent, each.dataset['parameter']])).toEqual([
      ['{{síndico}}', 'síndico'],
      ['{{client}}', 'client'],
    ]);
    expect(view.contentDOM.querySelector('.cm-ms-wikilink-parameter')?.getAttribute('data-target')).toBeNull();
    expect(changes).toEqual([]);
  });

  it('takes what the author types inside it, and the note keeps every other byte', async () => {
    const changes: string[] = [];
    const view = await open('Bloco {{bloco}}, \\{{literal}}.\n', changes);
    const at = view.state.doc.toString().indexOf('bloco}}') + 'bloco'.length;
    act(() => view.dispatch({ changes: { from: at, insert: '_a' } }));
    expect(changes.at(-1)).toBe('Bloco {{bloco_a}}, \\{{literal}}.\n');
    expect(view.contentDOM.querySelector('.cm-ms-parameter')?.textContent).toBe('{{bloco_a}}');
  });
});
