/**
 * The controls of an image in edit mode: a width field that replaces what it holds and refuses a
 * size nobody sees (#105); a width and a height with a lock between them, the unit, the
 * description and a handle that says what it does (#106); and nothing started on them taken for
 * the click that shows the image's source (#107); and the picture, sized in place as a table is
 * edited in place, showing its source from a button and never from a click (#112); a share of the
 * page drawn as a share of the column, as it is read (#113); and the picture keeping its place on
 * the screen while its handle is dragged (#116).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import type { KeptFile, NoteHost } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

// jsdom has no PointerEvent: a mouse event that carries the pointer's id, as far as the controls read it.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventOfJsdom extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventOfJsdom;
}

const FILES: Record<string, KeptFile> = {
  'logo.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/logo', description: 'The logo, on white' },
  'minutes.pdf': { mimeType: 'application/pdf', bytes: 2048, url: 'https://files.test/minutes', description: 'The signed minutes' },
};
const HOST: NoteHost = { keeps: (name) => name in FILES, fileOf: (name) => FILES[name] ?? null };

// Every picture is laid out 200 by 100, the ones the editor draws anew for a new source included;
// a test sets another size on one element of its own.
const layout = HTMLImageElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLImageElement.prototype.getBoundingClientRect = function (this: HTMLImageElement) {
    return this.hasAttribute('src') ? ({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => null } as DOMRect) : layout.call(this);
  };
});
afterAll(() => {
  HTMLImageElement.prototype.getBoundingClientRect = layout;
});

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

/** Waits, a second at most, for what the editor draws a moment after an event. */
async function until(done: () => boolean): Promise<void> {
  for (let waited = 0; waited < 1000 && !done(); waited += 20) await act(async () => new Promise((next) => setTimeout(next, 20)));
}

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);

/** Opens a note in the editor, its column 700px wide. */
async function open(markdown: string): Promise<{ view: EditorView; changes: string[] }> {
  const changes: string[] = [];
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => void changes.push(next)} {...HOST} />);
  await settle();
  // An image is drawn once more when its height is first learned: its fields are the ones of the drawing that stays.
  for (let frame = $('.edit-image'), still = 0; still < 3; still++) {
    await act(async () => new Promise((done) => setTimeout(done, 5)));
    if ($('.edit-image') !== frame) [frame, still] = [$('.edit-image'), -1];
  }
  const content = $<HTMLElement>('.cm-content')!;
  Object.defineProperty(content, 'clientWidth', { configurable: true, value: 700 });
  return { view: EditorView.findFromDOM($<HTMLElement>('.cm-editor')!)!, changes };
}

/** Types into a field as React sees it, without a key that writes. */
async function type(field: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function press(field: HTMLInputElement, key: string): Promise<void> {
  await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
  await settle();
}

const width = () => $<HTMLInputElement>('.edit-image-width')!;
const height = () => $<HTMLInputElement>('.edit-image-height')!;
const button = (label: string) => $<HTMLButtonElement>(`.edit-image-controls button[aria-label="${label}"]`)!;
const selected = (field: HTMLInputElement) => [field.selectionStart, field.selectionEnd];

describe('the width field (#105)', () => {
  const NOTE = 'A logo:\n\n![[logo.png|200]]\n';

  it('selects what it holds when it takes the focus, by a click, a double click or Tab, so typing replaces it', async () => {
    const { changes } = await open(NOTE);
    const field = width();
    expect(field.type).toBe('text');
    await act(async () => field.focus());
    expect(selected(field)).toEqual([0, 3]);
    field.setSelectionRange(1, 1);
    await act(async () => field.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(selected(field)).toEqual([0, 3]);
    field.setSelectionRange(3, 3);
    await act(async () => field.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })));
    expect(selected(field)).toEqual([0, 3]);

    await type(field, '180');
    expect(changes).toEqual([]);
    await press(field, 'Enter');
    expect(changes.at(-1)).toBe(NOTE.replace('|200', '|180'));
  });

  it('refuses a size out of what a reader sees, in place, and never writes 99999 or 1', async () => {
    const { changes } = await open(NOTE);
    for (const value of ['200180', '99999', '701', '15', '1', '0', '12a', '-5']) {
      await type(width(), value);
      await press(width(), 'Enter');
      expect(width().getAttribute('aria-invalid'), value).toBe('true');
      expect($('.edit-image-refused')!.textContent).toBe('Between 16 and 700 px');
    }
    expect(changes).toEqual([]);
    // Escape leaves the note as it was, and the field says what it holds again.
    await press(width(), 'Escape');
    expect(width().value).toBe('200');
    expect(width().hasAttribute('aria-invalid')).toBe(false);
    await type(width(), '700');
    await press(width(), 'Enter');
    expect(changes.at(-1)).toBe(NOTE.replace('|200', '|700'));
  });

  it('lets go of a refused value when it is left, the note unchanged', async () => {
    const { changes } = await open(NOTE);
    await type(width(), '5');
    await act(async () => width().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(changes).toEqual([]);
    expect(width().value).toBe('200');
  });
});

describe('the width and the height, with the lock between them (#106)', () => {
  it('starts locked for a width alone, which it keeps writing alone; its height follows', async () => {
    const note = '![A view|300](https://example.org/v.png)\n';
    const { changes } = await open(note);
    expect(button('Keep the proportion').getAttribute('aria-pressed')).toBe('true');
    await type(height(), '50');
    await press(height(), 'Enter');
    // 50 high at the image's 2:1 is 100 wide, and only the width is written.
    expect(changes.at(-1)).toBe('![A view|100](https://example.org/v.png)\n');
  });

  it('starts open for a width and a height, which it writes together, and locking drops the height', async () => {
    const note = '![A view|300x180](https://example.org/v.png)\n';
    const { changes } = await open(note);
    const lock = button('Width and height apart');
    expect(lock.getAttribute('aria-pressed')).toBe('false');
    expect(height().value).toBe('180');
    await type(height(), '120');
    await press(height(), 'Enter');
    expect(changes.at(-1)).toBe('![A view|300x120](https://example.org/v.png)\n');
    // The image is drawn again for its new source, with the lock still open.
    await act(async () => button('Width and height apart').click());
    await settle();
    expect(changes.at(-1)).toBe('![A view|300](https://example.org/v.png)\n');
  });

  it('writes no height for an empty height field, and its own size for an empty width', async () => {
    const note = '![A view|300x180](https://example.org/v.png)\n';
    const { changes } = await open(note);
    await type(height(), '');
    await press(height(), 'Enter');
    expect(changes.at(-1)).toBe('![A view|300](https://example.org/v.png)\n');
  });

  it('sizes a width as a share of the page, with no height (#108)', async () => {
    const note = '![[logo.png|200]]\n';
    const { changes } = await open(note);
    const unit = $<HTMLSelectElement>('.edit-image-unit')!;
    await act(async () => {
      unit.value = '%';
      unit.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    // 200 of a 700px column is 29% of it.
    expect(changes.at(-1)).toBe('![[logo.png|29%]]\n');
    expect(height().disabled).toBe(true);
    await type(width(), '150');
    await press(width(), 'Enter');
    expect($('.edit-image-refused')!.textContent).toBe('Between 1 and 100 %');
    await type(width(), '50');
    await press(width(), 'Enter');
    expect(changes.at(-1)).toBe('![[logo.png|50%]]\n');
  });
});

describe('a share of the page in edit mode (#113)', () => {
  const choose = async (next: 'px' | '%') => {
    const unit = $<HTMLSelectElement>('.edit-image-unit')!;
    await act(async () => {
      unit.value = next;
      unit.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
  };

  it('is drawn at that share of the column, as it is read, not of the frame around the picture', async () => {
    const { changes } = await open('![[logo.png|150]]\n');
    await choose('%');
    // 200 drawn in a 700px column is 29% of it, at most 203px of it.
    expect(changes.at(-1)).toBe('![[logo.png|29%]]\n');
    expect($<HTMLImageElement>('img[src]')!.style.maxWidth).toBe('203px');
  });

  it.each(['![[logo.png|150]]\n', '![A view|320x200](https://example.org/v.png)\n'])('writes back %s when the unit goes to % and back with nothing changed', async (note) => {
    const { changes } = await open(note);
    await choose('%');
    await choose('px');
    expect(changes.at(-1)).toBe(note);
  });

  it('writes the width it is drawn at when the share was changed in between', async () => {
    const { changes } = await open('![[logo.png|150]]\n');
    await choose('%');
    await type(width(), '50');
    await press(width(), 'Enter');
    expect(changes.at(-1)).toBe('![[logo.png|50%]]\n');
    for (const image of mounted!.container.querySelectorAll('img[src]')) {
      image.getBoundingClientRect = () => ({ width: 350, height: 175, top: 0, left: 0, right: 350, bottom: 175, x: 0, y: 0, toJSON: () => null }) as DOMRect;
    }
    await choose('px');
    expect(changes.at(-1)).toBe('![[logo.png|350]]\n');
  });
});

describe('the description, the button back to its own size and the handle (#106)', () => {
  it('edits the description of a Markdown image before its pipe, which it keeps', async () => {
    const { changes } = await open('![A view|300](https://example.org/v.png)\n');
    const field = $<HTMLInputElement>('.edit-image-description')!;
    expect(field.value).toBe('A view');
    await type(field, 'The [north] view');
    await press(field, 'Enter');
    expect(changes.at(-1)).toBe('![The \\[north\\] view|300](https://example.org/v.png)\n');
  });

  it('shows the description of an embedded file, which it does not edit', async () => {
    await open('![[logo.png|200]]\n');
    const field = $<HTMLInputElement>('.edit-image-description')!;
    expect(field.readOnly).toBe(true);
    expect(field.placeholder).toBe('The logo, on white');
  });

  it('draws its own size again with an icon that is not a way out of the page', async () => {
    const { changes } = await open('![[logo.png|200]]\n');
    expect(button('Its own size').innerHTML).not.toContain('M21 3 9 15');
    await act(async () => button('Its own size').click());
    await settle();
    expect(changes.at(-1)).toBe('![[logo.png]]\n');
  });

  it('has a handle of diagonal arrows that says whether it keeps the proportion', async () => {
    await open('![[logo.png|200]]\n');
    const handle = $<HTMLElement>('.edit-image-handle')!;
    expect(handle.querySelector('svg')).not.toBeNull();
    expect(handle.title).toBe('Drag to resize (keeps the proportion)');
    await act(async () => button('Keep the proportion').click());
    expect($<HTMLElement>('.edit-image-handle')!.title).toBe('Drag to resize (free)');
  });

  it('stands under the picture, never over it', async () => {
    await open('![[logo.png|200]]\n');
    const controls = $('.edit-image-controls')!;
    expect($('img[src]')!.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const rule = /\.markdown \.edit-image-controls \{([^}]*)\}/.exec(readFileSync(resolve(__dirname, '..', '..', 'structure.css'), 'utf8'))?.[1] ?? '';
    expect(rule).toContain('top: var(--edit-image-bottom');
  });
});

describe('a pointer or a touch on an image\'s controls (#107)', () => {
  /** A press with real pointer and mouse events, as a browser sends them; the touch's first when it is one. */
  async function pressOn(target: Element, touch = false): Promise<void> {
    await act(async () => {
      if (touch) target.dispatchEvent(new Event('touchstart', { bubbles: true }));
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await settle();
  }

  const NOTE = 'A logo:\n\n![[logo.png|200]]\n';

  it('never shows the image\'s source: on a field, a button, the unit, a gap between them, the handle, the space above them', async () => {
    const { view } = await open(NOTE);
    const head = view.state.selection.main.head;
    const targets = [width, height, () => button('Keep the proportion'), () => $('.edit-image-unit')!, () => $('.edit-image-controls')!, () => $('.edit-image-size')!, () => $('.edit-image-handle')!, () => $('.edit-image')!];
    for (const target of targets) {
      for (const touch of [false, true]) {
        await pressOn(target(), touch);
        expect($('.edit-image'), String(target)).not.toBeNull();
        expect(view.state.selection.main.head).toBe(head);
      }
    }
  });

  it('nor does the click a touch on them leaves on the picture, or one while a field has the focus', async () => {
    const { view } = await open(NOTE);
    const head = view.state.selection.main.head;
    await act(async () => $('.edit-image-controls')!.dispatchEvent(new Event('touchstart', { bubbles: true })));
    await pressOn($('img[src]')!);
    expect(view.state.selection.main.head).toBe(head);
    await act(async () => width().focus());
    await pressOn($('img[src]')!);
    expect(view.state.selection.main.head).toBe(head);
  });

  it('keeps a press between the controls from putting the caret where it fell, and a field\'s focus where it goes', async () => {
    // In Chromium a press on the gap's default put the editor's caret there, and the image showed
    // its source: what automation in jsdom never sees, so its default is what is checked.
    await open(NOTE);
    const press = (target: Element) => {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press($('.edit-image-size')!)).toBe(true);
    expect(press($('.edit-image-controls')!)).toBe(true);
    expect(press($('.edit-image-unit-label')!)).toBe(true);
    expect(press($('.edit-image')!)).toBe(true);
    expect(press(width())).toBe(false);
    expect(press($('.edit-image-unit')!)).toBe(false);
    expect(press(button('Its own size'))).toBe(false);
  });

  it('drags the handle with the pointer captured, and writes the width it was let go at', async () => {
    const { view, changes } = await open(NOTE);
    const handle = $<HTMLElement>('.edit-image-handle')!;
    const image = $<HTMLImageElement>('img[src]')!;
    const head = view.state.selection.main.head;
    await act(async () => handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, clientX: 200, clientY: 100 })));
    expect($('.edit-image')!.hasAttribute('data-resizing')).toBe(true);
    await act(async () => handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: 150, clientY: 90 })));
    expect(image.style.width).toBe('150px');
    image.getBoundingClientRect = () => ({ width: 150, height: 75, top: 0, left: 0, right: 150, bottom: 75, x: 0, y: 0, toJSON: () => null }) as DOMRect;
    // A click that lands on the picture while it is dragged shows nothing.
    await act(async () => image.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    await act(async () => handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: 150, clientY: 90 })));
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('|200', '|150'));
    expect(view.state.selection.main.head).toBe(head);
  });
});

describe('the picture keeps its place while its handle is dragged (#116)', () => {
  it('scrolls back any move of its top, with room after the note and no anchoring, in the pane that scrolls', async () => {
    await open('A logo:\n\n![[logo.png|200]]\n\nA line after it.\n');
    // The editor scrolls in a pane of the host, scrolled to its end.
    const pane = mounted!.container;
    pane.style.overflowY = 'auto';
    Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 800 });
    const scrolled: number[] = [];
    pane.scrollBy = ((_x: number, y: number) => void scrolled.push(y)) as typeof pane.scrollBy;
    const image = $<HTMLImageElement>('img[src]')!;
    let top = 333;
    image.getBoundingClientRect = () => ({ width: 200, height: 100, top, left: 0, right: 200, bottom: top + 100, x: 0, y: top, toJSON: () => null }) as DOMRect;
    const handle = $<HTMLElement>('.edit-image-handle')!;
    const content = $<HTMLElement>('.cm-content')!;
    const room = `${(parseFloat(getComputedStyle(content).paddingBottom) || 0) + 100}px`;

    await act(async () => handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3, clientX: 200, clientY: 100 })));
    expect(pane.style.overflowAnchor).toBe('none');
    // Room for as much as it may shrink, so the pane is never shorter than where it is scrolled to.
    expect(content.style.paddingBottom).toBe(room);

    // Shrinking it, the browser brought it down by 169 pixels: they are scrolled back.
    top = 502;
    await act(async () => handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 3, clientX: 120, clientY: 60 })));
    expect(scrolled).toEqual([169]);

    top = 333;
    await act(async () => handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, clientX: 120, clientY: 60 })));
    await act(async () => new Promise((done) => setTimeout(done, 700)));
    expect(pane.style.overflowAnchor).toBe('');
    // The room stays until the author scrolls up into it, so the release does not jump.
    expect(content.style.paddingBottom).toBe(room);
  });
});

describe('an image sized in place shows its source as a table does (#112)', () => {
  /** A press on a target with a mouse, or a touch and the mouse events it leaves behind. */
  async function pressOn(target: Element, touch = false): Promise<void> {
    await act(async () => {
      if (touch) target.dispatchEvent(new Event('touchstart', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await settle();
  }

  it.each([
    ['an embed of a kept image', 'A logo:\n\n![[logo.png|200]]\n'],
    ['a Markdown image', 'A view:\n\n![A view|300](https://example.org/v.png)\n'],
    ['a Markdown image inside a line', 'A view ![A view|300](https://example.org/v.png) here.\n'],
  ])('%s stays drawn, with its controls, at a click or a touch on the picture', async (_kind, note) => {
    const { view, changes } = await open(note);
    const head = view.state.selection.main.head;
    for (const touch of [false, true]) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      await act(async () => $('img[src]')!.dispatchEvent(event));
      // Its default would put the caret beside it, which shows its source.
      expect(event.defaultPrevented).toBe(true);
      await pressOn($('img[src]')!, touch);
      expect($('.edit-image-controls')).not.toBeNull();
      expect(view.state.selection.main.head).toBe(head);
    }
    expect(changes).toEqual([]);
  });

  it('shows its source from the button among its controls, as a table\'s does', async () => {
    const note = 'A logo:\n\n![[logo.png|200]]\n';
    const { view, changes } = await open(note);
    await act(async () => button('Source').click());
    await settle();
    expect(view.state.selection.main.head).toBe(note.indexOf('![['));
    // The notation shows once the editor knows it has the focus, which it learns a moment later.
    await until(() => $('.edit-image-controls') === null);
    expect($('.edit-image-controls')).toBeNull();
    expect(changes).toEqual([]);
  });

  it('shows its source when the caret reaches it', async () => {
    const note = 'A view ![A view|300](https://example.org/v.png) here.\n';
    const { view } = await open(note);
    await act(async () => {
      view.focus();
      view.dispatch({ selection: { anchor: note.indexOf('![') } });
    });
    await until(() => $('.edit-image-controls') === null);
    expect($('.edit-image-controls')).toBeNull();
  });

  it('still follows a link around it with a modifier only', async () => {
    const opened: unknown[] = [];
    const original = window.open;
    window.open = ((...args: unknown[]) => void opened.push(args)) as unknown as typeof window.open;
    try {
      const { view } = await open('See [![A view|300](https://example.org/v.png)](https://example.org/page) here.\n');
      const head = view.state.selection.main.head;
      await pressOn($('img[src]')!);
      expect(opened).toEqual([]);
      expect(view.state.selection.main.head).toBe(head);
      await act(async () => $('img[src]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true })));
      expect(opened).toEqual([['https://example.org/page', '_blank', 'noreferrer']]);
    } finally {
      window.open = original;
    }
  });

  it('leaves a click on an embed with no picture, a file\'s card, showing its source', async () => {
    const note = 'Minutes:\n\n![[minutes.pdf]]\n';
    const { view } = await open(note);
    expect($('.edit-image-controls')).toBeNull();
    await pressOn($('.attachment-card')!);
    expect(view.state.selection.main.head).not.toBe(note.length);
    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(note.indexOf('![['));
  });
});
