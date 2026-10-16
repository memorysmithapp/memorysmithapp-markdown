/**
 * A file the notebook keeps, drawn by its media type as MemorySmith's `Attachment` draws it (#77):
 * an image, an audio, a video, or a card, from what the host's `fileOf` says, never by its name.
 */

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineTheme, NoteBody, type KeptFile, type NoteHost } from '../src/index.js';
import { html, mount, type Mounted } from './render.js';

const FILES: Record<string, KeptFile> = {
  'diagram.pdf': { mimeType: 'image/png', bytes: 2048, url: 'https://files.test/diagram', description: 'The zones' },
  'talk.mp3': { mimeType: 'audio/mpeg', bytes: 4_000_000, url: 'https://files.test/talk' },
  'demo.mov': { mimeType: 'video/quicktime', bytes: 9_000_000, url: 'https://files.test/demo' },
  'report.pdf': { mimeType: 'application/pdf', bytes: 1_572_864, url: 'https://files.test/report', downloadUrl: 'https://files.test/report?download' },
  'plan.docx': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: 512, url: 'https://files.test/plan' },
  'archive.zip': { mimeType: 'application/zip', bytes: 30_000, url: 'https://files.test/archive' },
  'trap.png': { mimeType: 'image/png', bytes: 10, url: 'javascript:alert(1)' },
  'page.png': { mimeType: 'image/png', bytes: 10, url: 'data:text/html,<script>alert(1)</script>' },
  'sheet.xlsx': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: 4, url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBA==' },
};
const host: NoteHost = { keeps: (name) => name in FILES || name === 'gone.png', fileOf: (name) => FILES[name] ?? null };

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('a kept file, drawn by its type (#77)', () => {
  it('is an image by its media type, whatever its name, with the dimensions the embed declared', () => {
    const out = html('![[diagram.pdf|200x60]]', host);
    expect(out).toContain('<img class="attachment-image" src="https://files.test/diagram" alt="The zones" width="200" height="60" style="height:60px"/>');
  });

  it('is drawn at most at a share of the page the embed declared, never wider than its own pixels (#108)', () => {
    expect(html('![[diagram.pdf|50%]]', host)).toContain('<img class="attachment-image" src="https://files.test/diagram" alt="The zones" style="max-width:50%"/>');
    expect(html('![[demo.mov|100%]]', host)).toContain('<video class="attachment-player" controls="" src="https://files.test/demo" style="max-width:100%"></video>');
    // Not a dimension: the embed draws the file at its own size.
    expect(html('![[diagram.pdf|150%]]', host)).toContain('<img class="attachment-image" src="https://files.test/diagram" alt="The zones"/>');
  });

  it('hands renderAttachment the share it declared, with no pixels', () => {
    const seen: unknown[] = [];
    html('![[diagram.pdf|50%]]', { ...host, renderAttachment: (request) => void seen.push(request) });
    expect(seen).toEqual([{ name: 'diagram.pdf', width: null, height: null, percent: 50 }]);
  });

  it('is a player for an audio and for a video', () => {
    expect(html('![[talk.mp3]]', host)).toContain('<audio class="attachment-player" controls="" src="https://files.test/talk"></audio>');
    expect(html('![[demo.mov|320]]', host)).toContain('<video class="attachment-player" controls="" src="https://files.test/demo" width="320"></video>');
  });

  it('is a card for everything else: what it is, its size, Open where a browser shows it, Download always', () => {
    const pdf = html('![[report.pdf]]', host);
    expect(pdf).toContain('<span class="attachment-card-name">report.pdf</span>');
    expect(pdf).toContain('<span class="attachment-card-note" title="application/pdf">PDF document · 1.5 MB</span>');
    expect(pdf).toContain('<a href="https://files.test/report" target="_blank" rel="noreferrer">Open</a>');
    expect(pdf).toContain('<a href="https://files.test/report?download" download="report.pdf">Download</a>');

    const word = html('![[plan.docx]]', host);
    expect(word).toContain('Word document · 512 byte');
    expect(word).not.toContain('>Open<');
    // A type outside the list is a card named by its media type, which no browser is trusted to open.
    const zip = html('![[archive.zip]]', host);
    expect(zip).toContain('application/zip · 29 kB');
    expect(zip).not.toContain('>Open<');
  });

  it('is named in the reader\'s words, some translated and the rest kept', () => {
    const out = html('![[report.pdf]]', { ...host, strings: { locale: 'pt-BR', attachmentOpen: 'Abrir', fileKinds: { 'application/pdf': 'Documento PDF' } } });
    expect(out).toContain('Documento PDF · 1,5 MB');
    expect(out).toContain('>Abrir</a>');
    expect(html('![[plan.docx]]', { ...host, strings: { fileKinds: { 'application/pdf': 'Documento PDF' } } })).toContain('Word document');
  });

  it('is missing when the host describes nothing, or gives an address this surface will not follow', () => {
    expect(html('![[gone.png]]', host)).toContain('<span class="attachment-missing"');
    expect(html('![[trap.png]]', host)).toContain('<span class="attachment-missing"');
    expect(html('![[trap.png]]', host)).not.toContain('javascript:');
    expect(html('![[page.png]]', host)).toContain('<span class="attachment-missing"');
    // The bytes themselves, as a host that keeps them in base64 gives them, are followed.
    expect(html('![[sheet.xlsx]]', host)).toContain('download="sheet.xlsx"');
  });

  it('is its name while the host is still describing it', async () => {
    let answer!: (file: KeptFile) => void;
    const later: NoteHost = { keeps: () => true, fileOf: () => new Promise<KeptFile>((done) => (answer = done)) };
    mounted = await mount(<NoteBody markdown="![[late.png]]" {...later} />);
    expect(mounted.container.querySelector('.attachment-loading')?.textContent).toBe('late.png');
    await act(async () => answer({ mimeType: 'image/png', bytes: 1, url: '/late' }));
    expect(mounted.container.querySelector('img.attachment-image')?.getAttribute('src')).toBe('/late');
  });

  it('is drawn by the theme\'s slot, with what the package made of it', () => {
    const theme = defineTheme({
      name: 'files',
      components: { attachment: ({ name, shape, kind, size, opens }) => <i>{`${name}|${shape}|${kind}|${size}|${opens}`}</i> },
    });
    expect(html('![[report.pdf]]', { ...host, theme })).toContain('<i>report.pdf|card|PDF document|1.5 MB|true</i>');
  });

  it('opens a file kept as data: as the blob of its bytes, which a browser navigates a tab to (#79)', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const created = vi.fn(() => 'blob:local/pdf');
    Object.defineProperty(URL, 'createObjectURL', { value: created, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const fetched = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['%PDF'], { type: 'application/pdf' })));
    const kept: NoteHost = { keeps: () => true, fileOf: () => ({ mimeType: 'application/pdf', bytes: 4, url: 'data:application/pdf;base64,JVBERg==' }) };
    mounted = await mount(<NoteBody markdown="![[local.pdf]]" {...kept} />);
    const link = [...mounted.container.querySelectorAll('a')].find((each) => each.textContent === 'Open')!;
    await act(async () => link.click());
    await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(fetched).toHaveBeenCalledWith('data:application/pdf;base64,JVBERg==');
    expect(tab.location.href).toBe('blob:local/pdf');
    open.mockRestore();
    fetched.mockRestore();
  });

  it('is drawn by renderAttachment, which wins over fileOf', () => {
    expect(html('![[report.pdf]]', { ...host, renderAttachment: ({ name }) => <b>{name}</b> })).toContain('<b>report.pdf</b>');
  });
});
