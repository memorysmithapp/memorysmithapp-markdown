/**
 * The edit toolbar, the note's Markdown and the saves of an edit, as an author meets them: the
 * toolbar is joined to the switch and only there in edit mode (#62), the toolbar's button shows
 * the Markdown in a dialog (#63), and the editor says whether the last change was saved, going
 * back to reading only once it was (#64).
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { NoteBody } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

const NOTE = '---\nname: A note\n---\n# Title\n\nSome text.\n';

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

/** Types at the end of the note, as the author does. */
async function type(view: EditorView, text: string): Promise<void> {
  await act(async () => view.dispatch({ changes: { from: view.state.doc.length, insert: text }, userEvent: 'input.type' }));
}

/** A save the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const status = () => $<HTMLElement>('.edit-save')!;
/** What whoever hears the page is told of the save. */
const said = () => $<HTMLElement>('.edit-save [role="status"]')!.textContent;

describe('the toolbar and the switch (#62, #65)', () => {
  it('draws the toolbar only in edit mode, the switch its last control', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable />);
    expect($('.edit-toolbar')).toBeNull();
    await act(async () => $<HTMLButtonElement>('.mode-switch')!.click());
    await editor();
    // The switch is the toolbar's last control, at its end, the save's status just before it (#65).
    const toolbar = $('.edit-bar > .edit-toolbar')!;
    const corner = toolbar.lastElementChild!;
    expect(corner.classList.contains('edit-corner')).toBe(true);
    expect([...corner.children].map((child) => child.className.split(' ')[0])).toEqual(['edit-save', 'mode-switch']);
    await act(async () => $<HTMLButtonElement>('.mode-switch')!.click());
    await settle();
    expect($('.edit-toolbar')).toBeNull();
    expect($('.edit-bar')).toBeNull();
  });
});

describe("the note's Markdown (#63)", () => {
  it('opens from the toolbar, shows the bytes as saved, copies them, and closes back on its button', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const crlf = NOTE.replace(/\n/g, '\r\n');
    mounted = await mount(<NoteEditor markdown={crlf} />);
    const view = await editor();
    await type(view, 'More.');
    const button = $<HTMLButtonElement>('button[aria-label="Markdown"]')!;
    await act(async () => button.click());
    const dialog = $<HTMLDialogElement>('dialog.edit-source')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('edit-source-title');
    expect($('.edit-source-text')!.textContent).toBe(`${crlf}More.`);

    await act(async () => [...dialog.querySelectorAll('button')].find((each) => each.textContent === 'Copy')!.click());
    await settle();
    expect(writeText).toHaveBeenCalledWith(`${crlf}More.`);
    expect($('.edit-source-copied')!.textContent).toBe('Copied');

    await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect($('dialog.edit-source')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes with its button, and with a click outside its frame', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} />);
    await editor();
    const open = async () => act(async () => $<HTMLButtonElement>('button[aria-label="Markdown"]')!.click());
    await open();
    await act(async () => $<HTMLButtonElement>('.edit-source-close')!.click());
    expect($('dialog.edit-source')).toBeNull();
    await open();
    await act(async () => $<HTMLDialogElement>('dialog.edit-source')!.click());
    expect($('dialog.edit-source')).toBeNull();
    await open();
    await act(async () => $<HTMLElement>('.edit-source-text')!.click());
    expect($('dialog.edit-source')).not.toBeNull();
  });
});

describe('Undo all changes (#67)', () => {
  it('gives back the note as edit mode opened it, in one change that Undo reverses', async () => {
    const crlf = NOTE.replace(/\n/g, '\r\n');
    const handed: string[] = [];
    mounted = await mount(<NoteEditor markdown={crlf} onChange={(text) => void handed.push(text)} />);
    const view = await editor();
    const revert = () => $<HTMLButtonElement>('button[aria-label="Undo all changes"]')!;
    // Before the toolbar's button for Undo, and idle while nothing changed.
    expect(revert().nextElementSibling?.getAttribute('aria-label')).toBe('Undo');
    expect(revert().disabled).toBe(true);
    await type(view, 'One.');
    await act(async () => view.dispatch({ changes: { from: 0, insert: 'X' }, userEvent: 'input.type' }));
    expect(revert().disabled).toBe(false);

    await act(async () => revert().click());
    expect(handed.at(-1)).toBe(crlf);
    expect(handed).toHaveLength(3);
    expect(revert().disabled).toBe(true);

    await act(async () => $<HTMLButtonElement>('button[aria-label="Undo"]')!.click());
    expect(handed.at(-1)).toBe(`X${crlf}One.`);
  });
});

describe('the save of an edit (#64)', () => {
  it('says nothing for a host that answers with nothing', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} onChange={() => undefined} />);
    await type(await editor(), 'x');
    expect(status().dataset['save']).toBe('idle');
    expect(said()).toBe('');
    // The slot of the icon is there, empty, so a status that comes never moves the toolbar.
    expect($('.edit-save-icon')!.childElementCount).toBe(0);
  });

  it('says Saving… and then Saved, for the latest change only', async () => {
    const saves: ReturnType<typeof deferred>[] = [];
    mounted = await mount(
      <NoteEditor
        markdown={NOTE}
        onChange={() => {
          saves.push(deferred());
          return saves.at(-1)!.promise;
        }}
      />,
    );
    const view = await editor();
    await type(view, 'a');
    expect(said()).toBe('Saving…');
    await type(view, 'b');
    // The first save lands while the second is in flight: the last change is not saved yet.
    await act(async () => saves[0]!.resolve());
    expect(said()).toBe('Saving…');
    await act(async () => saves[1]!.resolve());
    expect(status().dataset['save']).toBe('saved');
    expect(said()).toBe('Saved');
  });

  it('says Not saved when the save fails, and hands the last text again on Try again', async () => {
    const handed: string[] = [];
    let fail = true;
    mounted = await mount(
      <NoteEditor
        markdown={NOTE}
        onChange={(text) => {
          handed.push(text);
          return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
        }}
      />,
    );
    await type(await editor(), 'x');
    await settle();
    expect(status().dataset['save']).toBe('failed');
    expect(said()).toBe('Not saved');
    fail = false;
    await act(async () => $<HTMLButtonElement>('.edit-save-retry')!.click());
    await settle();
    expect(handed).toEqual([`${NOTE}x`, `${NOTE}x`]);
    expect(said()).toBe('Saved');
  });

  it('goes back to reading once the save in flight lands', async () => {
    const save = deferred();
    mounted = await mount(<NoteBody markdown={NOTE} editable defaultMode="edit" onChange={() => save.promise} />);
    await type(await editor(), 'x');
    await act(async () => $<HTMLButtonElement>('.mode-switch')!.click());
    await settle();
    expect($('.cm-editor')).not.toBeNull();
    expect($('.edit-corner')!.getAttribute('aria-busy')).toBe('true');
    await act(async () => save.resolve());
    await settle();
    expect($('.cm-editor')).toBeNull();
  });

  it('stays in edit after a failed save, and says why', async () => {
    const onModeChange = vi.fn();
    mounted = await mount(<NoteBody markdown={NOTE} editable defaultMode="edit" onModeChange={onModeChange} onChange={() => Promise.reject(new Error('offline'))} />);
    await type(await editor(), 'x');
    await settle();
    await act(async () => $<HTMLButtonElement>('.mode-switch')!.click());
    await settle();
    expect($('.cm-editor')).not.toBeNull();
    expect(onModeChange).not.toHaveBeenCalled();
    expect(said()).toBe('Not saved: the note stays in edit');
    // The icon alone is the retry, named by what happened and what it does (#66).
    const retry = $<HTMLButtonElement>('button.edit-save-icon.edit-save-retry')!;
    expect(retry.getAttribute('aria-label')).toBe('Not saved: the note stays in edit. Try again');
    expect(retry.title).toBe(retry.getAttribute('aria-label'));
    expect(retry.textContent).toBe('');
    expect(retry.querySelector('svg')).not.toBeNull();
  });

  it('never takes back what the author typed when the host gives back an older save', async () => {
    let rerender!: (markdown: string) => Promise<void>;
    const Host = ({ markdown }: { markdown: string }) => <NoteEditor markdown={markdown} onChange={() => Promise.resolve()} />;
    mounted = await mount(<Host markdown={NOTE} />);
    rerender = async (markdown) => act(async () => mounted!.root.render(<Host markdown={markdown} />));
    const view = await editor();
    await type(view, 'a');
    await type(view, 'b');
    // The host saved the first change and passes it back while the second is still in flight.
    await rerender(`${NOTE}a`);
    expect(view.state.doc.toString()).toBe(`${NOTE}ab`);
    // A change of its own, such as another device's, is still taken in.
    await rerender(`X${NOTE}ab`);
    expect(view.state.doc.toString()).toBe(`X${NOTE}ab`);
  });
});
