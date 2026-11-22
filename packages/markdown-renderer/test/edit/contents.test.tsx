/**
 * A `contents` block in the editor (`SPEC.md` §7.17, #173): its settings written from the form,
 * inserted at the cursor or changed in the block the cursor is in, and the block drawn as the
 * contents it draws on the screen while the author is elsewhere.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { contentsBlockAt, contentsText, newContentsBlock, setContents } from '../../src/edit/contents.js';
import { contentsFields, contentsSettings } from '../../src/edit/ContentsDialog.js';
import { readContents } from '../../src/contents.js';
import { applyChanges } from '../../src/edit/table.js';
import { mount, type Mounted } from '../render.js';

const FRONT = '---\nname: Ata\n---\n';

describe('the lines of a contents block', () => {
  it('writes only what the settings set, and nothing for the classic contents', () => {
    expect(contentsText({})).toBe('');
    expect(contentsText({ headings: {} })).toBe('');
    expect(contentsText({ headings: { title: 'Sumário', depth: 2 }, place: 'start', screen: 'none', print: { headings: { depth: 3 }, place: 'end' } })).toBe(
      'headings:\n  title: Sumário\n  depth: 2\nplace: start\nscreen: none\nprint:\n  headings:\n    depth: 3\n  place: end\n',
    );
  });

  it('reads back what it writes', () => {
    const settings = { headings: { title: 'Índice', depth: 4 }, print: { place: 'start' as const } };
    expect(readContents(contentsText(settings)).settings).toEqual(settings);
  });

  it('finds the block the cursor is in, and rewrites its lines and nothing else', () => {
    const text = 'Before.\n\n```contents\nheadings:\n  depth: 2\n```\n\nAfter.\n';
    const block = contentsBlockAt(text, text.indexOf('depth'))!;
    expect(block.settings).toEqual({ headings: { depth: 2 } });
    expect(contentsBlockAt(text, 2)).toBeNull();
    expect(applyChanges(text, setContents(block, { screen: 'none' }))).toBe('Before.\n\n```contents\nscreen: none\n```\n\nAfter.\n');
    expect(applyChanges(text, setContents(block, {}))).toBe('Before.\n\n```contents\n```\n\nAfter.\n');
    expect(newContentsBlock({})).toBe('```contents\n```');
  });

  it('turns the form into settings and back, a field at the notebook writing nothing', () => {
    const settings = { headings: { title: 'Sumário' }, print: { headings: { depth: 3 }, place: 'start' as const }, screen: 'none' as const };
    const fields = contentsFields(settings);
    expect(fields.media.print.mode).toBe('own');
    expect(fields.media.screen.mode).toBe('none');
    expect(contentsSettings(fields)).toEqual(settings);
    expect(contentsSettings(contentsFields({}))).toEqual({});
  });
});

describe('the contents control of the editor', () => {
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
  const choose = async (selector: string, value: string): Promise<void> => {
    const field = $<HTMLSelectElement | HTMLInputElement>(`dialog.edit-contents ${selector}`)!;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')!.set!;
    setter.call(field, value);
    await act(async () => field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })));
  };
  const submit = async (): Promise<void> => {
    await act(async () => $<HTMLFormElement>('dialog.edit-contents form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };

  it('inserts a block at the cursor from the toolbar, without the author typing the notation', async () => {
    const { view, changes } = await open(`${FRONT}Resumo.\n\n\n# Abertura\n`);
    act(() => view.dispatch({ selection: { anchor: `${FRONT}Resumo.\n\n`.length } }));
    await act(async () => $<HTMLButtonElement>('.edit-toolbar button[aria-label="Contents"]')!.click());
    expect($('dialog.edit-contents')).not.toBeNull();
    await choose('input[name="title"]', 'Sumário');
    await choose('select[name="print"]', 'own');
    await choose('fieldset[data-medium="print"] select[name="place"]', 'start');
    await submit();
    expect(changes.at(-1)).toBe(`${FRONT}Resumo.\n\n\`\`\`contents\nheadings:\n  title: Sumário\nprint:\n  place: start\n\`\`\`\n\n# Abertura\n`);
    expect($('dialog.edit-contents')).toBeNull();
  });

  it('opens on the block the cursor is in with what it sets, and changes its lines only', async () => {
    const { view, changes } = await open('Before.\n\n```contents\nheadings:\n  depth: 2\n```\n\n# A\n');
    act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('depth') } }));
    await act(async () => $<HTMLButtonElement>('.edit-toolbar button[aria-label="Contents"]')!.click());
    expect($<HTMLSelectElement>('dialog.edit-contents select[name="depth"]')!.value).toBe('2');
    expect($<HTMLButtonElement>('dialog.edit-contents button[type="submit"]')!.textContent).toBe('Apply');
    await choose('select[name="depth"]', '');
    await choose('select[name="screen"]', 'none');
    await submit();
    expect(changes.at(-1)).toBe('Before.\n\n```contents\nscreen: none\n```\n\n# A\n');
  });
});

describe('a contents block in edit mode', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  async function open(markdown: string): Promise<EditorView> {
    mounted = await mount(<NoteEditor markdown={markdown} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
  }

  it('draws the contents of the note as it is while the author is elsewhere', async () => {
    const view = await open(`${FRONT}Resumo.\n\n\`\`\`contents\n\`\`\`\n\n# Abertura\n\n## Pauta\n`);
    const nav = view.dom.querySelector('.cm-ms-block nav.contents');
    expect(nav).not.toBeNull();
    expect([...nav!.querySelectorAll('.contents-entry')].map((entry) => entry.textContent)).toEqual(['Abertura', 'Pauta']);
    expect(view.contentDOM.textContent).not.toContain('```contents');
  });

  it('says where it is drawn when it draws nothing here', async () => {
    const view = await open(`${FRONT}\`\`\`contents\nscreen: none\nprint:\n  place: start\n\`\`\`\n\n# Abertura\n`);
    expect(view.dom.querySelector('.contents-elsewhere')?.textContent).toBe('Contents: at the start in print');
  });

  it('shows its lines when the author is on them', async () => {
    const note = `${FRONT}\`\`\`contents\nheadings:\n  depth: 2\n\`\`\`\n\n# Abertura\n`;
    const view = await open(note);
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: note.indexOf('depth') } });
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(view.contentDOM.textContent).toContain('depth: 2');
    expect(view.dom.querySelector('nav.contents')).toBeNull();
  });
});
