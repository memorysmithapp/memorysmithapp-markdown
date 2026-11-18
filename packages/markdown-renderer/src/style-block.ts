/**
 * The `:::{style}` block (`SPEC.md` §7.16, #164): a passage of a note set apart from the notebook's
 * style, a colon fence holding its options in a `---` block, as MyST writes a directive.
 *
 * ```markdown
 * :::{style}
 * ---
 * text: justify
 * headings: center
 * ---
 * # Ata da assembleia
 * :::
 * ```
 *
 * No parser of this package reads a colon fence, so the block is found here, on the text, as the
 * code regions and the comments are: a fence inside code is an example and is never read. Each
 * fence line and each line of the options is then written as spaces of its own length, which keeps
 * every offset and every line of the text, and leaves the content parsed exactly as it would be on
 * its own — a line of options is no setext heading (§3.4), and the content's headings are the
 * note's (§3.3). What a block sets is drawn by wrapping the content it holds, by its lines.
 *
 * A block opens at the margin, up to three spaces in, never inside a quote or a list. A bare colon
 * fence closes the innermost open block whose fence it is at least as long as; one that closes
 * nothing is text. A block never closed runs to the end of the note. A key or a value the style
 * cannot take, and a block never closed, are its notices (§7.13); none is an error.
 */

import { codeRegions, insideCode } from './source.js';
import { STYLE_KEYS, justifies, styleProperties, takes, type NoteStyle, type StyleKey } from './note-style.js';

export type StyleNoticeCode = 'style-key-unknown' | 'style-value-invalid' | 'style-unclosed';

export interface StyleProblem {
  readonly code: StyleNoticeCode;
  /** The line it is about, from 1, and its offset in the text. */
  readonly line: number;
  readonly at: number;
  readonly end: number;
}

export interface StyleBlock {
  /** The line of the opening fence, from 1. */
  readonly open: number;
  /** The line of the closing fence, or `null` for a block that runs to the end of the text. */
  readonly close: number | null;
  /** The first and last lines of what the block holds, which may be none (`from > to`). */
  readonly from: number;
  readonly to: number;
  /** What the block sets: the keys and values its options may hold. */
  readonly style: NoteStyle;
  /** How deep it sits among the blocks, from 0. */
  readonly depth: number;
}

export interface StyleBlocks {
  /** The text with every fence and option line written as spaces. */
  readonly text: string;
  readonly blocks: readonly StyleBlock[];
  readonly problems: readonly StyleProblem[];
}

const OPEN = /^ {0,3}(:{3,})\{style\}[ \t]*$/;
const CLOSE = /^ {0,3}(:{3,})[ \t]*$/;
const RULE = /^ {0,3}---[ \t]*$/;
const OPTION = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*?)[ \t]*$/;

/** Every style block of a text, and the text with their fences and options blanked. */
export function findStyleBlocks(text: string): StyleBlocks {
  if (!text.includes(':::')) return { text, blocks: [], problems: [] };
  const lines = text.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const code = codeRegions(text);
  const blank = new Set<number>();
  const blocks: StyleBlock[] = [];
  const problems: StyleProblem[] = [];
  const open: { open: number; colons: number; from: number; style: NoteStyle }[] = [];
  const problem = (code: StyleNoticeCode, index: number): void => {
    problems.push({ code, line: index + 1, at: starts[index] ?? 0, end: (starts[index] ?? 0) + (lines[index] ?? '').length });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line.includes(':') || insideCode(code, starts[index] ?? 0)) continue;
    const opening = OPEN.exec(line);
    if (opening) {
      blank.add(index);
      let from = index + 1;
      const style: Record<string, string> = {};
      // The options: a `---` on the line after the fence, up to the next `---`, as the frontmatter
      // is read (§6.2). With no `---` to close them, there are none, and the lines are content.
      if (RULE.test(lines[index + 1] ?? '')) {
        const end = lines.findIndex((each, at) => at > index + 1 && RULE.test(each));
        if (end !== -1) {
          const seen = new Set<string>();
          for (let at = index + 1; at <= end; at++) blank.add(at);
          for (let at = index + 2; at < end; at++) {
            const option = lines[at] ?? '';
            if (option.trim() === '') continue;
            const read = OPTION.exec(option.trim());
            const key = read?.[1]?.toLowerCase();
            if (!read || !key || !(STYLE_KEYS as readonly string[]).includes(key) || seen.has(key)) {
              problem('style-key-unknown', at);
              continue;
            }
            seen.add(key);
            const value = (read[2] ?? '').replace(/^(['"])(.*)\1$/, '$2').trim().toLowerCase();
            if (takes(key as StyleKey, value)) style[key] = value;
            else problem('style-value-invalid', at);
          }
          from = end + 1;
        }
      }
      open.push({ open: index + 1, colons: opening[1]!.length, from: from + 1, style: style as NoteStyle });
      index = from - 1;
      continue;
    }
    const closing = CLOSE.exec(line);
    if (closing && open.length > 0 && closing[1]!.length >= open[open.length - 1]!.colons) {
      const block = open.pop()!;
      blank.add(index);
      blocks.push({ open: block.open, close: index + 1, from: block.from, to: index, style: block.style, depth: open.length });
    }
  }
  // A block never closed runs to the end of the note, as an unclosed fence does.
  while (open.length > 0) {
    const block = open.pop()!;
    problem('style-unclosed', block.open - 1);
    blocks.push({ open: block.open, close: null, from: block.from, to: lines.length, style: block.style, depth: open.length });
  }
  if (blocks.length === 0) return { text, blocks: [], problems };
  const blanked = lines.map((line, index) => (blank.has(index) ? ' '.repeat(line.length) : line)).join('\n');
  blocks.sort((a, b) => a.open - b.open);
  problems.sort((a, b) => a.at - b.at);
  return { text: blanked, blocks, problems };
}

/** A block as one run of a note draws it: its lines in the run's own count, from 1. */
export interface StyleRange {
  readonly from: number;
  readonly to: number;
  readonly style: NoteStyle;
  readonly depth: number;
}

/** The blocks that reach the lines `first` to `last` of the text, in those lines' own count. */
export function rangesFor(blocks: readonly StyleBlock[], first: number, last: number): StyleRange[] {
  return blocks.flatMap((block) => {
    const from = Math.max(block.from, first);
    const to = Math.min(block.to, last);
    return from > to ? [] : [{ from: from - first + 1, to: to - first + 1, style: block.style, depth: block.depth }];
  });
}

/** What a line of the text is set as, every block that holds it merged, the innermost winning. */
export function styleAt(blocks: readonly StyleBlock[], line: number): NoteStyle {
  return blocks
    .filter((block) => block.from <= line && line <= block.to)
    .sort((a, b) => a.depth - b.depth)
    .reduce<NoteStyle>((merged, block) => ({ ...merged, ...block.style }), {});
}

interface Node {
  type: string;
  children?: Node[];
  position?: { start: { line: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** The attributes of the element that draws a block: its class, its style's custom properties, what it sets, and the language when it justifies. */
export function blockAttributes(style: NoteStyle, locale: string): Record<string, unknown> {
  const css = Object.entries(styleProperties(style))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return {
    className: ['style-block'],
    ...(css ? { style: css } : {}),
    ...Object.fromEntries(STYLE_KEYS.flatMap((key) => (style[key] ? [[`data${key[0]!.toUpperCase()}${key.slice(1)}`, style[key]]] : []))),
    ...(justifies(style) ? { lang: locale } : {}),
  };
}

/**
 * Wraps what each block holds, by its lines, in the element that draws it: a `div.style-block`
 * carrying its style as custom properties, which its content inherits and an inner block's own
 * override. The last plugin of a run, so every other one reads the tree as the parser left it.
 */
export function remarkStyleBlocks(options: { readonly ranges: readonly StyleRange[]; readonly locale: string }) {
  return (tree: unknown): void => {
    if (options.ranges.length === 0) return;
    const root = tree as Node;
    root.children = wrap(root.children ?? [], [...options.ranges].sort((a, b) => a.from - b.from || a.depth - b.depth), options.locale);
  };
}

function wrap(children: Node[], ranges: readonly StyleRange[], locale: string): Node[] {
  if (ranges.length === 0) return children;
  // The outermost ranges here; the others lie inside one of them.
  const outer = ranges.filter((range) => !ranges.some((other) => other !== range && other.depth < range.depth && other.from <= range.from && range.to <= other.to));
  // Each child at the line it starts on; one with no position goes with the child before it.
  let line = 0;
  const lines = children.map((child) => (line = child.position?.start.line ?? line));
  const result: Node[] = [];
  let index = 0;
  while (index < children.length) {
    const at = lines[index]!;
    const range = outer.find((each) => each.from <= at && at <= each.to);
    if (!range) {
      result.push(children[index]!);
      index++;
      continue;
    }
    const held: Node[] = [];
    while (index < children.length && lines[index]! <= range.to && lines[index]! >= range.from) held.push(children[index++]!);
    const inner = ranges.filter((each) => each !== range && each.depth > range.depth && range.from <= each.from && each.to <= range.to);
    result.push({ type: 'styleBlock', data: { hName: 'div', hProperties: blockAttributes(range.style, locale) }, children: wrap(held, inner, locale) });
  }
  return result;
}
