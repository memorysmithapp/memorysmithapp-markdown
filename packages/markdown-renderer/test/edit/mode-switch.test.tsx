/**
 * The switch between reading and editing at the top right of a note (#51): drawn only for a note
 * the host made `editable`, as an icon or an icon and its word, in the reader's language; it loads
 * the editor on demand, hands each change to the host, and a theme may draw it.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineTheme, NoteBody } from '../../src/index.js';
import { html, mount, type Mounted } from '../render.js';

const NOTE = '---\nname: A note\n---\n# Title\n\nSome **text**.\n';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Waits for the editor, which is loaded the first time a note is edited. */
async function editor(): Promise<EditorView> {
  for (let i = 0; i < 50; i++) {
    const element = mounted?.container.querySelector<HTMLElement>('.cm-editor');
    if (element) return EditorView.findFromDOM(element)!;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  throw new Error('the editor never opened');
}

const button = () => mounted!.container.querySelector<HTMLButtonElement>('.mode-switch')!;

describe('the switch', () => {
  it('is not drawn for a note that is not editable, which draws as before', () => {
    expect(html(NOTE)).not.toContain('mode-switch');
    expect(html(NOTE, { editable: false })).toBe(html(NOTE));
  });

  it('says its action with its icon and its word, and switches to edit and back', async () => {
    const modes: string[] = [];
    mounted = await mount(<NoteBody markdown={NOTE} editable onModeChange={(mode) => modes.push(mode)} />);
    expect(button().textContent).toBe('Edit');
    expect(button().querySelector('svg')).not.toBeNull();

    await act(async () => button().click());
    await editor();
    expect(button().textContent).toBe('View');
    expect(modes).toEqual(['edit']);

    await act(async () => button().click());
    expect(mounted.container.querySelector('.cm-editor')).toBeNull();
    expect(button().textContent).toBe('Edit');
    expect(modes).toEqual(['edit', 'view']);
  });

  it('is named by its word when it shows its icon alone, in the reader\'s language', async () => {
    mounted = await mount(<NoteBody markdown={NOTE} editable modeButton="icon" strings={{ edit: 'Editar', view: 'Visualizar' }} />);
    expect(button().getAttribute('aria-label')).toBe('Editar');
    expect(button().textContent).toBe('');
    await act(async () => button().click());
    await editor();
    expect(button().getAttribute('aria-label')).toBe('Visualizar');
  });

  it('follows the mode a host controls', async () => {
    const onModeChange = vi.fn();
    mounted = await mount(<NoteBody markdown={NOTE} editable mode="edit" onModeChange={onModeChange} />);
    await editor();
    await act(async () => button().click());
    // The host did not change the mode, so the note stays in edit mode and the host is told.
    expect(onModeChange).toHaveBeenCalledWith('view');
    expect(mounted.container.querySelector('.cm-editor')).not.toBeNull();
  });

  it('hands every change to the host, byte for byte the note elsewhere', async () => {
    const changes: string[] = [];
    mounted = await mount(<NoteBody markdown={NOTE} editable defaultMode="edit" onChange={(next) => changes.push(next)} />);
    const view = await editor();
    const at = NOTE.indexOf('Some');
    await act(async () => view.dispatch({ changes: { from: at, insert: 'Really ' } }));
    expect(changes).toEqual([NOTE.replace('Some', 'Really Some')]);
  });

  it('is drawn by the theme\'s slot, with the action and the mode', async () => {
    const seen: unknown[] = [];
    const theme = defineTheme({
      name: 'switchy',
      components: {
        modeSwitch: (props) => {
          seen.push({ mode: props.mode, label: props.label, display: props.display });
          return (
            <button type="button" className="mode-switch" onClick={props.toggle}>
              {props.label}!
            </button>
          );
        },
      },
    });
    mounted = await mount(<NoteBody markdown={NOTE} editable theme={theme} />);
    expect(button().textContent).toBe('Edit!');
    await act(async () => button().click());
    await editor();
    expect(seen.at(-1)).toEqual({ mode: 'edit', label: 'View', display: 'label' });
  });
});
