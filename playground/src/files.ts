/**
 * The files the playground's notebooks keep, as a host would describe them (#77): each with the
 * attributes MemorySmith keeps — its name, its media type, its size, a description — and its bytes
 * as a base64 `data:` address, so the page needs no server to show it. They are loaded when the
 * playground starts: the fixture images of the notebooks, and one sample of each type MemorySmith
 * accepts, which `fixtures/make-files.mjs` made and `fixtures/files.json` describes.
 */

import type { KeptFile } from '@memorysmithapp/markdown-renderer';

export interface StoredFile extends KeptFile {
  readonly name: string;
  readonly description: string;
}

/** A sample's attributes, as `fixtures/files.json` lists them. */
export interface SampleAttributes {
  readonly name: string;
  readonly mimeType: string;
  readonly description: string;
}

/** The bytes a base64 `data:` address holds. */
export function bytesOf(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

/** The same bytes under the media type the file is kept as: the bundler guesses one from the extension. */
function retyped(dataUrl: string, mimeType: string): string {
  return `data:${mimeType};base64,${dataUrl.slice(dataUrl.indexOf(',') + 1)}`;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

/**
 * The files each notebook keeps at the start: every sample, by the name the manifest gives it, and
 * the notebook's own fixture images, whose types the playground names from their extensions — it
 * knows its fixtures; the renderer never reads a name for a type.
 */
export function startingFiles(
  images: Readonly<Record<string, string>>,
  samples: Readonly<Record<string, string>>,
  attributes: readonly SampleAttributes[],
  slugs: readonly string[],
): Record<string, Record<string, StoredFile>> {
  const shared: StoredFile[] = attributes.flatMap(({ name, mimeType, description }) => {
    const url = samples[name];
    return url ? [{ name, mimeType, description, url: retyped(url, mimeType), bytes: bytesOf(url) }] : [];
  });
  const all: Record<string, Record<string, StoredFile>> = Object.fromEntries(slugs.map((slug) => [slug, Object.fromEntries(shared.map((file) => [file.name, file]))]));
  for (const [path, url] of Object.entries(images)) {
    const [slug, , name] = path.split('/');
    if (!slug || !name) continue;
    const mimeType = MIME_BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
    const key = name.normalize('NFC');
    all[slug] = { ...all[slug], [key]: { name: key, mimeType, description: '', url: retyped(url, mimeType), bytes: bytesOf(url) } };
  }
  return all;
}

/** A file the author attached, read as a base64 `data:` address. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(file);
  });
}
