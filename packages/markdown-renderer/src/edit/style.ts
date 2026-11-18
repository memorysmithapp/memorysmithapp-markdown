/**
 * A `:::{style}` block written from the editor's controls (`SPEC.md` §7.16, #166): wrapping a
 * passage, and changing the options of the block the cursor is in, as changes to the note's bytes
 * that touch nothing else. No React and no DOM.
 *
 * A block never opens above the frontmatter: a selection that takes it in, the whole note
 * included, opens the block on the line after its closing `---` (§6.1), since a note whose first
 * line is the fence has no frontmatter at all.
 */

import { STYLE_KEYS, type NoteStyle } from '../note-style.js';
import { frontmatterSpan, styleSpans, type StyleBlockSpan } from './analyze.js';
import type { TextChange } from './table.js';

/** Every style block of the note, by offsets. */
export function styleBlocks(text: string): StyleBlockSpan[] {
  return styleSpans(text);
}

/** The innermost style block that holds an offset, its fences included, or `null`. */
export function styleBlockAt(text: string, at: number): StyleBlockSpan | null {
  return (
    styleBlocks(text)
      .filter((block) => block.from <= at && at <= block.to)
      .sort((a, b) => b.depth - a.depth)[0] ?? null
  );
}

/** The options of a style, as its block writes them: only the keys it sets, in their order. */
export function optionsText(style: NoteStyle): string {
  const lines = STYLE_KEYS.flatMap((key) => (style[key] ? [`${key}: ${style[key]}`] : []));
  return lines.length === 0 ? '' : `---\n${lines.join('\n')}\n---`;
}

/** Changes a block's options to `style`: written, rewritten, or taken out when it sets nothing. */
export function setStyleOptions(block: StyleBlockSpan, style: NoteStyle): TextChange[] {
  const options = optionsText(style);
  if (block.options) {
    // Taken out with the line break before them, so the opening fence is followed by the content.
    return options ? [{ from: block.options.from, to: block.options.to, insert: options }] : [{ from: block.open.to, to: block.options.to, insert: '' }];
  }
  return options ? [{ from: block.open.to, to: block.open.to, insert: `\n${options}` }] : [];
}

/**
 * Wraps a passage in a style block: the lines `from` to `to` take in, or with no selection the
 * paragraph or block the cursor is in, up to the blank lines around it. Answers the changes and
 * where the cursor goes, at the start of the content.
 */
export function wrapInStyle(text: string, from: number, to: number, style: NoteStyle): { changes: TextChange[]; cursor: number } {
  const body = frontmatterSpan(text)?.to ?? 0;
  let start = Math.max(from, body);
  let end = Math.max(to, start);
  const lineStart = (at: number): number => text.lastIndexOf('\n', at - 1) + 1;
  const lineEnd = (at: number): number => (text.indexOf('\n', at) === -1 ? text.length : text.indexOf('\n', at));
  const blank = (at: number): boolean => text.slice(lineStart(at), lineEnd(at)).trim() === '';
  if (start === end && !blank(start)) {
    // The paragraph or block the cursor is in: back and forth to the blank lines around it.
    start = lineStart(start);
    while (start > body && !blank(start - 1)) start = lineStart(start - 1);
    end = lineEnd(end);
    while (end < text.length && !blank(end + 1)) end = lineEnd(end + 1);
  } else {
    start = lineStart(start);
    // A selection that ends at the start of a line ends on the line before it.
    end = end > start && text[end - 1] === '\n' ? end - 1 : lineEnd(end);
  }
  const options = optionsText(style);
  const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const opening = `${before}:::{style}\n${options ? `${options}\n` : ''}`;
  const empty = start === end;
  const changes: TextChange[] = [
    { from: start, to: start, insert: empty ? `${opening}\n:::` : opening },
    ...(empty ? [] : [{ from: end, to: end, insert: '\n:::' }]),
  ];
  return { changes, cursor: start + opening.length };
}
