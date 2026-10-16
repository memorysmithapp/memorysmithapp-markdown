/**
 * The buttons a note draws around its text follow one option (#96): Show Markdown, Copy Markdown
 * and the switch at its top right, and Copy in the dialog of Show Markdown, drawn as their icon
 * alone, their icon and their word, or their word only on a wide note, and named by their word
 * wherever it is not drawn or may be hidden.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { NoteBody, type NoteButtons } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

const NOTE = '# Title\n\nSome text.\n';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);

async function editor(): Promise<EditorView> {
  for (let i = 0; i < 50; i++) {
    const element = $<HTMLElement>('.cm-editor');
    if (element) return EditorView.findFromDOM(element)!;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  throw new Error('the editor never opened');
}

/** Each button of the corner, then the dialog's Copy once Show Markdown opened it. */
async function buttons(): Promise<HTMLButtonElement[]> {
  const corner = [...$('.note-corner')!.querySelectorAll<HTMLButtonElement>('button')];
  await act(async () => corner[0]!.click());
  return [...corner, $<HTMLButtonElement>('.edit-source-copy')!];
}

const face = (button: HTMLButtonElement) => ({
  display: button.dataset['buttons'],
  name: button.getAttribute('aria-label'),
  title: button.title,
  icon: button.querySelector('svg') !== null,
  word: button.querySelector('.note-button-word')?.textContent ?? null,
});

describe('the buttons around a note', () => {
  it('are their icon alone by default, each named by its word, the dialog\'s Copy included', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable />);
    expect((await buttons()).map(face)).toEqual(
      ['Show Markdown', 'Copy Markdown', 'Edit', 'Copy'].map((word) => ({ display: 'icon', name: word, title: word, icon: true, word: null })),
    );
    expect($('.has-responsive-buttons')).toBeNull();
  });

  it('are their icon and their word with `label`, the word then their name', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable buttons="label" />);
    const all = await buttons();
    // Copy Markdown keeps its name while its title says it copied.
    expect(all.map(face)).toEqual(
      ['Show Markdown', 'Copy Markdown', 'Edit', 'Copy'].map((word) => ({ display: 'label', name: word === 'Copy Markdown' ? word : null, title: word, icon: true, word })),
    );
    expect(all[3]!.classList).toContain('edit-control-labelled');
  });

  it('carry their word and their name with `responsive`, in a note and a dialog that are its containers', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable buttons="responsive" />);
    expect((await buttons()).map(face)).toEqual(
      ['Show Markdown', 'Copy Markdown', 'Edit', 'Copy'].map((word) => ({ display: 'responsive', name: word, title: word, icon: true, word })),
    );
    expect($('.markdown')!.classList).toContain('has-responsive-buttons');
    expect($('dialog.edit-source')!.classList).toContain('has-responsive-buttons');
  });

  it('measure the bar in edit mode with `responsive`, never the editor, which holds the fixed menu', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable buttons="responsive" defaultMode="edit" />);
    await editor();
    expect($('.edit-bar')!.classList).toContain('has-responsive-buttons');
    expect($('.markdown-editing')!.classList).not.toContain('has-responsive-buttons');
    expect([...$('.edit-corner .note-corner')!.querySelectorAll<HTMLButtonElement>('button')].map((each) => each.dataset['buttons'])).toEqual([
      'responsive',
      'responsive',
      'responsive',
    ]);
  });

  it('follow `modeButton` when `buttons` is left out, and `buttons` over it', async () => {
    const displays = async (props: { buttons?: NoteButtons; modeButton?: 'icon' | 'label' }) => {
      mounted?.unmount();
      mounted = await mount(<NoteBody markdown={NOTE} editable {...props} />);
      return [...$('.note-corner')!.querySelectorAll<HTMLButtonElement>('button')].map((each) => each.dataset['buttons']);
    };
    expect(await displays({ modeButton: 'label' })).toEqual(['label', 'label', 'label']);
    expect(await displays({ modeButton: 'label', buttons: 'icon' })).toEqual(['icon', 'icon', 'icon']);
    mounted?.unmount();
    mounted = null;
  });

  it('follow `buttons` on the editor used alone', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} buttons="label" />);
    await editor();
    expect([...$('.edit-corner')!.querySelectorAll<HTMLButtonElement>('.note-action')].map((each) => each.textContent)).toEqual([
      'Show Markdown',
      'Copy Markdown',
    ]);
  });
});
