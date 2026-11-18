/**
 * The justified column of a table, `;---;` in its delimiter row (`SPEC.md` §4.1, #164).
 *
 * GFM has no justified column, and the parser's table tokenizer, `remark-gfm`'s, reads a delimiter
 * row of colons and dashes only: to it a row holding `;---;` is text, and so is the table. So the
 * text is prepared before it is parsed: in a delimiter row whose every cell is GFM's or `;---;`,
 * each `;` of a justified cell becomes a `:`, which the tokenizer reads as a centred column, and
 * the cell is remembered by its line and column. Then `remarkJustifiedColumns` turns those columns
 * from centred to justified on the table it finds there. A `;` replaced by a `:` keeps every offset
 * of the text, so what the parser reports — the place of a task box among it — is the text's own.
 *
 * A row holding a `;` on one side of a cell only, or beside a colon, is left alone, and stays text,
 * as §4.1 says. Rows inside code are never touched: they are examples.
 */

import { codeRegions, insideCode } from './source.js';

/** A cell of a delimiter row: GFM's, or the justified column's. */
const CELL = /^[ \t]*(?::?-+:?|;-+;)[ \t]*$/;
const JUSTIFIED = /^([ \t]*);(-+);([ \t]*)$/;
/** What may stand before a table's rows: the markers of the quote or callout that holds it, and the indent of a list item. */
const CONTAINER = /^[ \t>]*/;

export interface Justified {
  /** The text the parser reads: every justified cell written as a centred one. */
  readonly text: string;
  /** The justified columns, by the line of their delimiter row, from 1, each from 0. */
  readonly columns: ReadonlyMap<number, readonly number[]>;
}

/** The cells of a row, without its outer pipes, each with where it starts in the row. */
function cellsOf(row: string): { text: string; at: number }[] {
  const cells: { text: string; at: number }[] = [];
  let start = 0;
  let end = row.length;
  if (row.trimStart().startsWith('|')) start = row.indexOf('|') + 1;
  if (row.trimEnd().endsWith('|') && row.trimEnd().length > start) end = row.lastIndexOf('|');
  let at = start;
  for (let index = start; index <= end; index++) {
    if (index === end || row[index] === '|') {
      cells.push({ text: row.slice(at, index), at });
      at = index + 1;
    }
  }
  return cells;
}

export function justifyColumns(text: string): Justified {
  if (!text.includes(';')) return { text, columns: new Map() };
  const code = codeRegions(text);
  const lines = text.split('\n');
  const columns = new Map<number, number[]>();
  let offset = 0;
  const out: string[] = [];
  lines.forEach((line, index) => {
    const at = offset;
    offset += line.length + 1;
    const previous = lines[index - 1];
    if (index === 0 || !line.includes(';') || !line.includes('-') || previous === undefined || !previous.includes('|') || insideCode(code, at)) {
      out.push(line);
      return;
    }
    const prefix = CONTAINER.exec(line)?.[0] ?? '';
    const row = line.slice(prefix.length);
    const cells = cellsOf(row);
    if (cells.length === 0 || !cells.every((cell) => CELL.test(cell.text)) || (cells.length === 1 && !row.includes('|'))) {
      out.push(line);
      return;
    }
    const justified = cells.flatMap((cell, column) => (JUSTIFIED.test(cell.text) ? [column] : []));
    if (justified.length === 0) {
      out.push(line);
      return;
    }
    let rewritten = row;
    for (const column of justified) {
      const cell = cells[column]!;
      const replaced = cell.text.replace(JUSTIFIED, '$1:$2:$3');
      rewritten = rewritten.slice(0, cell.at) + replaced + rewritten.slice(cell.at + cell.text.length);
    }
    columns.set(index + 1, justified);
    out.push(prefix + rewritten);
  });
  return { text: out.join('\n'), columns };
}

interface Node {
  type: string;
  align?: (string | null)[] | null;
  children?: Node[];
  position?: { start: { line: number } };
}

/** Turns the columns `justifyColumns` remembered from centred to justified, on the table whose delimiter row holds them. */
export function remarkJustifiedColumns(options: { readonly columns: ReadonlyMap<number, readonly number[]> }) {
  return (tree: unknown): void => {
    if (options.columns.size === 0) return;
    const walk = (node: Node): void => {
      if (node.type === 'table' && node.position && node.align) {
        for (const column of options.columns.get(node.position.start.line + 1) ?? []) {
          if (column < node.align.length) node.align[column] = 'justify';
        }
        return;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree as Node);
  };
}
