/**
 * The `table` block (§7.15, #137) and the query language its `where` is written in (§6.9).
 *
 * A block holds a question about a table of the notebook and never its rows: which table, which
 * columns, which rows, in which order, how many to a page, and which column to sum. This module
 * reads the question — the lines of the block, and the filter as a tree — and says what is wrong
 * with it, alone or against the columns of the table the host keeps. It fetches nothing and knows
 * no React, so `diagnose` runs it on a server as the page does in a browser.
 *
 * The query language is MemorySmith's search (§2), with what the specification adds for a table:
 * a field is a column, a bare term looks in every text and list column, and an interval compares
 * a number as well as a date.
 */

/** The kind of a column (§5.9), which decides how a query matches it (§6.9). */
export type TableColumnKind = 'text' | 'number' | 'date' | 'boolean' | 'list';

export interface TableColumn {
  /** The column's name as the table writes it, which is what a header shows. */
  readonly name: string;
  readonly kind: TableColumnKind;
}

/** What the host knows of a table it keeps: its columns, in the table's own order. */
export interface TableSchema {
  readonly name: string;
  readonly columns: readonly TableColumn[];
}

/** The codes a `table` block raises (§7.13). */
export type TableNoticeCode =
  | 'table-unnamed'
  | 'table-key-unknown'
  | 'table-key-invalid'
  | 'table-column-unknown'
  | 'table-filter-invalid'
  | 'table-pending';

/** One mistake of a block: its code, the line of the block it is on (0 is the opening fence) and what it was about. */
export interface TableProblem {
  readonly code: TableNoticeCode;
  readonly line: number;
  readonly detail?: string;
}

/** One column of `sort`, and its direction. */
export interface TableSortKey {
  readonly column: string;
  readonly descending: boolean;
}

/** A block as it was read: what each key said, and where each key was written. */
export interface TableBlock {
  /** The table it names, trimmed and in NFC; `null` when it names none (§5.9). */
  readonly table: string | null;
  readonly columns: readonly string[] | null;
  readonly where: QueryNode | null;
  /** The filter as it was written, for a line that names it. */
  readonly whereText: string | null;
  readonly sort: readonly TableSortKey[] | null;
  readonly page: number;
  readonly total: string | null;
  /** The mistakes that do not need the table, at most one a line. */
  readonly problems: readonly TableProblem[];
  /** The line of each key that was read, for the mistakes found against the table. */
  readonly lines: Readonly<Partial<Record<TableKey, number>>>;
}

/** The six keys, in English in every notebook (§7.15). */
export const TABLE_KEYS = ['table', 'columns', 'where', 'sort', 'page', 'total'] as const;
export type TableKey = (typeof TABLE_KEYS)[number];

/** Rows to a page when the block says nothing, and the most it may ask for. */
export const DEFAULT_PAGE = 25;
export const MAX_PAGE = 100;

/** Whether a fenced code block is a `table` block: its info string is the word `table` and nothing else. */
export function isTableBlock(lang: string | null | undefined, meta: string | null | undefined): boolean {
  return lang === 'table' && (meta ?? '').trim() === '';
}

/**
 * Text as a query compares it (§6.9): case folded and combining marks stripped. A character keeps
 * its length where it can, as MemorySmith's search folds it.
 */
export function fold(raw: string): string {
  let out = '';
  for (const character of raw) {
    const folded = character.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += folded.length === character.length ? folded : character.toLowerCase();
  }
  return out;
}

/** A table's name as it is compared (§5.9): in NFC, with case folded. */
export function tableKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

/** A column's name: one word, with none of the characters a block and a query separate with (§5.9). */
const COLUMN_NAME = /^[^\s,:"()]+$/;
const PAGE = /^\d+$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Reads the lines of a block. `value` is the content of the fence, without the fences, one line of
 * the block to each line of it.
 */
export function readTableBlock(value: string): TableBlock {
  const problems: TableProblem[] = [];
  const lines: Partial<Record<TableKey, number>> = {};
  const values: Partial<Record<TableKey, string>> = {};
  const tableLines: number[] = [];

  value.split('\n').forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '') return;
    const colon = raw.indexOf(':');
    const key = colon === -1 ? null : raw.slice(0, colon).trim();
    if (key === null || !(TABLE_KEYS as readonly string[]).includes(key)) {
      problems.push({ code: 'table-key-unknown', line, detail: key ?? raw.trim() });
      return;
    }
    const known = key as TableKey;
    const text = raw.slice(colon + 1).trim();
    if (known === 'table') {
      tableLines.push(line);
      if (text !== '') values.table = text;
      lines.table ??= line;
      return;
    }
    if (known in lines) {
      problems.push({ code: 'table-key-invalid', line, detail: `${known} is written twice` });
      return;
    }
    lines[known] = line;
    // A key with an empty value is absent.
    if (text !== '') values[known] = text;
  });

  const named = tableLines.length === 1 && values.table !== undefined;
  if (!named) problems.push({ code: 'table-unnamed', line: 0 });

  const invalid = (key: TableKey, detail: string): null => {
    problems.push({ code: 'table-key-invalid', line: lines[key] ?? 0, detail });
    return null;
  };

  const columns = values.columns === undefined ? null : readNames(values.columns, 'columns', invalid);

  let sort: TableSortKey[] | null = null;
  if (values.sort !== undefined) {
    const keys: TableSortKey[] = [];
    const seen = new Set<string>();
    for (const item of values.sort.split(',').map((part) => part.trim())) {
      const words = item.split(/\s+/);
      const [column, direction, ...rest] = words;
      if (!column || !COLUMN_NAME.test(column) || rest.length > 0 || (direction !== undefined && direction !== 'asc' && direction !== 'desc')) {
        sort = invalid('sort', item === '' ? 'a column is missing' : `${item} is not a column followed by asc or desc`);
        break;
      }
      if (seen.has(fold(column))) {
        sort = invalid('sort', `${column} is listed twice`);
        break;
      }
      seen.add(fold(column));
      keys.push({ column, descending: direction === 'desc' });
      sort = keys;
    }
  }

  let page = DEFAULT_PAGE;
  if (values.page !== undefined) {
    const count = PAGE.test(values.page) ? Number(values.page) : NaN;
    if (count >= 1 && count <= MAX_PAGE) page = count;
    else invalid('page', `${values.page} is not a whole number from 1 to ${MAX_PAGE}`);
  }

  let total: string | null = null;
  if (values.total !== undefined) {
    if (COLUMN_NAME.test(values.total)) total = values.total;
    else invalid('total', `${values.total} is not one column`);
  }

  let where: QueryNode | null = null;
  if (values.where !== undefined) {
    try {
      where = parseQuery(values.where);
    } catch (error) {
      if (!(error instanceof QuerySyntaxError)) throw error;
      problems.push({ code: 'table-filter-invalid', line: lines.where ?? 0, detail: error.message });
    }
  }

  return {
    table: named ? values.table!.normalize('NFC') : null,
    columns,
    where,
    whereText: values.where ?? null,
    sort,
    page,
    total,
    problems: problems.sort((a, b) => a.line - b.line),
    lines,
  };
}

function readNames(text: string, key: TableKey, invalid: (key: TableKey, detail: string) => null): string[] | null {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const name of text.split(',').map((part) => part.trim())) {
    if (name === '') return invalid(key, 'a column is missing');
    if (!COLUMN_NAME.test(name)) return invalid(key, `${name} is not one word`);
    if (seen.has(fold(name))) return invalid(key, `${name} is listed twice`);
    seen.add(fold(name));
    names.push(name);
  }
  return names;
}

/**
 * The mistakes a block makes against the table it names: the ones it makes alone, then a pending
 * table, a column the table does not have, a `total` that is not a drawn number, and a filter its
 * columns cannot answer. `schema` is `undefined` when nothing is known of the notebook's tables,
 * and `null` when the notebook keeps no table of that name. A line raises one mistake at most.
 */
export function checkTableBlock(block: TableBlock, schema: TableSchema | null | undefined): TableProblem[] {
  const problems = [...block.problems];
  if (block.table === null || schema === undefined) return problems;
  if (schema === null) {
    problems.push({ code: 'table-pending', line: block.lines.table ?? 0, detail: block.table });
    return problems;
  }

  const taken = new Set(problems.map((problem) => problem.line));
  const add = (key: TableKey, code: TableNoticeCode, detail: string): void => {
    const line = block.lines[key] ?? 0;
    if (taken.has(line)) return;
    taken.add(line);
    problems.push({ code, line, detail });
  };
  const byName = new Map(schema.columns.map((column) => [fold(column.name), column]));
  const column = (name: string): TableColumn | undefined => byName.get(fold(name));

  for (const name of block.columns ?? []) if (!column(name)) add('columns', 'table-column-unknown', name);
  for (const key of block.sort ?? []) if (!column(key.column)) add('sort', 'table-column-unknown', key.column);
  if (block.total !== null) {
    const summed = column(block.total);
    if (!summed) add('total', 'table-column-unknown', block.total);
    else if (summed.kind !== 'number') add('total', 'table-key-invalid', `${block.total} is not a number column`);
    else if (block.columns && !block.columns.some((name) => fold(name) === fold(block.total!))) {
      add('total', 'table-key-invalid', `${block.total} is not drawn`);
    }
  }
  if (block.where) {
    const unknown = fields(block.where).find((field) => !byName.has(field));
    if (unknown !== undefined) add('where', 'table-column-unknown', unknown);
    else {
      const wrong = kindMistake(block.where, byName);
      if (wrong) add('where', 'table-filter-invalid', wrong);
    }
  }
  return problems.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------
// The query language (§6.9).
// ---------------------------------------------------------------------------

export type Comparison = '>=' | '>' | '<=' | '<';

/** A query read into a tree. Fields and values are folded; a range keeps its two ends. */
export type QueryNode =
  | { readonly kind: 'term'; readonly field: string | null; readonly value: string }
  | { readonly kind: 'compare'; readonly field: string; readonly op: Comparison; readonly value: string }
  | { readonly kind: 'range'; readonly field: string; readonly from: string; readonly to: string }
  | { readonly kind: 'not'; readonly node: QueryNode }
  | { readonly kind: 'and'; readonly nodes: readonly QueryNode[] }
  | { readonly kind: 'or'; readonly nodes: readonly QueryNode[] };

/** A query that cannot be read, whatever it is asked of (§6.9). */
export class QuerySyntaxError extends Error {}

const MAX_QUERY_LENGTH = 500;

type Token =
  | { kind: 'word'; value: string; quoted: 'none' | 'phrase' | 'value' }
  | { kind: 'or' }
  | { kind: 'not' }
  | { kind: 'open' }
  | { kind: 'close' };

function tokenize(raw: string): Token[] {
  if (raw.length > MAX_QUERY_LENGTH) throw new QuerySyntaxError(`A query is limited to ${MAX_QUERY_LENGTH} characters`);
  const tokens: Token[] = [];
  let index = 0;
  while (index < raw.length) {
    const char = raw[index] as string;
    if (/\s/.test(char)) {
      index++;
    } else if (char === '(') {
      tokens.push({ kind: 'open' });
      index++;
    } else if (char === ')') {
      tokens.push({ kind: 'close' });
      index++;
    } else if (char === '-' && (index === 0 || /[\s(]/.test(raw[index - 1] as string))) {
      // A dash negates only where a term starts, so `lei-14133` stays one word.
      tokens.push({ kind: 'not' });
      index++;
    } else if (char === '"') {
      const end = raw.indexOf('"', index + 1);
      if (end === -1) throw new QuerySyntaxError('A phrase is never closed');
      tokens.push({ kind: 'word', value: raw.slice(index + 1, end), quoted: 'phrase' });
      index = end + 1;
    } else {
      let end = index;
      while (end < raw.length && !/[\s()"]/.test(raw[end] as string)) end++;
      const value = raw.slice(index, end);
      index = end;
      // `field:"two words"` keeps its field and reads the phrase as its value.
      if (raw[index] === '"' && value.endsWith(':') && value.length > 1) {
        const close = raw.indexOf('"', index + 1);
        if (close === -1) throw new QuerySyntaxError('A phrase is never closed');
        tokens.push({ kind: 'word', value: value + raw.slice(index + 1, close), quoted: 'value' });
        index = close + 1;
      } else if (value === 'OR') {
        tokens.push({ kind: 'or' });
      } else {
        tokens.push({ kind: 'word', value, quoted: 'none' });
      }
    }
  }
  return tokens;
}

/** Reads a query: `OR` binds loosest, then the implicit *and*, then `-`, then a term or a group. */
export function parseQuery(raw: string): QueryNode {
  const tokens = tokenize(raw);
  if (tokens.length === 0) throw new QuerySyntaxError('A query asks nothing');
  let position = 0;
  const peek = (): Token | undefined => tokens[position];

  const or = (): QueryNode => {
    const nodes = [and()];
    while (peek()?.kind === 'or') {
      position++;
      nodes.push(and());
    }
    return nodes.length === 1 ? (nodes[0] as QueryNode) : { kind: 'or', nodes };
  };
  const and = (): QueryNode => {
    const nodes: QueryNode[] = [];
    for (let token = peek(); token && token.kind !== 'or' && token.kind !== 'close'; token = peek()) nodes.push(not());
    if (nodes.length === 0) throw new QuerySyntaxError('An operator is missing its term');
    return nodes.length === 1 ? (nodes[0] as QueryNode) : { kind: 'and', nodes };
  };
  const not = (): QueryNode => {
    if (peek()?.kind !== 'not') return atom();
    position++;
    return { kind: 'not', node: not() };
  };
  const atom = (): QueryNode => {
    const token = peek();
    if (token?.kind === 'open') {
      position++;
      const inner = or();
      if (peek()?.kind !== 'close') throw new QuerySyntaxError('A group is never closed');
      position++;
      return inner;
    }
    if (token?.kind !== 'word') throw new QuerySyntaxError('An operator is missing its term');
    position++;
    return termOf(token);
  };

  const tree = or();
  if (position < tokens.length) throw new QuerySyntaxError('A group is closed that was never opened');
  return tree;
}

const COMPARISON = /^(>=|<=|>|<)(.*)$/;

function termOf(token: Extract<Token, { kind: 'word' }>): QueryNode {
  // A phrase is text, whatever it holds; a word is a field when a colon stands inside it.
  const colon = token.quoted === 'phrase' ? -1 : token.value.indexOf(':');
  if (colon > 0 && colon < token.value.length - 1) {
    const field = fold(token.value.slice(0, colon));
    const raw = token.value.slice(colon + 1);
    if (token.quoted === 'value') return { kind: 'term', field, value: fold(raw) };
    const comparison = COMPARISON.exec(raw);
    if (comparison) {
      const value = fold(comparison[2] ?? '');
      if (value === '') throw new QuerySyntaxError('A comparison is missing its operand');
      return { kind: 'compare', field, op: comparison[1] as Comparison, value };
    }
    const separator = raw.indexOf('..');
    if (separator !== -1) {
      const from = fold(raw.slice(0, separator));
      const to = fold(raw.slice(separator + 2));
      if (from === '' || to === '') throw new QuerySyntaxError('A range needs both ends');
      return { kind: 'range', field, from, to };
    }
    return { kind: 'term', field, value: fold(raw) };
  }
  const value = fold(token.value);
  if (value === '') throw new QuerySyntaxError('A phrase holds nothing');
  return { kind: 'term', field: null, value };
}

/** Every field a query names, folded, in the order it names them. */
export function fields(node: QueryNode): string[] {
  switch (node.kind) {
    case 'term':
      return node.field === null ? [] : [node.field];
    case 'compare':
    case 'range':
      return [node.field];
    case 'not':
      return fields(node.node);
    case 'and':
    case 'or':
      return node.nodes.flatMap(fields);
  }
}

/**
 * What a query asks that the kinds of its columns cannot answer (§6.9), or `null`: an interval over
 * a column that is neither a date nor a number, a number column given a value that is not a number,
 * and a range whose ends are inverted as that kind compares them.
 */
function kindMistake(node: QueryNode, columns: ReadonlyMap<string, TableColumn>): string | null {
  switch (node.kind) {
    case 'not':
      return kindMistake(node.node, columns);
    case 'and':
    case 'or':
      for (const each of node.nodes) {
        const mistake = kindMistake(each, columns);
        if (mistake) return mistake;
      }
      return null;
    case 'term': {
      if (node.field === null) return null;
      const column = columns.get(node.field);
      return column?.kind === 'number' && !NUMBER.test(node.value) ? `${node.value} is not a number` : null;
    }
    case 'compare':
    case 'range': {
      const column = columns.get(node.field);
      if (!column) return null;
      if (column.kind !== 'number' && column.kind !== 'date') return `${column.name} is neither a date nor a number`;
      const ends = node.kind === 'compare' ? [node.value] : [node.from, node.to];
      if (column.kind === 'number') {
        const wrong = ends.find((end) => !NUMBER.test(end));
        if (wrong !== undefined) return `${wrong} is not a number`;
      }
      if (node.kind === 'range') {
        const inverted = column.kind === 'number' ? Number(node.from) > Number(node.to) : node.from > node.to;
        if (inverted) return `the range ${node.from}..${node.to} is inverted`;
      }
      return null;
    }
  }
}
