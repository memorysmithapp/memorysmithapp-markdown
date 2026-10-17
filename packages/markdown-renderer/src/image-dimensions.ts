/**
 * The pipe inside the alt text of an image, which separates the description
 * from the dimensions (`SPEC.md` §3.14).
 *
 * `![Engelbart|100x145](engelbart.jpg)` is 100 by 145 CSS pixels and
 * `![Engelbart|100](…)` is 100 wide with the aspect ratio kept. What precedes
 * the pipe is the **description** and is never dropped — it is what a person
 * gets when the image does not load, and it is what a screen reader says.
 *
 * **A value that is neither form is not a dimension.** `![Engelbart|large](…)`
 * keeps `Engelbart|large` as the whole description, because deleting what an
 * author wrote into an accessibility label is the worse of the two failures.
 * A width may be a share of the page, `![Engelbart|50%](…)`, which it is drawn
 * at most (#108).
 *
 * Until the specification declared this form, an imported note displayed the
 * pipe and the digits on screen and mandated the whole string as the label.
 */

export interface ImageAlt extends Dimensions {
  /** What a reader hears, and sees when the image does not load. */
  readonly description: string;
}

/**
 * What the pipe declares: a width and maybe a height in CSS pixels, or a width as a share of the
 * page, at most (#108). `percent` and `width` are never both set, and a height goes only with a
 * width in pixels.
 */
export interface Dimensions {
  readonly width: number | null;
  readonly height: number | null;
  /** The width as a share of the width the note is read at, from 1 to 100, which it is drawn at most. */
  readonly percent: number | null;
}

/** `100` or `100x145`, and nothing else. */
const DIMENSIONS = /^(\d{1,5})(?:x(\d{1,5}))?$/;

/** `1%` to `100%`, digits and nothing else: no height, no mixed pair, no fraction, no space (§3.14). */
const PERCENT = /^(\d{1,3})%$/;

/**
 * What follows a pipe, when it is a dimension and not text.
 *
 * The wikilink embed of an attachment carries the same thing the alt text of a
 * Markdown image does — `![[engelbart.jpg|100x145]]` and
 * `![Engelbart|100x145](…)` mean one thing — so both read it here.
 */
export function readDimensions(value: string): Dimensions | null {
  const trimmed = value.trim();
  const share = PERCENT.exec(trimmed);
  if (share) {
    const percent = Number(share[1]);
    return percent >= 1 && percent <= 100 ? { width: null, height: null, percent } : null;
  }
  const measured = DIMENSIONS.exec(trimmed);
  if (!measured) return null;
  return {
    width: Number(measured[1]),
    height: measured[2] === undefined ? null : Number(measured[2]),
    percent: null,
  };
}

/** The dimensions as the notation writes them after the pipe: `300`, `300x180` or `50%`; empty for none. */
export function writeDimensions({ width, height, percent }: Dimensions): string {
  if (percent !== null) return `${percent}%`;
  if (width === null) return '';
  return height === null ? String(width) : `${width}x${height}`;
}

/**
 * The attributes an element is drawn at for its dimensions: pixels as `width` and `height`, which
 * reserve the box before the bytes arrive, a height as a style too, since the surface gives an
 * image `height: auto`, which two numbers overrule; and a share of the page as a `max-width`, so
 * an image narrower than it keeps its own width and is never blurred (§3.14).
 */
export function sizedAttributes({ width, height, percent }: Dimensions): {
  width?: number;
  height?: number;
  style?: { height?: string; maxWidth?: string };
} {
  if (percent !== null) return { style: { maxWidth: `${percent}%` } };
  return {
    ...(width === null ? {} : { width }),
    ...(height === null ? {} : { height, style: { height: `${height}px` } }),
  };
}

const UNSIZED = { width: null, height: null, percent: null } as const;

export function readImageAlt(alt: string): ImageAlt {
  const at = alt.lastIndexOf('|');
  if (at === -1) return { description: alt, ...UNSIZED };

  const measured = readDimensions(alt.slice(at + 1));
  if (!measured) return { description: alt, ...UNSIZED };

  return { description: alt.slice(0, at).trim(), ...measured };
}
