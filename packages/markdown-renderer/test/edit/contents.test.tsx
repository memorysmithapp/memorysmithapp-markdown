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
import { captionText, setTableCaption } from '../../src/edit/blocks.js';
import { analyze, type Construct } from '../../src/edit/analyze.js';
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

describe('the lists of the form and the caption of a table (#175)', () => {
  it('writes the lists chosen, a bare one included, and the headings alone as nothing', () => {
    expect(contentsText({ figures: {} })).toBe('figures:\n');
    const fields = contentsFields({});
    fields.root.lists.figures = true;
    fields.root.titles.figures = 'Fotos';
    expect(contentsSettings(fields)).toEqual({ headings: {}, figures: { title: 'Fotos' } });
    expect(contentsText(contentsSettings(fields))).toBe('headings:\nfigures:\n  title: Fotos\n');
  });

  it('names a medium lists only where they differ from the root, and all of them when it does', () => {
    const fields = contentsFields({ headings: {}, tables: {} });
    fields.media.print = { mode: 'own', layer: { ...fields.root, lists: { ...fields.root.lists }, place: 'start' } };
    expect(contentsSettings(fields)).toEqual({ headings: {}, tables: {}, print: { place: 'start' } });
    fields.media.print.layer.lists.tables = false;
    expect(contentsSettings(fields)).toEqual({ headings: {}, tables: {}, print: { headings: {}, place: 'start' } });
    expect(contentsText(contentsSettings(fields))).toBe('headings:\ntables:\nprint:\n  headings:\n  place: start\n');
  });

  it('writes, rewrites and takes out a table caption after a blank line', () => {
    const captionOf = (text: string) => (analyze(text).constructs.find((each) => each.kind === 'table') as Extract<Construct, { kind: 'table' }>).caption;
    const text = '| a |\n|---|\n| 1 |\n\nAfter.\n';
    const end = text.indexOf('| 1 |') + 5;
    expect(captionOf(text)).toBeNull();
    const once = applyChanges(text, setTableCaption(text, end, null, 'Previsão'));
    expect(once).toBe('| a |\n|---|\n| 1 |\n\nTable: Previsão\n\nAfter.\n');
    expect(captionOf(once)).toEqual({ from: end + 2, to: end + '\n\nTable: Previsão'.length });
    expect(captionText(once, captionOf(once)!)).toBe('Previsão');
    const again = applyChanges(once, setTableCaption(once, end, captionOf(once), 'Votação'));
    expect(again).toBe('| a |\n|---|\n| 1 |\n\nTable: Votação\n\nAfter.\n');
    expect(applyChanges(again, setTableCaption(again, end, captionOf(again), ''))).toBe(text);
    expect(setTableCaption(text, end, null, '  ')).toEqual([]);
    // A caption written otherwise is left as written until the author changes it.
    const loose = '| a |\n|---|\n| 1 |\n\nTABLE:  Previsão\nde despesas\n';
    expect(captionText(loose, captionOf(loose)!)).toBe('Previsão de despesas');
    expect(setTableCaption(loose, end, captionOf(loose), 'Previsão de despesas')).toEqual([]);
    expect(applyChanges(loose, setTableCaption(loose, end, captionOf(loose), 'Gastos'))).toBe('| a |\n|---|\n| 1 |\n\nTable: Gastos\n');
  });

  it('reads no caption on a row, nor on a paragraph that does not start with Table:', () => {
    const tables = (text: string) => analyze(text).constructs.filter((each): each is Extract<Construct, { kind: 'table' }> => each.kind === 'table');
    expect(tables('| a |\n|---|\n| 1 |\nTable: a row\n')[0]!.caption).toBeNull();
    expect(tables('| a |\n|---|\n| 1 |\n\nThe Table: below\n')[0]!.caption).toBeNull();
    expect(tables('| a |\n|---|\n| 1 |\n\n# Table: a heading\n')[0]!.caption).toBeNull();
  });
});

describe('the caption of a table in edit mode (#182)', () => {
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
  const type = async (field: HTMLInputElement, value: string): Promise<void> => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(field, value);
    await act(async () => field.dispatchEvent(new Event('input', { bubbles: true })));
    await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    for (let i = 0; i < 3; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  };
  const TABLE = '| Item | Valor |\n|---|---:|\n| Obra | 120 |\n';

  it('draws the caption as its field alone, never as a line of the editor', async () => {
    const { view } = await open(`${FRONT}${TABLE}\nTable: Previsão de despesas\n\nDepois.\n`);
    const fields = view.dom.querySelectorAll<HTMLInputElement>('.edit-table-caption input');
    expect(fields).toHaveLength(1);
    expect(fields[0]!.value).toBe('Previsão de despesas');
    expect(view.contentDOM.textContent).not.toContain('Table:');
    expect(view.contentDOM.textContent).toContain('Depois.');
  });

  it('gives every table the field, empty with no caption, and writes and takes out the paragraph from it', async () => {
    const note = `${FRONT}${TABLE}\nDepois.\n`;
    const { view, changes } = await open(note);
    const field = () => view.dom.querySelector<HTMLInputElement>('.edit-table-caption input')!;
    expect(field().value).toBe('');
    await type(field(), 'Previsão de despesas');
    expect(changes.at(-1)).toBe(`${FRONT}${TABLE}\nTable: Previsão de despesas\n\nDepois.\n`);
    expect(view.contentDOM.textContent).not.toContain('Table:');
    expect(field().value).toBe('Previsão de despesas');
    await type(field(), '');
    expect(changes.at(-1)).toBe(note);
  });

  it('shows the paragraph among the table lines when the author is on the table', async () => {
    const note = `${FRONT}${TABLE}\nTable: Previsão\n`;
    const { view } = await open(note);
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: note.indexOf('Obra') } });
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(view.contentDOM.textContent).toContain('Table: Previsão');
    expect(view.dom.querySelector('.edit-table-caption')).toBeNull();
  });
});
