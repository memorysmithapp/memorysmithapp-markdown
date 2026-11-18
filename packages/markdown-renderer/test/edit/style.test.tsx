/**
 * A `:::{style}` block from the editor's controls (`SPEC.md` §7.16, #166): wrapping a passage and
 * the whole note, the frontmatter kept on the first line, and changing the options of the block
 * the cursor is in and nothing else.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { setStyleOptions, styleBlockAt, wrapInStyle } from '../../src/edit/style.js';
import { analyze } from '../../src/edit/analyze.js';
import { applyChanges } from '../../src/edit/table.js';
import { mount, type Mounted } from '../render.js';

const FRONT = '---\nname: Ata\n---\n';

describe('wrapInStyle', () => {
  it('wraps the lines a selection takes in, with only the options chosen', () => {
    const text = 'One.\n\nTwo.\nThree.\n\nFour.\n';
    const from = text.indexOf('Two');
    const { changes, cursor } = wrapInStyle(text, from, text.indexOf('Three') + 3, { text: 'justify' });
    const out = applyChanges(text, changes);
    expect(out).toBe('One.\n\n:::{style}\n---\ntext: justify\n---\nTwo.\nThree.\n:::\n\nFour.\n');
    expect(out.slice(cursor)).toMatch(/^Two\./);
  });

  it('wraps the paragraph the cursor is in when nothing is selected', () => {
    const text = 'One.\n\nTwo,\nstill two.\n\nThree.\n';
    const at = text.indexOf('still');
    expect(applyChanges(text, wrapInStyle(text, at, at, { font: 'serif' }).changes)).toBe('One.\n\n:::{style}\n---\nfont: serif\n---\nTwo,\nstill two.\n:::\n\nThree.\n');
  });

  it('wraps the whole note below its frontmatter, which stays on the first line', () => {
    const text = `${FRONT}# Ata\n\nBody.\n`;
    const out = applyChanges(text, wrapInStyle(text, 0, text.length, { headings: 'center' }).changes);
    expect(out).toBe(`${FRONT}:::{style}\n---\nheadings: center\n---\n# Ata\n\nBody.\n:::\n`);
    expect(out.startsWith('---\nname: Ata\n---\n')).toBe(true);
  });

  it('opens an empty block on a blank line, the cursor inside it', () => {
    const text = 'One.\n\n\nTwo.\n';
    const at = text.indexOf('\n\n') + 2;
    const { changes, cursor } = wrapInStyle(text, at, at, {});
    const out = applyChanges(text, changes);
    expect(out).toBe('One.\n\n:::{style}\n\n:::\nTwo.\n');
    expect(cursor).toBe('One.\n\n:::{style}\n'.length);
  });
});

describe('setStyleOptions', () => {
  const BLOCK = 'Before.\n\n:::{style}\n---\ntext: justify\nfont: serif\n---\nBody.\n:::\n';

  it('finds the innermost block the cursor is in, and none outside', () => {
    expect(styleBlockAt(BLOCK, BLOCK.indexOf('Body'))?.style).toEqual({ text: 'justify', font: 'serif' });
    expect(styleBlockAt(BLOCK, 2)).toBeNull();
  });

  it('rewrites the options and nothing else', () => {
    const block = styleBlockAt(BLOCK, BLOCK.indexOf('Body'))!;
    expect(applyChanges(BLOCK, setStyleOptions(block, { tables: 'right' }))).toBe('Before.\n\n:::{style}\n---\ntables: right\n---\nBody.\n:::\n');
  });

  it('takes the options out when the block sets nothing, and writes them into a block that had none', () => {
    const block = styleBlockAt(BLOCK, BLOCK.indexOf('Body'))!;
    const bare = applyChanges(BLOCK, setStyleOptions(block, {}));
    expect(bare).toBe('Before.\n\n:::{style}\nBody.\n:::\n');
    const again = styleBlockAt(bare, bare.indexOf('Body'))!;
    expect(again.options).toBeNull();
    expect(applyChanges(bare, setStyleOptions(again, { font: 'sans' }))).toBe('Before.\n\n:::{style}\n---\nfont: sans\n---\nBody.\n:::\n');
  });
});

describe('the style control of the editor', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  async function open(markdown: string): Promise<{ view: EditorView; changes: string[] }> {
    const changes: string[] = [];
    mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => changes.push(next)} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    return { view: EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!, changes };
  }
  const $ = <T extends Element>(selector: string): T | null => mounted!.container.ownerDocument.querySelector<T>(selector);
  const choose = async (key: string, value: string): Promise<void> => {
    const select = $<HTMLSelectElement>(`dialog.edit-style select[name="${key}"]`)!;
    select.value = value;
    await act(async () => select.dispatchEvent(new Event('change', { bubbles: true })));
  };

  it('wraps the paragraph the cursor is in, from the toolbar, without the author typing the notation', async () => {
    const { view, changes } = await open(`${FRONT}One.\n\nTwo.\n`);
    act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('Two') } }));
    await act(async () => $<HTMLButtonElement>('.edit-toolbar button[aria-label="Style"]')!.click());
    expect($('dialog.edit-style')).not.toBeNull();
    await choose('text', 'justify');
    await act(async () => $<HTMLFormElement>('dialog.edit-style form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(changes.at(-1)).toBe(`${FRONT}One.\n\n:::{style}\n---\ntext: justify\n---\nTwo.\n:::\n`);
    expect($('dialog.edit-style')).toBeNull();
  });

  it('opens on the block the cursor is in with what it sets, and changes its options only', async () => {
    const { view, changes } = await open('Before.\n\n:::{style}\n---\ntext: justify\n---\nBody.\n:::\n');
    act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('Body') } }));
    await act(async () => $<HTMLButtonElement>('.edit-toolbar button[aria-label="Style"]')!.click());
    expect($<HTMLSelectElement>('dialog.edit-style select[name="text"]')!.value).toBe('justify');
    expect($<HTMLButtonElement>('dialog.edit-style button[type="submit"]')!.textContent).toBe('Apply');
    await choose('text', '');
    await choose('font', 'serif');
    await act(async () => $<HTMLFormElement>('dialog.edit-style form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(changes.at(-1)).toBe('Before.\n\n:::{style}\n---\nfont: serif\n---\nBody.\n:::\n');
  });
});

describe('a style block in edit mode', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });
  const NOTE = `${FRONT}Before.\n\n:::{style}\n---\ntext: justify\nheadings: center\n---\n# Ata\n\nO condomínio deliberou.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n:::\n\nAfter.\n`;

  async function open(markdown: string): Promise<EditorView> {
    mounted = await mount(<NoteEditor markdown={markdown} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
  }

  it('is read with its fences and options apart from its content, which keeps its own headings', () => {
    const constructs = analyze(NOTE).constructs;
    const block = constructs.find((each) => each.kind === 'styleBlock');
    expect(block).toMatchObject({ style: { text: 'justify', headings: 'center' }, depth: 0 });
    expect(constructs.filter((each) => each.kind === 'heading').map((each) => NOTE.slice(each.from, each.to))).toEqual(['# Ata']);
    expect(constructs.some((each) => each.kind === 'rule')).toBe(false);
  });

  it('draws what it sets in place of its fence and options while the author is elsewhere, and its content in its style', async () => {
    const view = await open(NOTE);
    const summary = view.dom.querySelector('.edit-style-summary');
    expect(summary?.textContent).toContain('Headings: Centered');
    expect(summary?.textContent).toContain('Text: Justified');
    expect(view.contentDOM.textContent).not.toContain(':::');
    expect(view.contentDOM.textContent).not.toContain('text: justify');
    expect(view.dom.querySelector('.cm-ms-style-end')).not.toBeNull();
    const styled = [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-line.cm-ms-styled')];
    expect(styled.map((line) => line.textContent)).toContain('O condomínio deliberou.');
    expect(styled[0]?.style.getPropertyValue('--ms-align-text')).toBe('justify');
    expect(styled[0]?.getAttribute('lang')).toBe('en-US');
    // A block it holds is drawn in its style too.
    expect(view.dom.querySelector<HTMLElement>('.cm-ms-block .edit-table')?.closest<HTMLElement>('.cm-ms-block')?.style.getPropertyValue('--ms-align-headings')).toBe('center');
    // Nothing outside it is.
    const after = [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-line')].find((line) => line.textContent === 'After.');
    expect(after?.classList.contains('cm-ms-styled')).toBe(false);
  });

  it('shows its fence and options as written when the author is on them', async () => {
    const view = await open(NOTE);
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: NOTE.indexOf('text: justify') } });
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(view.contentDOM.textContent).toContain(':::{style}');
    expect(view.contentDOM.textContent).toContain('text: justify');
    expect(view.dom.querySelector('.edit-style-summary')).toBeNull();
  });
});
