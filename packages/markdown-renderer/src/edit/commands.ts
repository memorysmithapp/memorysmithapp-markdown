/**
 * What the toolbar and the shortcuts of the editor do to a note (#52, #53, #57, #59).
 *
 * Each command is a change to the bytes around the selection and nothing else: a mark is the
 * delimiters written on either side of what is selected, a heading the `#` at the start of its
 * line, a list the marker of each line selected. The page the author sees follows from the text,
 * because the editor draws the text.
 */

import { EditorSelection, type ChangeSpec, type EditorState, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export type Command = (view: EditorView) => boolean;

/** A command from a function of the state, which answers `null` when it does not apply. */
export function command(spec: (state: EditorState) => TransactionSpec | null): Command {
  return (view) => {
    if (view.state.readOnly) return false;
    const transaction = spec(view.state);
    if (!transaction) return false;
    view.dispatch({ scrollIntoView: true, userEvent: 'input.format', ...transaction });
    view.focus();
    return true;
  };
}

/**
 * Writes or takes away a pair of delimiters around each selection: `**` bold, `_` italic, `~~`
 * struck, `==` marked, `` ` `` code. A selection that the delimiters already wrap, inside it or
 * just outside it, loses them; an empty one gains the pair with the cursor between.
 */
export function toggleMark(state: EditorState, delimiter: string): TransactionSpec {
  const size = delimiter.length;
  return state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - size, range.from);
    const after = state.sliceDoc(range.to, range.to + size);
    if (before === delimiter && after === delimiter) {
      return {
        changes: [
          { from: range.from - size, to: range.from },
          { from: range.to, to: range.to + size },
        ],
        range: EditorSelection.range(range.from - size, range.to - size),
      };
    }
    const inside = state.sliceDoc(range.from, range.to);
    if (inside.length >= size * 2 && inside.startsWith(delimiter) && inside.endsWith(delimiter)) {
      return {
        changes: { from: range.from, to: range.to, insert: inside.slice(size, -size) },
        range: EditorSelection.range(range.from, range.to - size * 2),
      };
    }
    return {
      changes: [
        { from: range.from, insert: delimiter },
        { from: range.to, insert: delimiter },
      ],
      range: EditorSelection.range(range.from + size, range.to + size),
    };
  });
}

/** The lines the selection touches, each once. */
function selectedLines(state: EditorState): { from: number; to: number; text: string; number: number }[] {
  const seen = new Set<number>();
  const lines: { from: number; to: number; text: string; number: number }[] = [];
  for (const range of state.selection.ranges) {
    for (let at = state.doc.lineAt(range.from).number; at <= state.doc.lineAt(range.to).number; at++) {
      if (seen.has(at)) continue;
      seen.add(at);
      const line = state.doc.line(at);
      lines.push({ from: line.from, to: line.to, text: line.text, number: at });
    }
  }
  return lines;
}

const QUOTE = /^(?:[ \t]{0,3}>[ \t]?)*/;
const HEADING = /^#{1,6}(?:[ \t]+|$)/;
const LIST = /^([ \t]*)(?:([-*+]|\d{1,9}[.)])[ \t]+(\[[ xX]\][ \t]+)?)?/;

/** Makes each selected line a heading of `level`, or a paragraph at 0; a quotation's markers stay. */
export function setHeading(state: EditorState, level: number): TransactionSpec {
  const changes: ChangeSpec[] = selectedLines(state).map((line) => {
    const quote = QUOTE.exec(line.text)![0];
    const rest = line.text.slice(quote.length);
    const marker = HEADING.exec(rest)?.[0] ?? '';
    return { from: line.from + quote.length, to: line.from + quote.length + marker.length, insert: level > 0 ? `${'#'.repeat(level)} ` : '' };
  });
  return { changes };
}

/** The heading level of the line the cursor is on, or 0. */
export function headingLevel(state: EditorState): number {
  const text = state.doc.lineAt(state.selection.main.head).text;
  const marker = HEADING.exec(text.slice(QUOTE.exec(text)![0].length));
  return marker ? marker[0].trim().length : 0;
}

export type ListKind = 'bullet' | 'ordered' | 'task';

function listKindOf(text: string): ListKind | null {
  const match = LIST.exec(text.slice(QUOTE.exec(text)![0].length));
  if (!match?.[2]) return null;
  if (match[3]) return 'task';
  return /\d/.test(match[2]) ? 'ordered' : 'bullet';
}

/**
 * Makes each selected line an item of a list of `kind`, renumbering an ordered one from 1; when
 * every line already is one, they become paragraphs again. Blank lines among them are left alone;
 * a blank line alone starts a list.
 */
export function toggleList(state: EditorState, kind: ListKind): TransactionSpec {
  const selected = selectedLines(state);
  const marker = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : '1. ';
  // On a blank line a list starts: its marker, the cursor after it for the first item (#74).
  if (selected.every((line) => line.text.trim().length === 0)) {
    const line = state.doc.lineAt(state.selection.main.head);
    const quote = QUOTE.exec(line.text)![0];
    return { changes: { from: line.from + quote.length, to: line.to, insert: marker }, selection: { anchor: line.from + quote.length + marker.length } };
  }
  const lines = selected.filter((line) => line.text.trim().length > 0);
  const remove = lines.length > 0 && lines.every((line) => listKindOf(line.text) === kind);
  let number = 1;
  const changes: ChangeSpec[] = lines.map((line) => {
    const quote = QUOTE.exec(line.text)![0];
    const match = LIST.exec(line.text.slice(quote.length))!;
    const from = line.from + quote.length + match[1]!.length;
    const to = line.from + quote.length + match[0].length;
    const marker = remove ? '' : kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : `${number++}. `;
    return { from, to, insert: marker };
  });
  return { changes };
}

/** Quotes each selected line, or unquotes them when every one is quoted. */
export function toggleQuote(state: EditorState): TransactionSpec {
  const lines = selectedLines(state);
  const remove = lines.every((line) => /^[ \t]{0,3}>/.test(line.text));
  const changes: ChangeSpec[] = lines.map((line) => {
    if (!remove) return { from: line.from, insert: '> ' };
    const marker = /^[ \t]{0,3}>[ \t]?/.exec(line.text)![0];
    return { from: line.from, to: line.from + marker.length, insert: '' };
  });
  return { changes };
}

/**
 * Inserts a block on lines of its own: in place of the current line when it is blank, else after
 * the block the cursor is in, with a blank line on either side. `cursor` is where in the block the
 * cursor goes, from its start; past its end, the cursor goes to the line after it.
 */
export function insertBlock(state: EditorState, block: string, cursor: number): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.head);
  // A cursor past the block lands at the start of the line after it, made when there is none.
  const past = cursor > block.length;
  if (line.text.trim().length === 0) {
    const before = line.number > 1 && state.doc.line(line.number - 1).text.trim().length > 0 ? '\n' : '';
    const next = line.number < state.doc.lines && state.doc.line(line.number + 1).text.trim().length > 0;
    const last = line.number === state.doc.lines;
    const insert = `${before}${block}${next || (past && last) ? '\n' : ''}`;
    const start = line.from + before.length;
    return { changes: { from: line.from, to: line.to, insert }, selection: { anchor: past ? start + block.length + 1 : start + cursor } };
  }
  // After the paragraph the cursor is in: before the blank line that ends it, or at the end of the note.
  let end = line;
  while (end.number < state.doc.lines && state.doc.line(end.number + 1).text.trim().length > 0) end = state.doc.line(end.number + 1);
  const last = end.number === state.doc.lines;
  const start = end.to + 2;
  return {
    changes: { from: end.to, insert: `\n\n${block}${past && last ? '\n' : ''}` },
    selection: { anchor: past ? start + block.length + 1 : start + cursor },
  };
}

/** A link around the selection, with its address selected to be typed; `[](https://)` with none. */
export function insertLink(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const label = state.sliceDoc(range.from, range.to);
    const insert = `[${label}](https://)`;
    const address = range.from + label.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: label.length > 0 ? EditorSelection.range(address, address + 8) : EditorSelection.cursor(range.from + 1),
    };
  });
}

/** A wikilink around the selection; with none, `[[]]` with the cursor between, where names are suggested. */
export function insertWikilink(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const name = state.sliceDoc(range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert: `[[${name}]]` },
      range: EditorSelection.cursor(range.from + 2 + name.length),
    };
  });
}

/** A comment around the selection, or an empty one with the cursor inside (§7.6). */
export function toggleComment(state: EditorState): TransactionSpec {
  const range = state.selection.main;
  const inside = state.sliceDoc(range.from, range.to);
  if (inside.startsWith('%%') && inside.endsWith('%%') && inside.length >= 4) {
    return { changes: { from: range.from, to: range.to, insert: inside.slice(2, -2) } };
  }
  if (range.empty) return { changes: { from: range.from, insert: '%%  %%' }, selection: { anchor: range.from + 3 } };
  return {
    changes: [
      { from: range.from, insert: '%%' },
      { from: range.to, insert: '%%' },
    ],
    selection: { anchor: range.from + 2, head: range.to + 2 },
  };
}

/**
 * A footnote: its reference at the cursor, numbered after the highest number the note uses, and
 * its definition at the end of the note, where the cursor goes to write it (§7.12).
 */
export function insertFootnote(state: EditorState): TransactionSpec {
  const text = state.sliceDoc();
  const used = [...text.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1]));
  const label = String(Math.max(0, ...used) + 1);
  const at = state.selection.main.head;
  const tail = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  const definition = `${tail}[^${label}]: `;
  const reference = `[^${label}]`;
  return {
    changes: [
      { from: at, insert: reference },
      { from: text.length, insert: definition },
    ],
    selection: { anchor: text.length + reference.length + definition.length },
  };
}

/** Flips the task box whose `[` is at `at`, as `toggleTaskAt` does: `[x]` lower case on the way in. */
export function toggleTaskBox(state: EditorState, at: number): TransactionSpec | null {
  if (state.sliceDoc(at, at + 1) !== '[' || state.sliceDoc(at + 2, at + 3) !== ']') return null;
  const current = state.sliceDoc(at + 1, at + 2);
  return { changes: { from: at + 1, to: at + 2, insert: current === ' ' ? 'x' : ' ' } };
}

/** The blocks the toolbar inserts, each with where the cursor goes in it. */
export const BLOCKS = {
  callout: { text: '> [!note]\n> ', cursor: 12 },
  table: { text: '|  |  |\n| --- | --- |\n|  |  |', cursor: 2 },
  codeBlock: { text: '```\n\n```', cursor: 4 },
  math: { text: '$$\n\n$$', cursor: 3 },
  diagram: { text: '```mermaid\nflowchart LR\n  A --> B\n```', cursor: 23 },
  rule: { text: '---', cursor: 4 },
} as const;
