/**
 * A table of a note, read as ranges of its bytes, and the edits the editor makes to it (#56).
 *
 * Every edit is a list of changes to the note: a cell's content replaced, a row inserted or
 * removed, a column inserted or removed in every row, the delimiter cell of one column rewritten.
 * A row an edit does not reach keeps its spacing and its pipes as written.
 */

import type { Span } from './analyze.js';

export type Alignment = 'left' | 'center' | 'right' | null;

export interface TableCell extends Span {
  /** The content as written, trimmed: the range is the content's, without the padding. */
  readonly text: string;
}

export interface TableRow extends Span {
  readonly cells: readonly TableCell[];
}

export interface Table extends Span {
  /** The note's text the table was read from. */
  readonly source: string;
  /** The header row, the delimiter row and the body rows, in order. */
  readonly rows: readonly TableRow[];
  readonly align: readonly Alignment[];
  /** Whether the header was written with a leading and a trailing pipe, which a new row copies. */
  readonly leadingPipe: boolean;
  readonly trailingPipe: boolean;
  /** What precedes the first cell of a row: a quotation's markers, or the indent of a list. */
  readonly prefix: string;
}

export interface TextChange {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

const PREFIX = /^(?:[ \t]*>[ \t]?)*[ \t]*/;

/** The offsets of the pipes of a line that separate cells: not escaped, not inside a code span. */
function pipesOf(source: string, from: number, to: number): number[] {
  const pipes: number[] = [];
  let code = 0;
  for (let i = from; i < to; i++) {
    const character = source[i];
    if (character === '\\') {
      i += 1;
      continue;
    }
    if (character === '`') {
      let run = 1;
      while (source[i + run] === '`') run += 1;
      code = code === run ? 0 : code === 0 ? run : code;
      i += run - 1;
      continue;
    }
    if (character === '|' && code === 0) pipes.push(i);
  }
  return pipes;
}

function rowOf(source: string, from: number, to: number): TableRow & { leading: boolean; trailing: boolean } {
  const start = from + (PREFIX.exec(source.slice(from, to))?.[0].length ?? 0);
  const pipes = pipesOf(source, start, to);
  const leading = pipes[0] === start;
  const trailing = pipes.length > 0 && /^[ \t]*$/.test(source.slice(pipes[pipes.length - 1]! + 1, to));
  const bounds = [leading ? pipes[0]! : start - 1, ...pipes.slice(leading ? 1 : 0)];
  if (!trailing) bounds.push(to);
  const cells: TableCell[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const open = bounds[i]! + 1;
    const close = bounds[i + 1]!;
    const raw = source.slice(open, close);
    const text = raw.trim();
    // An empty cell's range is one character in, where typing lands between its padding.
    const at = text.length === 0 ? open + Math.min(1, raw.length) : open + (raw.length - raw.trimStart().length);
    cells.push({ from: at, to: at + text.length, text });
  }
  return { from, to, cells, leading, trailing };
}

/** The table whose rows run from the line holding `from` to the line holding `to`. */
export function readTable(source: string, from: number, to: number): Table {
  const rows: TableRow[] = [];
  let leadingPipe = true;
  let trailingPipe = true;
  let at = source.lastIndexOf('\n', from - 1) + 1;
  const prefix = PREFIX.exec(source.slice(at, to))?.[0] ?? '';
  while (at <= to) {
    const newline = source.indexOf('\n', at);
    const end = newline === -1 ? source.length : newline;
    const row = rowOf(source, at, end);
    if (rows.length === 0) {
      leadingPipe = row.leading;
      trailingPipe = row.trailing;
    }
    rows.push({ from: row.from, to: row.to, cells: row.cells });
    if (newline === -1 || end >= to) break;
    at = end + 1;
  }
  const align = (rows[1]?.cells ?? []).map((cell): Alignment => {
    const left = cell.text.startsWith(':');
    const right = cell.text.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
  });
  return { source, from: rows[0]!.from, to: rows[rows.length - 1]!.to, rows, align, leadingPipe, trailingPipe, prefix };
}

/** A cell's content as written in a row: a pipe escaped, a line break a space. */
export function cellText(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/(?<!\\)\|/g, '\\|')
    .trim();
}

/** How many columns the table has: the header's. */
export function columnCount(table: Table): number {
  return Math.max(table.rows[0]?.cells.length ?? 1, 1);
}

function rowText(table: Table, cells: readonly string[]): string {
  const inner = cells.map((cell) => ` ${cell} `).join('|');
  return `${table.prefix}${table.leadingPipe ? '|' : ''}${inner}${table.trailingPipe ? '|' : ''}`;
}

/** The delimiter cell of an alignment. */
export function delimiterOf(alignment: Alignment): string {
  return alignment === 'center' ? ':---:' : alignment === 'right' ? '---:' : alignment === 'left' ? ':---' : '---';
}

/**
 * Replaces the content of one cell of the header (row 0) or of the body (row 2 on). A row with
 * fewer cells gains the ones it lacks at its end, and nothing else of the table moves.
 */
export function setCell(table: Table, row: number, column: number, value: string): TextChange[] {
  const target = table.rows[row];
  if (!target || row === 1) return [];
  const insert = cellText(value);
  const cell = target.cells[column];
  if (cell) return cell.text === insert ? [] : [{ from: cell.from, to: cell.to, insert }];
  const missing = Array.from({ length: column - target.cells.length + 1 }, (_, index) =>
    index === column - target.cells.length ? insert : '',
  );
  const written = table.source.slice(target.from, target.to);
  const closed = /\|[ \t]*$/.test(written);
  const text = missing.map((each) => ` ${each} |`).join('');
  return [{ from: target.to, to: target.to, insert: closed ? text : `|${text.slice(0, -1)}` }];
}

/** Inserts an empty row after `row`; after the header, it goes after the delimiter row. */
export function addRow(table: Table, row: number): TextChange[] {
  const after = table.rows[Math.max(row, 1)];
  if (!after) return [];
  return [{ from: after.to, to: after.to, insert: `\n${rowText(table, Array.from({ length: columnCount(table) }, () => ''))}` }];
}

/** Removes a body row, with the line break before it; the header and the delimiter stay. */
export function removeRow(table: Table, row: number): TextChange[] {
  const target = table.rows[row];
  if (!target || row < 2) return [];
  return [{ from: table.rows[row - 1]!.to, to: target.to, insert: '' }];
}

function pipeAfter(table: Table, row: TableRow, at: number): number | null {
  return pipesOf(table.source, at, row.to)[0] ?? null;
}

function pipeBefore(table: Table, row: TableRow, at: number): number | null {
  const pipes = pipesOf(table.source, row.from, at);
  return pipes.length > 0 ? pipes[pipes.length - 1]! : null;
}

/** Inserts an empty column after `column`, in every row that reaches it. */
export function addColumn(table: Table, column: number): TextChange[] {
  return table.rows.flatMap((row, index) => {
    const cell = row.cells[Math.min(column, row.cells.length - 1)];
    if (!cell) return [];
    const content = index === 1 ? ' --- ' : '  ';
    const pipe = pipeAfter(table, row, cell.to);
    if (pipe !== null) return [{ from: pipe + 1, to: pipe + 1, insert: `${content}|` }];
    // A row written with no closing pipe: a body row is short and draws the cell empty, but the
    // header and the delimiter have to name it, so they gain one.
    if (index > 1) return [];
    return [{ from: row.to, to: row.to, insert: ` |${content}|` }];
  });
}

/** Removes a column from every row, with the pipe that opens it. */
export function removeColumn(table: Table, column: number): TextChange[] {
  if (columnCount(table) < 2) return [];
  return table.rows.flatMap((row) => {
    const cell = row.cells[column];
    if (!cell) return [];
    const open = pipeBefore(table, row, cell.from);
    const close = pipeAfter(table, row, cell.to);
    const start = row.from + (PREFIX.exec(table.source.slice(row.from, row.to))?.[0].length ?? 0);
    if (open === null || open < start) {
      // The first cell of a row with no leading pipe: it goes with the pipe that closes it.
      return close === null ? [] : [{ from: start, to: close + 1, insert: '' }];
    }
    return [{ from: open, to: close ?? row.to, insert: '' }];
  });
}

/** Rewrites the delimiter cell of one column; every other byte of the table stays. */
export function alignColumn(table: Table, column: number, alignment: Alignment): TextChange[] {
  const cell = table.rows[1]?.cells[column];
  if (!cell) return [];
  const insert = delimiterOf(alignment);
  return cell.text === insert ? [] : [{ from: cell.from, to: cell.to, insert }];
}

/** Applies changes that do not overlap to a text, for the tests and for a host without the editor. */
export function applyChanges(text: string, changes: readonly TextChange[]): string {
  return [...changes]
    .sort((a, b) => b.from - a.from)
    .reduce((out, change) => out.slice(0, change.from) + change.insert + out.slice(change.to), text);
}
