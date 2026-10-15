/**
 * Attaching in edit mode (#75, #78): the paperclip opens a dialog with three ways in — a file from
 * the computer, kept by the host's `attach` under the name and with the description the author
 * gives; a file the notebook keeps, listed by the host's `files`; an image at a web address — and a
 * file pasted or dropped is attached directly, under its own name.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import type { KeptFileEntry, NoteHost } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

const NOTE = 'Text.\n';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);
const $$ = <T extends Element>(selector: string) => [...mounted!.container.querySelectorAll<T>(selector)];

async function open(host: NoteHost, changes: string[]): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={NOTE} {...host} onChange={(text) => void changes.push(text)} />);
  for (let i = 0; i < 50 && !$('.cm-editor'); i++) await act(async () => new Promise((done) => setTimeout(done, 10)));
  const view = EditorView.findFromDOM($<HTMLElement>('.cm-editor')!)!;
  await act(async () => view.dispatch({ selection: { anchor: NOTE.length } }));
  return view;
}

const paperclip = () => $<HTMLButtonElement>('button[aria-label="Attach a file"]')!;
async function openDialog(): Promise<void> {
  await act(async () => paperclip().click());
}
const tabs = () => $$<HTMLButtonElement>('.edit-attach [role="tab"]').map((tab) => tab.textContent);
async function tab(name: string): Promise<void> {
  await act(async () => $$<HTMLButtonElement>('.edit-attach [role="tab"]').find((each) => each.textContent === name)!.click());
  await settle();
}

/** Types into a field as React sees it. */
async function fill(field: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function choose(files: File[]): Promise<void> {
  const picker = $<HTMLInputElement>('.edit-attach input[type="file"]')!;
  Object.defineProperty(picker, 'files', { value: files, configurable: true });
  await act(async () => picker.dispatchEvent(new Event('change', { bubbles: true })));
}

async function submit(): Promise<void> {
  await act(async () => $<HTMLButtonElement>('.edit-attach button[type="submit"]')!.click());
  await settle();
}

const file = (name: string, type = 'image/png') => new File(['bytes'], name, { type });

describe('the attach dialog (#78)', () => {
  it('offers only the web without a host that keeps or lists files, and gives the focus back on closing', async () => {
    await open({}, []);
    await openDialog();
    expect($('dialog.edit-attach')!.getAttribute('aria-modal')).toBe('true');
    expect(tabs()).toEqual(['From the web']);
    await act(async () => $<HTMLButtonElement>('.edit-attach .edit-source-close')!.click());
    expect($('dialog.edit-attach')).toBeNull();
    expect(document.activeElement).toBe(paperclip());
  });

  it('keeps files from the computer under the names and with the descriptions the author gives', async () => {
    const changes: string[] = [];
    const attach = vi.fn(async (_each: File, attributes: { name: string; description: string }) => `kept ${attributes.name}`);
    await open({ attach, files: () => [] }, changes);
    await openDialog();
    expect(tabs()).toEqual(['From the computer', 'From the notebook', 'From the web']);
    await choose([file('a.png'), file('b.pdf', 'application/pdf')]);
    expect($$('.edit-attach-file-kind').map((each) => each.textContent)).toEqual(['PNG image · 5 byte', 'PDF document · 5 byte']);
    const fields = $$<HTMLInputElement>('.edit-attach-file input');
    await fill(fields[0]!, 'zones.png');
    await fill(fields[1]!, 'The zones');
    await submit();
    expect(attach.mock.calls.map(([each, attributes]) => [each.name, attributes])).toEqual([
      ['a.png', { name: 'zones.png', description: 'The zones' }],
      ['b.pdf', { name: 'b.pdf', description: '' }],
    ]);
    expect(changes.at(-1)).toBe('Text.\n\n![[kept zones.png]]\n\n![[kept b.pdf]]\n');
    expect($('dialog.edit-attach')).toBeNull();
  });

  it('writes nothing for a file the host could not keep, and says so on the paperclip', async () => {
    const changes: string[] = [];
    await open({ attach: () => Promise.reject(new Error('full')) }, changes);
    await openDialog();
    await choose([file('a.png')]);
    await submit();
    expect(changes).toEqual([]);
    expect(paperclip().dataset['attach']).toBe('failed');
    expect(paperclip().title).toBe('The file was not attached');
  });

  it('lists the files the notebook keeps, finds them by name or description, and embeds the one chosen', async () => {
    const changes: string[] = [];
    const kept: KeptFileEntry[] = [
      { name: 'zones.png', mimeType: 'image/png', bytes: 2048, url: '/zones.png', description: 'The failure domains' },
      { name: 'talk.mp3', mimeType: 'audio/mpeg', bytes: 4096, url: '/talk.mp3' },
    ];
    await open({ files: async () => kept }, changes);
    await openDialog();
    await tab('From the notebook');
    expect($$('.edit-attach-item-name').map((each) => each.textContent)).toEqual(['talk.mp3', 'zones.png']);
    expect($('.edit-attach-preview img')!.getAttribute('src')).toBe('/zones.png');
    await fill($<HTMLInputElement>('.edit-attach input[type="search"]')!, 'failure');
    expect($$('.edit-attach-item-name').map((each) => each.textContent)).toEqual(['zones.png']);
    await fill($<HTMLInputElement>('.edit-attach input[type="search"]')!, 'nothing');
    expect($('.edit-attach-note')!.textContent).toBe('No file matches.');
    await fill($<HTMLInputElement>('.edit-attach input[type="search"]')!, '');
    await act(async () => $$<HTMLButtonElement>('.edit-attach-item')[1]!.click());
    await settle();
    expect(changes.at(-1)).toBe('Text.\n\n![[zones.png]]\n');
  });

  it('writes an image of the web, refusing an address that is not one', async () => {
    const changes: string[] = [];
    await open({}, changes);
    await openDialog();
    const [address, name] = $$<HTMLInputElement>('.edit-attach input');
    await fill(address!, 'javascript:alert(1)');
    await submit();
    expect($('.edit-attach-error')!.textContent).toBe('An address on the web starts with https:// or http://.');
    expect(changes).toEqual([]);
    await fill(address!, 'https://example.org/vine yard.png');
    await fill(name!, 'Vines [south]');
    await submit();
    expect(changes.at(-1)).toBe('Text.\n\n![Vines \\[south\\]](https://example.org/vine%20yard.png)\n');
  });

  it('attaches a file pasted into the note under its own name', async () => {
    const changes: string[] = [];
    const attach = vi.fn(() => 'pasted.png');
    const view = await open({ attach }, changes);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file('screen.png')], getData: () => '' } });
    await act(async () => view.contentDOM.dispatchEvent(paste));
    await settle();
    expect(attach).toHaveBeenCalledWith(expect.any(File), { name: 'screen.png', description: '' });
    expect(changes.at(-1)).toBe('Text.\n\n![[pasted.png]]\n');
  });
});
