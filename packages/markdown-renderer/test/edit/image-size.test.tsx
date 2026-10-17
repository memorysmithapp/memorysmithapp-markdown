/**
 * The size an image is drawn at, set from the image in edit mode (#98): its width typed, its corner
 * dragged, or its own size again, each writing the dimensions of its notation (`SPEC.md` §3.14 and
 * §5.7) and no other byte.
 */

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { readImageSize, resizeImage } from '../../src/edit/image-size.js';
import type { KeptFile, NoteHost } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

/** The source with the change applied, for a source that starts at 0. */
const resized = (source: string, width: Parameters<typeof resizeImage>[2]) =>
  resizeImage(source, 0, width).reduceRight((text, change) => text.slice(0, change.from) + change.insert + text.slice(change.to), source);

describe('the dimensions of an image', () => {
  it('are written after the description of a Markdown image, and taken away for its own size', () => {
    expect(resized('![A view](https://example.org/v.png)', 300)).toBe('![A view|300](https://example.org/v.png)');
    expect(resized('![A view|320x180](https://example.org/v.png)', 160)).toBe('![A view|160](https://example.org/v.png)');
    expect(resized('![A view|320](https://example.org/v.png)', null)).toBe('![A view](https://example.org/v.png)');
    expect(resized('![](https://example.org/v.png)', 50)).toBe('![|50](https://example.org/v.png)');
  });

  it('keep a description that holds a pipe of its own, which is not a dimension', () => {
    expect(readImageSize('![a|large](v.png)')).toMatchObject({ width: null });
    expect(resized('![a|large](v.png)', 80)).toBe('![a|large|80](v.png)');
    expect(resized('![a|large|80](v.png)', null)).toBe('![a|large](v.png)');
  });

  it('are written after the name of a kept file, with the pipe it was written with', () => {
    expect(resized('![[photo.jpg]]', 300)).toBe('![[photo.jpg|300]]');
    expect(resized('![[photo.jpg|100x145]]', 200)).toBe('![[photo.jpg|200]]');
    expect(resized('![[photo.jpg|200]]', null)).toBe('![[photo.jpg]]');
    expect(resized('![[photo.jpg\\|200]]', 90)).toBe('![[photo.jpg\\|90]]');
  });

  it('read a share of the page as the dimensions they are, and replace it whole (#108)', () => {
    expect(readImageSize('![Curva|50%](curva.png)')).toMatchObject({ width: null, percent: 50, at: { from: 7, to: 11 } });
    expect(readImageSize('![[curva.png|50%]]')).toMatchObject({ width: null, percent: 50 });
    expect(resized('![Curva|50%](curva.png)', 300)).toBe('![Curva|300](curva.png)');
    expect(resized('![[curva.png|50%]]', null)).toBe('![[curva.png]]');
  });

  it('never overwrite what an embed says after its pipe when it is not a dimension', () => {
    expect(readImageSize('![[photo.jpg|My photo]]')).toBeNull();
    expect(resizeImage('![[photo.jpg|My photo]]', 0, 100)).toEqual([]);
  });

  it('change nothing when the size asked is the one written, and refuse one the notation does not write (#105)', () => {
    expect(resizeImage('![A|300](v.png)', 0, 300)).toEqual([]);
    expect(resizeImage('![A](v.png)', 0, null)).toEqual([]);
    expect(resized('![A|300x200](v.png)', 300)).toBe('![A|300](v.png)');
    // Never brought into the range and written: 99999 or 1 is not what anybody asked for.
    expect(resizeImage('![A](v.png)', 0, 1e9)).toEqual([]);
    expect(resizeImage('![A](v.png)', 0, 0)).toEqual([]);
    expect(resizeImage('![A](v.png)', 0, { width: null, height: null, percent: 150 })).toEqual([]);
    expect(resizeImage('Some text', 0, 10)).toEqual([]);
  });

  it('write a width and a height, or a share of the page, whole (#106, #108)', () => {
    expect(resized('![A|300](v.png)', { width: 300, height: 180, percent: null } as never)).toBe('![A|300x180](v.png)');
    expect(resized('![[photo.jpg]]', { width: null, height: null, percent: 50 } as never)).toBe('![[photo.jpg|50%]]');
  });
});

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

const $ = <T extends Element>(selector: string) => mounted!.container.querySelector<T>(selector);

async function open(markdown: string, host: NoteHost = {}): Promise<string[]> {
  const changes: string[] = [];
  mounted = await mount(<NoteEditor markdown={markdown} onChange={(next) => changes.push(next)} {...host} />);
  await settle();
  return changes;
}

/** Types into the width field as React sees it, then presses a key in it. */
async function typeWidth(value: string, key = 'Enter'): Promise<void> {
  const field = $<HTMLInputElement>('.edit-image-width')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
  await settle();
}

describe('an image in edit mode', () => {
  const NOTE = 'Before.\n\n![A view|320x180](https://example.org/view.png)\n\nAfter.\n';

  it('says the width it is drawn at, and writes the one typed beside the height it wrote', async () => {
    const changes = await open(NOTE);
    expect($<HTMLInputElement>('.edit-image-width')!.value).toBe('320');
    // A width and a height written apart keep the lock open, so both are written (#106).
    await typeWidth('160');
    expect(changes.at(-1)).toBe(NOTE.replace('|320x180', '|160x180'));
  });

  it('goes back to its own size from its button, and from an empty field', async () => {
    const changes = await open(NOTE);
    await act(async () => $<HTMLButtonElement>('button[aria-label="Its own size"]')!.click());
    await settle();
    expect(changes.at(-1)).toBe(NOTE.replace('|320x180', ''));
    expect($<HTMLButtonElement>('button[aria-label="Its own size"]')!.getAttribute('aria-pressed')).toBe('true');

    await typeWidth('90');
    expect(changes.at(-1)).toBe(NOTE.replace('|320x180', '|90'));
    await typeWidth('');
    expect(changes.at(-1)).toBe(NOTE.replace('|320x180', ''));
  });

  it('keeps the size written when Escape leaves the field, or nothing valid is typed', async () => {
    const changes = await open(NOTE);
    await typeWidth('50', 'Escape');
    expect($<HTMLInputElement>('.edit-image-width')!.value).toBe('320');
    await typeWidth('0');
    expect(changes).toEqual([]);
  });

  it('offers its size on a kept image, and on nothing a kept file draws without one', async () => {
    const FILES: Record<string, KeptFile> = {
      'photo.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/photo' },
      'talk.mp3': { mimeType: 'audio/mpeg', bytes: 10, url: 'https://files.test/talk' },
    };
    const host: NoteHost = { keeps: (name) => name in FILES, fileOf: (name) => FILES[name] ?? null };
    const note = 'A photo:\n\n![[photo.png]]\n\nA talk:\n\n![[talk.mp3]]\n';
    const changes = await open(note, host);
    expect(mounted!.container.querySelectorAll('.edit-image-width')).toHaveLength(1);
    await typeWidth('240');
    expect(changes.at(-1)).toBe(note.replace('![[photo.png]]', '![[photo.png|240]]'));
  });
});
