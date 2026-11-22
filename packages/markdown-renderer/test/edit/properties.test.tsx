/**
 * A `properties` block in the editor (`SPEC.md` §7.18, #172): its settings written from the form,
 * the note's keys to choose and order, inserted at the cursor or changed in the block the cursor is
 * in, and the block drawn as the entries it draws on the screen while the author is elsewhere.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { newPropertiesBlock, propertiesBlockAt, propertiesText, setProperties } from '../../src/edit/properties.js';
import { propertiesFields, propertiesSettings } from '../../src/edit/PropertiesDialog.js';
import { readPropertiesBlock } from '../../src/properties-block.js';
import { applyChanges } from '../../src/edit/table.js';
import { mount, type Mounted } from '../render.js';

const FRONT = '---\nname: Ata\nstatus: aprovada\ndata: 2026-11-20\nresponsavel: Síndico\n---\n';

describe('the lines of a properties block', () => {
  it('writes only what the settings set, and reads it back', () => {
    const settings = { keys: ['status', 'data'], fold: 'closed' as const, print: { place: 'end' as const, title: 'Registro' }, screen: 'none' as const };
    expect(propertiesText(settings)).toBe('keys: status, data\nfold: closed\nscreen: none\nprint:\n  title: Registro\n  place: end\n');
    expect(readPropertiesBlock(propertiesText(settings)).settings).toEqual(settings);
    expect(newPropertiesBlock({})).toBe('```properties\n```');
  });

  it('finds the block the cursor is in, and rewrites its lines and nothing else', () => {
    const text = `${FRONT}Before.\n\n\`\`\`properties\nkeys: status\n\`\`\`\n\nAfter.\n`;
    const block = propertiesBlockAt(text, text.indexOf('keys'))!;
    expect(block.settings).toEqual({ keys: ['status'] });
    expect(applyChanges(text, setProperties(block, { fold: 'open' }))).toBe(`${FRONT}Before.\n\n\`\`\`properties\nfold: open\n\`\`\`\n\nAfter.\n`);
  });

  it('offers the note keys, the chosen first in their order, and writes the ones chosen', () => {
    const fields = propertiesFields({ keys: ['responsavel', 'status'] }, ['name', 'status', 'data', 'responsavel']);
    expect(fields.root.keys).toEqual([
      { key: 'responsavel', chosen: true },
      { key: 'status', chosen: true },
      { key: 'name', chosen: false },
      { key: 'data', chosen: false },
    ]);
    fields.root.keys[3]!.chosen = true;
    expect(propertiesSettings(fields)).toEqual({ keys: ['responsavel', 'status', 'data'] });
    fields.root.some = false;
    expect(propertiesSettings(fields)).toEqual({});
  });
});

describe('the properties control of the editor', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });
  const $ = <T extends Element>(selector: string): T | null => mounted!.container.ownerDocument.querySelector<T>(selector);

  it('inserts a block from the toolbar with the keys chosen and moved, without the author typing the notation', async () => {
    const changes: string[] = [];
    mounted = await mount(<NoteEditor markdown={`${FRONT}Body.\n\n\nEnd.\n`} onChange={(next) => changes.push(next)} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    const view = EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
    act(() => view.dispatch({ selection: { anchor: `${FRONT}Body.\n\n`.length } }));
    await act(async () => $<HTMLButtonElement>('.edit-toolbar button[aria-label="Properties"]')!.click());
    const click = async (selector: string) => act(async () => $<HTMLElement>(`dialog.edit-properties ${selector}`)!.click());
    await click('input[name="all-keys"]');
    await click('input[name="key-data"]');
    await click('input[name="key-responsavel"]');
    await click('button[aria-label="Move responsavel up"]');
    await act(async () => $<HTMLFormElement>('dialog.edit-properties form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(changes.at(-1)).toBe(`${FRONT}Body.\n\n\`\`\`properties\nkeys: responsavel, data\n\`\`\`\n\nEnd.\n`);
  });

  it('draws the entries a block draws while the author is elsewhere, or where they go', async () => {
    mounted = await mount(<NoteEditor markdown={`${FRONT}\`\`\`properties\nkeys: status\n\`\`\`\n\n\`\`\`properties\nscreen: none\nprint:\n  place: end\n\`\`\`\n`} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    const view = EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
    const keys = [...view.dom.querySelectorAll('.cm-ms-block details.properties-box .metadata-property-key')].map((each) => each.textContent);
    expect(keys).toEqual(['status']);
    expect(view.dom.querySelector('.contents-elsewhere')?.textContent).toBe('Properties: at the end in print');
  });
});
