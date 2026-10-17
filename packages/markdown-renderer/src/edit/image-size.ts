/**
 * The size an image is drawn at, as its notation writes it (#98): the dimensions after the pipe
 * of a Markdown image's description, `![description|300](address)` (`SPEC.md` §3.14), or of the
 * embed of a file the notebook keeps, `![[photo.jpg|300]]` (§5.7) — pixels, a width and a height,
 * or a share of the page (#108). The editor reads them and rewrites them, and the description
 * before the pipe of a Markdown image (#106), and no other byte.
 */

import { readDimensions, readImageAlt, writeDimensions, type Dimensions } from '../image-dimensions.js';
import type { TextChange } from './table.js';

export interface ImageSize extends Dimensions {
  /**
   * Where in the source the dimensions are written, their pipe included; an empty span where they
   * would be written when there are none.
   */
  readonly at: { readonly from: number; readonly to: number };
  /** What separates them from the rest: `|`, or `\|` in an embed whose pipe is escaped. */
  readonly pipe: string;
  /**
   * The description of a Markdown image, as it reads, and where it is written, before its pipe;
   * `null` for an embed, whose pipe is the only thing it writes (§5.8).
   */
  readonly description: { readonly text: string; readonly from: number; readonly to: number } | null;
}

/** The largest width the notation writes: five digits (`SPEC.md` §3.14). */
export const MAX_IMAGE_WIDTH = 99999;

const UNSIZED = { width: null, height: null, percent: null } as const;

/** The alt text of a Markdown image, a bracket escaped inside it included. */
const MARKDOWN_IMAGE = /^!\[((?:\\.|[^\]\\])*)\]\(/;
const EMBED = /^!\[\[([^\]]*)\]\]$/;

/**
 * The size an image's source declares, and where it is written. `null` for a source that is not an
 * image's notation, and for an embed whose pipe holds something other than dimensions, which the
 * editor does not overwrite.
 */
export function readImageSize(source: string): ImageSize | null {
  // A block's line may be indented, or end in spaces, around its one embed.
  const lead = source.length - source.trimStart().length;
  const size = readTrimmed(source.trim());
  if (!size || !lead) return size;
  const shift = <T extends { from: number; to: number }>(span: T): T => ({ ...span, from: span.from + lead, to: span.to + lead });
  return { ...size, at: shift(size.at), description: size.description && shift(size.description) };
}

function readTrimmed(source: string): ImageSize | null {
  const image = MARKDOWN_IMAGE.exec(source);
  if (image) {
    const alt = image[1] ?? '';
    const start = 2;
    const read = readImageAlt(alt);
    if (read.width === null && read.percent === null) {
      const end = start + alt.length;
      return { ...UNSIZED, at: { from: end, to: end }, pipe: '|', description: { text: unescape(alt), from: start, to: end } };
    }
    const pipe = start + alt.lastIndexOf('|');
    return { ...read, at: { from: pipe, to: start + alt.length }, pipe: '|', description: { text: unescape(alt.slice(0, pipe - start)), from: start, to: pipe } };
  }
  const embed = EMBED.exec(source);
  if (embed) {
    const inner = embed[1] ?? '';
    const start = 3;
    const pipe = /\\?\|/.exec(inner);
    if (!pipe) return { ...UNSIZED, at: { from: start + inner.length, to: start + inner.length }, pipe: '|', description: null };
    const measured = readDimensions(inner.slice(pipe.index + pipe[0].length));
    if (!measured) return null;
    return { ...measured, at: { from: start + pipe.index, to: start + inner.length }, pipe: pipe[0], description: null };
  }
  return null;
}

/** The text of a description as a reader gets it: a backslash escape is the character it escapes. */
function unescape(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

/**
 * The change that draws the image whose source starts at `from` at the dimensions asked — a width
 * as a number, its height following, or whole `Dimensions` — or at its own size for `null`: the
 * dimensions written, replaced or taken away, and nothing else. Empty when the source is not an
 * image's notation, already says so, or the dimensions asked are none the notation writes: a
 * value out of its range is refused, never brought into it.
 */
export function resizeImage(source: string, from: number, asked: number | Dimensions | null): TextChange[] {
  const size = readImageSize(source);
  if (!size) return [];
  const wanted = typeof asked === 'number' ? { width: Math.round(asked), height: null, percent: null } : asked;
  if (wanted !== null && !writable(wanted)) return [];
  const insert = wanted === null ? '' : `${size.pipe}${writeDimensions(wanted)}`;
  if (insert === source.slice(size.at.from, size.at.to)) return [];
  return [{ from: from + size.at.from, to: from + size.at.to, insert }];
}

/** Whether the notation writes these dimensions (§3.14): five digits from 1, or 1% to 100%. */
function writable({ width, height, percent }: Dimensions): boolean {
  const pixels = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_IMAGE_WIDTH;
  if (percent !== null) return width === null && height === null && Number.isInteger(percent) && percent >= 1 && percent <= 100;
  return width !== null && pixels(width) && (height === null || pixels(height));
}

/**
 * The change that writes `text` as the description of the Markdown image whose source starts at
 * `from`, before its pipe, which it keeps (§3.14): a bracket and a backslash escaped, so the image
 * stays one. Empty for an embed, which has no description to write (§5.8), and when nothing changes.
 */
export function describeImage(source: string, from: number, text: string): TextChange[] {
  const size = readImageSize(source);
  if (!size?.description || size.description.text === text) return [];
  return [{ from: from + size.description.from, to: from + size.description.to, insert: text.replace(/[\\[\]]/g, '\\$&') }];
}
