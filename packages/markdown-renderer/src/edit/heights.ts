/**
 * How tall a drawn block will be before it is drawn (#91).
 *
 * CodeMirror lays out the blocks it has not drawn yet by the height their widget estimates, and
 * reads that estimate once, when the block's decoration is made; a block drawn taller than its
 * estimate grows the document under the scrollbar as the author scrolls to it. Each block
 * estimates its height from what it draws — its lines wrapped at the editor's width, its rows, its
 * properties — and a block drawn once at a width is remembered at its measured height, so the same
 * block made again, moved by an edit above it or in the next edit of the note, starts right.
 */

/** What an estimate reads of the editor: its text column, its line height and its characters. */
export interface BlockMetrics {
  readonly width: number;
  readonly lineHeight: number;
  readonly charWidth: number;
}

/** What an estimate assumes before the editor has been measured, as in a test with no layout. */
export const DEFAULT_METRICS: BlockMetrics = { width: 700, lineHeight: 24, charWidth: 8 };

/**
 * The metrics of a text column laid out in `parent`, read before the editor exists there, so the
 * first estimates are made at the width the note is drawn at. Falls back to `DEFAULT_METRICS` where
 * nothing is laid out.
 */
export function measureMetrics(parent: HTMLElement): BlockMetrics {
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; visibility: hidden; white-space: pre; pointer-events: none';
  probe.textContent = 'abcdefghijklmnopqrstuvwxyz';
  parent.appendChild(probe);
  const box = probe.getBoundingClientRect();
  const width = parent.clientWidth;
  probe.remove();
  return withinReason({ width, lineHeight: box.height, charWidth: box.width / 26 });
}

/** Metrics as measured, any that could not be read replaced by the default. */
export function withinReason(metrics: BlockMetrics): BlockMetrics {
  const usable = (value: number, fallback: number) => (Number.isFinite(value) && value > 1 ? value : fallback);
  return {
    width: usable(metrics.width, DEFAULT_METRICS.width),
    lineHeight: usable(metrics.lineHeight, DEFAULT_METRICS.lineHeight),
    charWidth: usable(metrics.charWidth, DEFAULT_METRICS.charWidth),
  };
}

/** The lines a text takes in a column `width` wide, each of its lines at least one. */
function wrapped(lines: readonly string[], width: number, metrics: BlockMetrics): number {
  const perLine = Math.max(8, Math.floor(width / metrics.charWidth));
  return lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

/**
 * Below this width the default theme lays a property's value under its key, not beside it; it is
 * the text column of its 560px breakpoint.
 */
const STACKED_PROPERTIES = 528;

/** What a block is, for its estimate. */
export type BlockKind = 'frontmatter' | 'callout' | 'table' | 'embed' | 'diagram' | 'preview' | 'add-properties';

/** The height a block of this kind and these lines is drawn at, near enough to lay out the page. */
export function estimateHeight(kind: BlockKind, source: string, metrics: BlockMetrics): number {
  const { lineHeight } = metrics;
  const lines = source.split('\n');
  switch (kind) {
    case 'frontmatter': {
      // The name's field, then a row per key of the top level, which a list's items share.
      const keys = lines.filter((line) => /^[^\s#-][^:]*:/.test(line)).length;
      const row = (metrics.width < STACKED_PROPERTIES ? 2.8 : 1.4) * lineHeight;
      return Math.round(2.5 * lineHeight + keys * row);
    }
    case 'callout': {
      // Its title and its body, as text inside its padding and its border.
      const text = lines.map((line) => line.replace(/^(?:\s*>)+\s?/, ''));
      return Math.round(lineHeight + wrapped(text, metrics.width - 32, metrics) * lineHeight);
    }
    case 'table': {
      // A row per line but the delimiter row. The columns share the width by what they hold, so a
      // row wraps as the text of all its cells would in the width their padding leaves.
      const rows = lines.filter((line, index) => index !== 1 || !/^[\s|:-]+$/.test(line));
      const cells = (row: string) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim());
      const columns = Math.max(1, ...rows.map((row) => cells(row).length));
      const width = metrics.width - 16 * columns;
      const height = rows.reduce((sum, row) => sum + 9 + lineHeight * wrapped([cells(row).join('')], width, metrics), 0);
      return Math.round(0.75 * lineHeight + height);
    }
    case 'embed':
      // What a note or a file embeds is not known before it is drawn: a card's height.
      return Math.round(8 * lineHeight);
    case 'diagram':
      return Math.round(12 * lineHeight);
    case 'preview':
      return Math.round(lineHeight + wrapped(lines, metrics.width, metrics) * lineHeight);
    case 'add-properties':
      return Math.round(1.5 * lineHeight);
  }
}

/** The heights blocks were drawn at, by width and content; the oldest are let go past the limit. */
const measured = new Map<string, number>();
const MEASURED_LIMIT = 2000;

const measuredKey = (identity: string, metrics: BlockMetrics) => `${Math.round(metrics.width)}\u0000${identity}`;

/** The height a block of this content was drawn at at this width, if it was. */
export function measuredHeight(identity: string, metrics: BlockMetrics): number | undefined {
  return measured.get(measuredKey(identity, metrics));
}

/** Remembers the height a block was drawn at. */
export function rememberHeight(identity: string, metrics: BlockMetrics, height: number): void {
  if (!(height > 0)) return;
  const key = measuredKey(identity, metrics);
  measured.delete(key);
  measured.set(key, height);
  if (measured.size > MEASURED_LIMIT) measured.delete(measured.keys().next().value!);
}
