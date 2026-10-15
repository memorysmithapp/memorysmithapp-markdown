/**
 * A code block's language (#84): every grammar Prism carries, the fifteen of MemorySmith there at
 * once and the rest loaded when a note names one; chosen in edit mode from a control at the block's
 * top right that rewrites the fence's info string and nothing else.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { withLanguage } from '../../src/edit/LanguageControl.js';
import { grammarOf, highlightLanguage, loadGrammar } from '../../src/highlight.js';
import { NoteBody } from '../../src/index.js';
import { GRAMMARS } from '../../src/prism-grammars.js';
import { html, mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await act(async () => new Promise((done) => setTimeout(done, 5)));
}

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);
const $$ = <T extends Element>(selector: string) => [...mounted!.container.querySelectorAll<T>(selector)];

describe('the grammars (#84)', () => {
  it('lists every grammar refractor carries, each found by its identifier or an alias', () => {
    expect(GRAMMARS.length).toBeGreaterThan(290);
    expect(grammarOf('py')?.id).toBe('python');
    expect(grammarOf('Dockerfile')?.id).toBe('docker');
    expect(grammarOf('cpp')?.title).toBe('C++');
    expect(grammarOf('mermaid')).toBeNull();
    expect(grammarOf('not-a-language')).toBeNull();
  });

  it('draws the fifteen highlighted at once, and another plain until its grammar arrives', async () => {
    expect(html('```python\nx = 1\n```')).toContain('class="token');
    expect(highlightLanguage('language-zig')).toBeNull();
    mounted = await mount(<NoteBody markdown={'```zig\nconst x = 1;\n```'} />);
    await settle();
    expect(highlightLanguage('language-zig')).toBe('zig');
    expect($('code.language-zig .token')).not.toBeNull();
  });

  it('leaves a name no grammar answers as plain code', async () => {
    expect(await loadGrammar('not-a-language')).toBe(false);
    expect(html('```not-a-language\nx\n```')).not.toContain('class="token');
  });
});

describe('the language of a code block, chosen in edit mode (#84)', () => {
  it('rewrites the first word of the info string and keeps the rest', () => {
    expect(withLanguage('```py title="a"', 'rust')).toBe('```rust title="a"');
    expect(withLanguage('```', 'go')).toBe('```go');
    expect(withLanguage('> ~~~js', null)).toBe('> ~~~');
    expect(withLanguage('```js extra', null)).toBe('```extra');
  });

  it('says the language, searches by name and alias, and writes the choice to the fence alone', async () => {
    const changes: string[] = [];
    const note = 'Text.\n\n```py\nx = 1\n```\n';
    mounted = await mount(<NoteEditor markdown={note} onChange={(text) => void changes.push(text)} />);
    await settle();
    const button = $<HTMLButtonElement>('.edit-language-button')!;
    expect(button.getAttribute('aria-label')).toBe('Language: Python');
    await act(async () => button.click());
    const search = $<HTMLInputElement>('.edit-language-search')!;
    expect(document.activeElement).toBe(search);
    expect($$('.edit-language-option').slice(0, 2).map((each) => each.textContent)).toEqual(['Plain text', 'Mermaid diagram']);
    expect($('.edit-language-option[aria-selected="true"]')!.textContent).toBe('Python');

    const type = async (value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(search, value);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    // Best first: the name the search is, before one that only holds it.
    await type('go');
    expect($$('.edit-language-option')[0]!.textContent).toBe('Go');
    await type('rus');
    expect($$('.edit-language-option').map((each) => each.textContent)).toContain('Rust');
    await type('dockerfile');
    expect($$('.edit-language-option').map((each) => each.textContent)).toEqual(['Dockerdockerfile']);
    await act(async () => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(changes.at(-1)).toBe(note.replace('```py', '```docker'));
    expect($('.edit-language-popover')).toBeNull();

    await act(async () => $<HTMLButtonElement>('.edit-language-button')!.click());
    await act(async () => $$<HTMLElement>('.edit-language-option')[0]!.click());
    expect(changes.at(-1)).toBe(note.replace('```py', '```'));
  });

  it('offers a name no grammar answers as itself', async () => {
    mounted = await mount(<NoteEditor markdown={'```made-up\nx\n```\n'} />);
    await settle();
    expect($('.edit-language-button')!.getAttribute('aria-label')).toBe('Language: made-up');
    await act(async () => $<HTMLButtonElement>('.edit-language-button')!.click());
    expect($$('.edit-language-option')[1]!.textContent).toBe('made-up · not highlighted');
  });

  it('opens the choice of a code block the toolbar inserts, its search focused', async () => {
    const changes: string[] = [];
    mounted = await mount(<NoteEditor markdown={'Text.\n'} onChange={(text) => void changes.push(text)} />);
    await settle();
    const view = EditorView.findFromDOM($<HTMLElement>('.cm-editor')!)!;
    await act(async () => view.dispatch({ selection: { anchor: 6 } }));
    await act(async () => $<HTMLButtonElement>('button[aria-label="Code block"]')!.click());
    await settle();
    expect(changes.at(-1)).toBe('Text.\n\n```\n\n```');
    expect(document.activeElement).toBe($('.edit-language-search'));
  });
});
