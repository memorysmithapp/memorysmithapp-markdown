/**
 * The editor returns a note it did not change byte for byte (#50), and an edit changes only the
 * bytes it touched: every note of the demonstration notebooks and every case of the conformance
 * suite is opened in the editor, read back with no edit, and edited once.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cases } from '@memorysmithapp/markdown-spec';
import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { lineBreakOf, NoteEditor } from '../../src/edit/index.js';
import { analyze } from '../../src/edit/analyze.js';
import { mount, type Mounted } from '../render.js';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const NOTEBOOKS = join(ROOT, 'notebooks');
const notes: [string, string][] = [];
const collect = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name.endsWith('.md')) notes.push([relative(NOTEBOOKS, path), readFileSync(path, 'utf8')]);
  }
};
collect(NOTEBOOKS);
const suite: [string, string][] = cases.map((each) => [each.id, each.markdown]);

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Opens a note in the editor and answers its view and every text the editor handed back. */
async function open(markdown: string): Promise<{ view: EditorView; changes: string[] }> {
  const changes: string[] = [];
  mounted?.unmount();
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => changes.push(next)} />);
  const element = mounted.container.querySelector<HTMLElement>('.cm-editor');
  if (!element) throw new Error('no editor');
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error('no view');
  return { view, changes };
}

describe('a note opened and read back with no edit', () => {
  it.each([...notes, ...suite])('is the same bytes: %s', async (_name, markdown) => {
    const { view, changes } = await open(markdown);
    expect(view.state.doc.sliceString(0, view.state.doc.length, lineBreakOf(markdown) ?? '\n')).toBe(markdown);
    expect(changes).toEqual([]);
  });

  it('keeps CRLF line breaks and a missing final newline', async () => {
    const crlf = '---\r\nname: A\r\n---\r\n# Title\r\n\r\nText';
    expect(lineBreakOf(crlf)).toBe('\r\n');
    const { view, changes } = await open(crlf);
    expect(view.state.doc.sliceString(0, view.state.doc.length, '\r\n')).toBe(crlf);
    // A block written with `\n`, as the toolbar and a paste write it, is CRLF in what the host receives.
    await act(async () => view.dispatch({ changes: { from: view.state.doc.length, insert: '\n\n| a |\n| - |' } }));
    expect(changes.at(-1)).toBe(`${crlf}\r\n\r\n| a |\r\n| - |`);
  });

  it('opens a note that mixes line breaks read-only, and changes nothing', async () => {
    const mixed = '# Title\r\n\nText\n';
    expect(lineBreakOf(mixed)).toBeNull();
    const { view, changes } = await open(mixed);
    expect(view.state.readOnly).toBe(true);
    expect(mounted?.container.querySelector('.edit-unavailable')).not.toBeNull();
    expect(changes).toEqual([]);
  });
});

describe('a note edited once', () => {
  it.each(notes)('differs only where it was edited: %s', async (_name, markdown) => {
    const { view, changes } = await open(markdown);
    // A word typed at the start of the body, and one at the end of the note.
    const at = analyze(markdown).bodyFrom;
    await act(async () => view.dispatch({ changes: { from: at, insert: 'Edited ' } }));
    await act(async () => view.dispatch({ changes: { from: view.state.doc.length, insert: ' end' } }));
    expect(changes.at(-1)).toBe(`${markdown.slice(0, at)}Edited ${markdown.slice(at)} end`);
  });
});
