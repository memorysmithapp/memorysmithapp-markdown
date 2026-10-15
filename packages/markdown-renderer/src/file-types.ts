/**
 * How a file the notebook keeps is drawn, by its media type and never by its name (SPEC.md §5.8,
 * #77). The list is MemorySmith's closed one — *observed* at `4b67c7e`, `FILE_TYPES` in its
 * contracts — sixteen types, each with the shape a reading surface draws it in: what a browser
 * draws without running anything is drawn, an image, an audio, a video, and everything else is a
 * card, the PDF included. A type outside the list is a card too, named by its media type.
 */

export type FileShape = 'image' | 'audio' | 'video' | 'card';

interface FileType {
  readonly mimeType: string;
  readonly renders: FileShape;
  /** Whether a browser shows a card's file on its own, so the card may offer to open it: the PDF. */
  readonly opens?: boolean;
}

export const FILE_TYPES: readonly FileType[] = [
  { mimeType: 'image/png', renders: 'image' },
  { mimeType: 'image/jpeg', renders: 'image' },
  { mimeType: 'image/webp', renders: 'image' },
  { mimeType: 'image/gif', renders: 'image' },
  { mimeType: 'image/svg+xml', renders: 'image' },
  { mimeType: 'application/pdf', renders: 'card', opens: true },
  { mimeType: 'audio/mpeg', renders: 'audio' },
  { mimeType: 'audio/wav', renders: 'audio' },
  { mimeType: 'audio/ogg', renders: 'audio' },
  { mimeType: 'audio/webm', renders: 'audio' },
  { mimeType: 'video/mp4', renders: 'video' },
  { mimeType: 'video/webm', renders: 'video' },
  { mimeType: 'video/quicktime', renders: 'video' },
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', renders: 'card' },
  { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', renders: 'card' },
  { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', renders: 'card' },
];

function typeOf(mimeType: string): FileType | null {
  return FILE_TYPES.find((each) => each.mimeType === mimeType.trim().toLowerCase()) ?? null;
}

/** The shape a type is drawn in: `card` for anything this surface does not draw. */
export function rendersAs(mimeType: string): FileShape {
  return typeOf(mimeType)?.renders ?? 'card';
}

/** Whether a browser shows the file on its own: everything drawn, and a card's only when its type says so. */
export function opensInBrowser(mimeType: string): boolean {
  const type = typeOf(mimeType);
  if (!type) return false;
  return type.renders === 'card' ? type.opens === true : true;
}

/** What a type is called in the reader's words, or its media type when it is not on the list or has none. */
export function fileKind(mimeType: string, words: Readonly<Record<string, string>>): string {
  const type = typeOf(mimeType);
  return type ? (words[type.mimeType] ?? mimeType) : mimeType;
}

/** A size as MemorySmith writes it, in the reader's locale: bytes, then kB, MB and GB in steps of 1024. */
export function formatBytes(bytes: number, locale: string): string {
  const units = [
    { limit: 1024, divisor: 1, unit: 'byte', digits: 0 },
    { limit: 1024 ** 2, divisor: 1024, unit: 'kilobyte', digits: 0 },
    { limit: 1024 ** 3, divisor: 1024 ** 2, unit: 'megabyte', digits: bytes >= 1024 ** 2 * 10 ? 0 : 1 },
    { limit: Infinity, divisor: 1024 ** 3, unit: 'gigabyte', digits: 1 },
  ];
  const scale = units.find((each) => bytes < each.limit) ?? units[units.length - 1]!;
  return new Intl.NumberFormat(locale, { style: 'unit', unit: scale.unit, unitDisplay: 'short', maximumFractionDigits: scale.digits }).format(bytes / scale.divisor);
}

/**
 * The address of a file's bytes as it will be written, or the empty string when this surface will
 * not follow it: a path, the web, a `blob:` the host made, or the bytes themselves as `data:` —
 * never a scheme that runs something, nor `data:` of a type a browser runs as a page or a script.
 */
export function fileAddress(url: string): string {
  const trimmed = url.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return url;
  if (/^(https?|blob):/i.test(trimmed)) return url;
  if (/^data:/i.test(trimmed) && !/^data:\s*(text\/html|application\/xhtml\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)/i.test(trimmed)) return url;
  return '';
}
