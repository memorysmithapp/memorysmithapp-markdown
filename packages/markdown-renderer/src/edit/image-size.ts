/**
 * The size an image is drawn at, as its notation writes it (#98): the dimensions after the pipe
 * of a Markdown image's description, `![description|300](address)` (`SPEC.md` §3.14), or of the
 * embed of a file the notebook keeps, `![[photo.jpg|300]]` (§5.7). The editor reads them and
 * rewrites them, and no other byte.
 */

import { readDimensions, readImageAlt } from '../image-dimensions.js';
import type { TextChange } from './table.js';

export interface ImageSize {
  /** The width it declares, or `null` when it is drawn at its own size. */
  readonly width: number | null;
  readonly height: number | null;
  /** The width it declares as a share of the page, from 1 to 100, or `null` (#108). */
  readonly percent: number | null;
  /**
   * Where in the source the dimensions are written, their pipe included; an empty span where they
   * would be written when there are none.
   */
  readonly at: { readonly from: number; readonly to: number };
  /** What separates them from the rest: `|`, or `\|` in an embed whose pipe is escaped. */
  readonly pipe: string;
}

/** The largest width the notation writes: five digits (`SPEC.md` §3.14). */
export const MAX_IMAGE_WIDTH = 99999;

const UNSIZED = { width: null, height: null, percent: null } as const;

const MARKDOWN_IMAGE = /^!\[([^\]]*)\]\(/;
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
  return size && lead ? { ...size, at: { from: size.at.from + lead, to: size.at.to + lead } } : size;
}

function readTrimmed(source: string): ImageSize | null {
  const image = MARKDOWN_IMAGE.exec(source);
  if (image) {
    const alt = image[1] ?? '';
    const start = 2;
    const read = readImageAlt(alt);
    if (read.width === null && read.percent === null) return { ...UNSIZED, at: { from: start + alt.length, to: start + alt.length }, pipe: '|' };
    return { width: read.width, height: read.height, percent: read.percent, at: { from: start + alt.lastIndexOf('|'), to: start + alt.length }, pipe: '|' };
  }
  const embed = EMBED.exec(source);
  if (embed) {
    const inner = embed[1] ?? '';
    const start = 3;
    const pipe = /\\?\|/.exec(inner);
    if (!pipe) return { ...UNSIZED, at: { from: start + inner.length, to: start + inner.length }, pipe: '|' };
    const measured = readDimensions(inner.slice(pipe.index + pipe[0].length));
    if (!measured) return null;
    return { ...measured, at: { from: start + pipe.index, to: start + inner.length }, pipe: pipe[0] };
  }
  return null;
}

/**
 * The change that draws the image whose source starts at `from` at `width`, its height following,
 * or at its own size for `null`: the dimensions written, replaced or taken away, and nothing else.
 * Empty when the source is not an image's notation or already says so.
 */
export function resizeImage(source: string, from: number, width: number | null): TextChange[] {
  const size = readImageSize(source);
  if (!size) return [];
  const wanted = width === null ? null : Math.min(MAX_IMAGE_WIDTH, Math.max(1, Math.round(width)));
  if (wanted === size.width && (wanted === null || size.height === null) && (wanted !== null || size.percent === null)) return [];
  const insert = wanted === null ? '' : `${size.pipe}${wanted}`;
  return [{ from: from + size.at.from, to: from + size.at.to, insert }];
}
