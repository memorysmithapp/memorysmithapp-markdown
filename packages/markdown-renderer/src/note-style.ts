/**
 * How a note is set: its face, and the alignment of its headings, its text and its tables (#164,
 * memorysmithapp/memorysmithapp#493).
 *
 * The notebook keeps a style, and the host hands it to the renderer as `noteStyle`; a passage of a
 * note may differ from it in a `:::{style}` block (`SPEC.md` §7.16). Either way the choice is
 * written as custom properties on the element it governs — the root of the note, or the block — so
 * an inner choice wins over an outer one by inheritance, and the stylesheet reads them with today's
 * drawing as their fallback: a note with no style is drawn exactly as before.
 *
 * Justified text hyphenates, in the language the host gives (`strings.locale`), which is what the
 * element that justifies is marked with: a browser hyphenates only a language it is told.
 */

export type StyleFont = 'sans' | 'serif';
export type StyleAlignment = 'left' | 'center' | 'right' | 'justify';

/** A style: each key left out is what the renderer draws with none. */
export interface NoteStyle {
  /** The face of the text and the headings. */
  readonly font?: StyleFont;
  /** The alignment of headings. */
  readonly headings?: StyleAlignment;
  /** The alignment of paragraphs and list items. */
  readonly text?: StyleAlignment;
  /** The alignment of a table's cells whose column declares none, and of a `table` block's text columns. */
  readonly tables?: StyleAlignment;
}

export const STYLE_FONTS: readonly StyleFont[] = ['sans', 'serif'];
export const STYLE_ALIGNMENTS: readonly StyleAlignment[] = ['left', 'center', 'right', 'justify'];
export const STYLE_KEYS = ['font', 'headings', 'text', 'tables'] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

/** Whether `value` is one `key` takes. */
export function takes(key: StyleKey, value: string): boolean {
  return key === 'font' ? (STYLE_FONTS as readonly string[]).includes(value) : (STYLE_ALIGNMENTS as readonly string[]).includes(value);
}

/** A style with only the keys and values it may hold: a host's mistake is ignored, never drawn. */
export function cleanStyle(style: NoteStyle | null | undefined): NoteStyle {
  if (!style) return {};
  const clean: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    const value = (style as Record<string, unknown>)[key];
    if (typeof value === 'string' && takes(key, value)) clean[key] = value;
  }
  return clean as NoteStyle;
}

/** The custom properties that set a style on the element it governs; empty for no style. */
export function styleProperties(style: NoteStyle): Record<string, string> {
  const properties: Record<string, string> = {};
  if (style.font) {
    properties['--ms-face'] = style.font === 'serif' ? 'var(--ms-font-serif)' : 'var(--ms-font-sans)';
    properties['--ms-face-heading'] = style.font === 'serif' ? 'var(--ms-font-serif)' : 'var(--ms-font-heading)';
  }
  if (style.headings) properties['--ms-align-headings'] = style.headings;
  if (style.text) {
    properties['--ms-align-text'] = style.text;
    properties['--ms-hyphens-text'] = style.text === 'justify' ? 'auto' : 'manual';
  }
  if (style.tables) {
    properties['--ms-align-tables'] = style.tables;
    properties['--ms-hyphens-tables'] = style.tables === 'justify' ? 'auto' : 'manual';
  }
  return properties;
}

/** Whether a style justifies anything, so the element it governs carries the language to hyphenate in. */
export const justifies = (style: NoteStyle): boolean => STYLE_KEYS.some((key) => key !== 'font' && style[key] === 'justify');
