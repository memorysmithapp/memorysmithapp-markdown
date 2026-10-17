/**
 * An image whose destination names no host is the file the notebook keeps under the last segment
 * of its path (`SPEC.md` §5.8, #104): drawn as that file's embed is, in reading and in edit mode,
 * and never asked of a path under the page.
 */

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../src/edit/index.js';
import { keptImageName } from '../src/kept-image.js';
import type { KeptFile, NoteHost } from '../src/index.js';
import { html, mount, type Mounted } from './render.js';

const U = 'https://files.test/curva';
const FILES: Record<string, KeptFile> = {
  'curva-2026.png': { mimeType: 'image/png', bytes: 13_532, url: U, description: 'Curva de maturação da safra' },
  'diagram final.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/diagram' },
  'ata.pdf': { mimeType: 'application/pdf', bytes: 2048, url: 'https://files.test/ata', description: 'A ata assinada' },
};
const host: NoteHost = { keeps: (name) => name in FILES, fileOf: (name) => FILES[name] ?? null };

/** The `img` elements a note draws, as written. */
const images = (out: string): string[] => out.match(/<img [^>]*>/g) ?? [];

describe('the name an image destination gives', () => {
  it('is the last segment of its path, whatever separates it', () => {
    for (const destination of ['../assets/curva-2026.png', '/curva-2026.png', 'assets\\curva-2026.png', 'assets%5Ccurva-2026.png', 'curva-2026.png']) {
      expect(keptImageName(destination), destination).toBe('curva-2026.png');
    }
  });

  it('is percent-decoded, an escape that is not one kept, its query and fragment dropped', () => {
    expect(keptImageName('assets/diagram%20final.png')).toBe('diagram final.png');
    expect(keptImageName('assets/diagram final.png')).toBe('diagram final.png');
    expect(keptImageName('curva-2026.png?v=2#top')).toBe('curva-2026.png');
    expect(keptImageName('50%.png')).toBe('50%.png');
    expect(keptImageName('Ac%CC%A7a%CC%83o.png')).toBe('Ação.png'.normalize('NFC'));
  });

  it('is none for an address that names a host or carries a scheme', () => {
    for (const destination of ['https://example.org/curva-2026.png', 'http://x/y.png', '//cdn.example.org/y.png', 'data:image/png;base64,AA==', '']) {
      expect(keptImageName(destination), destination).toBeNull();
    }
  });
});

describe('an image that names a kept file', () => {
  it('is drawn from the file, at the dimensions after its pipe, with its description', () => {
    expect(images(html('![Curva|300x180](curva-2026.png)', host))).toEqual([
      `<img class="attachment-image" src="${U}" alt="Curva" title="Curva" width="300" height="180" style="height:180px"/>`,
    ]);
    expect(images(html('![Curva|300](../assets/curva-2026.png)', host))).toEqual([`<img class="attachment-image" src="${U}" alt="Curva" title="Curva" width="300"/>`]);
  });

  it('takes the file\'s own description when it wrote none, so its alt is never empty', () => {
    expect(images(html('![](curva-2026.png)', host))).toEqual([`<img class="attachment-image" src="${U}" alt="Curva de maturação da safra" title="Curva de maturação da safra"/>`]);
  });

  it('keeps the title it wrote, which never changes the target', () => {
    expect(images(html('![Curva](curva-2026.png "Safra 2026")', host))).toEqual([`<img class="attachment-image" src="${U}" alt="Curva" title="Safra 2026"/>`]);
  });

  it('finds a name the parser encoded, in angle brackets or with a backslash', () => {
    expect(images(html('![](<assets/diagram final.png>)', host))[0]).toContain('src="https://files.test/diagram"');
    expect(images(html('![](assets/diagram%20final.png)', host))[0]).toContain('src="https://files.test/diagram"');
    expect(images(html('![](assets\\curva-2026.png)', host))[0]).toContain(`src="${U}"`);
  });

  it('is the card its embed draws when the file is not an image, with its description as the text', () => {
    const out = html('![A ata](ata.pdf)', host);
    expect(images(out)).toEqual([]);
    expect(out).toContain('<span class="attachment-card-name">ata.pdf</span>');
    expect(out).toContain('<span class="attachment-card-note">A ata</span>');
    expect(out).not.toContain('A ata assinada');
  });

  it('is pending when nothing is kept under its name: its description shown, no image, nothing asked of the page', () => {
    const out = html('![Falta|200](nao-existe.png)', host);
    expect(images(out)).toEqual([]);
    expect(out).toContain('class="attachment-missing"');
    expect(out).toContain('>Falta</span>');
    expect(out).not.toContain('src=');
    // Case-exact, and a note's name is not a file's.
    expect(images(html('![](Curva-2026.png)', host))).toEqual([]);
    expect(html('![](Nota)', { ...host, resolve: (name) => (name === 'Nota' ? '/notes/nota' : null) })).toContain('attachment-missing');
  });

  it('names no host, so the note says nothing of fetching from another site', () => {
    expect(html('![Curva|300](../assets/curva-2026.png)', host)).not.toContain('remote-notice');
  });

  it('hands renderAttachment what it wrote', () => {
    const seen: unknown[] = [];
    html('![Curva|300](../assets/curva-2026.png "Safra")', { ...host, renderAttachment: (request) => void seen.push(request) });
    expect(seen).toEqual([{ name: 'curva-2026.png', width: 300, height: null, percent: null, description: 'Curva', title: 'Safra' }]);
  });

  it('leaves a remote image as it was, an image of its address', () => {
    expect(images(html('![Remota|300](https://example.org/curva-2026.png)', host))).toEqual([
      '<img src="https://example.org/curva-2026.png" alt="Remota" title="Remota" width="300"/>',
    ]);
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

describe('an image that names a kept file, in edit mode', () => {
  it('is drawn from the file, and asks nothing of a path under the page', async () => {
    mounted = await mount(<NoteEditor markdown={'Antes.\n\n![Curva|300x180](../assets/curva-2026.png)\n\n![Falta](nao-existe.png)\n'} onChange={() => undefined} {...host} />);
    await settle();
    const drawn = [...mounted.container.querySelectorAll('img[src]')];
    expect(drawn.map((image) => image.getAttribute('src'))).toEqual([U]);
    expect(drawn[0]!.getAttribute('alt')).toBe('Curva');
    // Its hover hint too, as the page draws it (#109).
    expect(drawn[0]!.getAttribute('title')).toBe('Curva');
    expect(mounted.container.querySelector('.attachment-missing')?.textContent).toBe('Falta');
    // Sized from the image itself, as any other (#98).
    expect(mounted.container.querySelector<HTMLInputElement>('.edit-image-width')!.value).toBe('300');
  });
});

describe('the description of an image is its hover hint (#109)', () => {
  const FILES_109: Record<string, KeptFile> = {
    'file.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/file', description: 'Assinatura vertical, fundo claro' },
    'bare.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/bare' },
    'curva.png': { mimeType: 'image/png', bytes: 10, url: 'https://files.test/curva', description: 'Curva de maturação' },
  };
  const kept: NoteHost = { keeps: (name) => name in FILES_109, fileOf: (name) => FILES_109[name] ?? null };
  const attributes = (markdown: string) => {
    const image = images(html(markdown, kept))[0] ?? '';
    return { alt: /alt="([^"]*)"/.exec(image)?.[1] ?? null, title: /title="([^"]*)"/.exec(image)?.[1] ?? null };
  };

  it.each([
    ['![[file.png]]', 'Assinatura vertical, fundo claro', 'Assinatura vertical, fundo claro'],
    ['![[file.png|171]]', 'Assinatura vertical, fundo claro', 'Assinatura vertical, fundo claro'],
    ['![[bare.png]]', 'bare.png', null],
    ['![Curva|300](curva.png)', 'Curva', 'Curva'],
    ['![Curva|300](https://example.org/curva.png)', 'Curva', 'Curva'],
    ['![Curva](curva.png "Safra 2026")', 'Curva', 'Safra 2026'],
    ['![Curva](https://example.org/curva.png "Safra 2026")', 'Curva', 'Safra 2026'],
    ['![](curva.png)', 'Curva de maturação', 'Curva de maturação'],
  ])('%s has that alt and that title', (markdown, alt, title) => {
    expect(attributes(markdown)).toEqual({ alt, title });
  });
});
