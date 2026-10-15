/**
 * Attaching a file in edit mode (#75): the host's `attach` keeps it and answers its name, which the
 * editor embeds as `![[name]]` on a line of its own; without `attach` there is no attaching.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
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

async function editor(): Promise<EditorView> {
  for (let i = 0; i < 50; i++) {
    const element = $<HTMLElement>('.cm-editor');
    if (element) return EditorView.findFromDOM(element)!;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  throw new Error('the editor never opened');
}

/** Chooses files in the picker the toolbar's button opens. */
async function choose(files: File[]): Promise<void> {
  const picker = $<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(picker, 'files', { value: files, configurable: true });
  await act(async () => picker.dispatchEvent(new Event('change', { bubbles: true })));
  await settle();
}

const file = (name: string, type = 'image/png') => new File(['bytes'], name, { type });

describe('attaching a file (#75)', () => {
  it('offers nothing without the host keeping files', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} />);
    await editor();
    expect($('button[aria-label="Attach a file"]')).toBeNull();
    expect($('input[type="file"]')).toBeNull();
  });

  it('hands each file to the host and embeds it under the name the host answered', async () => {
    const changes: string[] = [];
    const attach = vi.fn(async (each: File) => `kept ${each.name}`);
    mounted = await mount(<NoteEditor markdown={NOTE} attach={attach} onChange={(text) => void changes.push(text)} />);
    const view = await editor();
    await act(async () => view.dispatch({ selection: { anchor: NOTE.length } }));
    expect($('button[aria-label="Attach a file"]')).not.toBeNull();

    await choose([file('a.png'), file('b.pdf', 'application/pdf')]);
    expect(attach.mock.calls.map(([each]) => each.name)).toEqual(['a.png', 'b.pdf']);
    expect(changes.at(-1)).toBe('Text.\n\n![[kept a.png]]\n\n![[kept b.pdf]]\n');
    expect($<HTMLButtonElement>('button[aria-label="Attach a file"]')!.dataset['attach']).toBe('idle');
  });

  it('writes nothing for a file the host could not keep, and says so on the button', async () => {
    const changes: string[] = [];
    mounted = await mount(<NoteEditor markdown={NOTE} attach={() => Promise.reject(new Error('full'))} onChange={(text) => void changes.push(text)} />);
    await editor();
    await choose([file('a.png')]);
    expect(changes).toEqual([]);
    const button = $<HTMLButtonElement>('button[aria-label="Attach a file"]')!;
    expect(button.dataset['attach']).toBe('failed');
    expect(button.title).toBe('The file was not attached');
  });

  it('attaches a file pasted into the note', async () => {
    const changes: string[] = [];
    const attach = vi.fn(() => 'pasted.png');
    mounted = await mount(<NoteEditor markdown={NOTE} attach={attach} onChange={(text) => void changes.push(text)} />);
    const view = await editor();
    await act(async () => view.dispatch({ selection: { anchor: NOTE.length } }));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file('screen.png')], getData: () => '' } });
    await act(async () => view.contentDOM.dispatchEvent(paste));
    await settle();
    expect(attach).toHaveBeenCalledTimes(1);
    expect(changes.at(-1)).toBe('Text.\n\n![[pasted.png]]\n');
  });
});
