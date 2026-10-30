/**
 * A `table` block drawn as the table it asks for (`SPEC.md` §7.15, #138).
 *
 * The block holds the question and the host the answer: the component reads the block, asks
 * `queryTable` for one page, and draws the header, the rows, the pages and the total. The host runs
 * the filter, so a page is the page of the whole filter, and so is the order a reader asks for by
 * a header, which asks the host again and never changes the note.
 *
 * Values are drawn in the reader's locale and always as text: nothing in a row is parsed as
 * Markdown, so a `[[link]]` or a `<b>` a row holds is its characters (§7.15, §7.9). A number
 * arrives as its digits and is formatted from them, so a decimal of 38 digits is never rounded.
 *
 * A block that cannot be answered is drawn as what is wrong with it, in place of the table and in
 * the reader's words, each mistake with the line that makes it (§7.15, #139). A host that failed is
 * no mistake of the block: it says so above `fallback`, the code block the block would be with no
 * tables, so nothing the author wrote is hidden.
 *
 * With `printing`, the block asks for every row in its declared order and is drawn with no control
 * a page of paper could not use, closed by the line that says what was read and when (§7.15, #139).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useHost } from './host.js';
import {
  checkTableBlock,
  fold,
  readTableBlock,
  type TableBlock,
  type TableColumn,
  type TablePage,
  type TableProblem,
  type TableSortKey,
  type TableValue,
} from './table-block.js';

type State =
  | { readonly kind: 'loading'; readonly answer: TablePage | null }
  | { readonly kind: 'ready'; readonly answer: TablePage }
  | { readonly kind: 'problems'; readonly problems: readonly TableProblem[] }
  | { readonly kind: 'failed' };

export function DataTable({ source, fallback }: { readonly source: string; readonly fallback: ReactNode }) {
  const { queryTable, strings, printing } = useHost();
  const block = useMemo(() => readTableBlock(source), [source]);
  const readable = block.table !== null && block.problems.length === 0;
  // Read through a ref: a host that gives its functions anew on each render asks nothing again (#99).
  const query = useRef(queryTable);
  query.current = queryTable;
  const [page, setPage] = useState(1);
  // The reader's order, from a header: theirs alone, and gone when the note is opened again.
  const [order, setOrder] = useState<readonly TableSortKey[] | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading', answer: null });
  const asked = useRef(0);

  useEffect(() => {
    setPage(1);
    setOrder(null);
  }, [source]);

  useEffect(() => {
    if (!readable || block.table === null || !query.current) return;
    const ticket = ++asked.current;
    setState((before) => ({ kind: 'loading', answer: before.kind === 'loading' || before.kind === 'ready' ? before.answer : null }));
    query.current({
      table: block.table,
      columns: block.columns,
      where: block.whereText,
      // Paper carries the declared order, whatever a reader asked for on the screen.
      sort: printing ? (block.sort ?? []) : (order ?? block.sort ?? []),
      page: printing ? 1 : page,
      size: printing ? 'all' : block.page,
      total: block.total,
    }).then(
      (answer) => {
        if (ticket !== asked.current) return;
        const problems = checkTableBlock(block, answer ? answer.schema : null);
        setState(answer && problems.length === 0 ? { kind: 'ready', answer } : { kind: 'problems', problems });
      },
      () => ticket === asked.current && setState({ kind: 'failed' }),
    );
  }, [readable, block, order, page, printing]);

  if (!readable) return <TableProblems block={block} source={source} problems={block.problems} />;
  if (state.kind === 'problems') return <TableProblems block={block} source={source} problems={state.problems} />;
  if (state.kind === 'failed') {
    return (
      <div className="data-table-failed">
        <p role="status">{strings.failed}</p>
        {fallback}
      </div>
    );
  }
  const answer = state.answer;
  if (!answer) {
    return (
      <div className="data-table data-table-loading" aria-busy="true">
        {strings.loading}
      </div>
    );
  }

  const columns = drawnColumns(answer.schema.columns, block.columns);
  const pages = Math.max(1, Math.ceil(answer.count / block.page));
  const current = order ?? block.sort ?? [];
  const sortBy = (column: TableColumn): void => {
    const first = current[0];
    const descending = first !== undefined && fold(first.column) === fold(column.name) && !first.descending;
    setOrder([{ column: column.name, descending }]);
    setPage(1);
  };
  const totalAt = block.total === null ? -1 : columns.findIndex((column) => fold(column.name) === fold(block.total!));

  return (
    <div className={printing ? 'data-table data-table-printing' : 'data-table'} aria-busy={state.kind === 'loading'}>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => {
                const first = current[0];
                const sorted = first !== undefined && fold(first.column) === fold(column.name) ? (first.descending ? 'descending' : 'ascending') : undefined;
                return (
                  <th key={column.name} aria-sort={sorted} className={alignOf(column)}>
                    {printing ? (
                      <span className="data-table-sort">{column.name}</span>
                    ) : (
                      <button type="button" className="data-table-sort" title={strings.tableSortBy(column.name)} onClick={() => sortBy(column)}>
                        {column.name}
                        {sorted && <span aria-hidden="true">{sorted === 'ascending' ? ' ▲' : ' ▼'}</span>}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {answer.rows.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={columns.length}>
                  {strings.tableEmpty}
                </td>
              </tr>
            ) : (
              answer.rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.name} className={alignOf(column)}>
                      {formatValue(row[column.name] ?? null, column, strings)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totalAt !== -1 && answer.total !== null && (
            <tfoot>
              <tr>
                {columns.map((column, index) => (
                  <td key={column.name} className={alignOf(column)}>
                    {index === totalAt ? formatNumber(answer.total!, strings.locale) : index === 0 ? strings.tableTotal : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {printing ? (
        <p className="data-table-printed">
          {strings.tablePrinted({ table: block.table ?? '', filter: block.whereText, count: answer.count, readAt: formatDate(answer.readAt, strings.locale) ?? answer.readAt })}
        </p>
      ) : (
      <div className="data-table-footer">
        <span className="data-table-count">{strings.tableRows(answer.count)}</span>
        {pages > 1 && (
          <span className="data-table-pages">
            <button type="button" className="data-table-page" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={strings.tablePrevious} title={strings.tablePrevious}>
              ‹
            </button>
            <span>{strings.tablePage(Math.min(page, pages), pages)}</span>
            <button type="button" className="data-table-page" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={strings.tableNext} title={strings.tableNext}>
              ›
            </button>
          </span>
        )}
      </div>
      )}
    </div>
  );
}

/** What is wrong with a block, in place of its table: each mistake, with the line that makes it. */
function TableProblems({ block, source, problems }: { readonly block: TableBlock; readonly source: string; readonly problems: readonly TableProblem[] }) {
  const { strings } = useHost();
  const lines = source.split('\n');
  return (
    <div className="data-table-problems" role="status" data-table-name={block.table ?? undefined}>
      <ul>
        {problems.map((problem, index) => (
          <li key={index} data-code={problem.code}>
            {strings.tableProblem(problem.code, block.table)}
            {problem.line > 0 && <code>{lines[problem.line - 1]?.trim()}</code>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The columns a block draws, as the table writes them: the ones it names, in its order, or all. */
function drawnColumns(schema: readonly TableColumn[], named: readonly string[] | null): TableColumn[] {
  if (named === null) return [...schema];
  return named.map((name) => schema.find((column) => fold(column.name) === fold(name))).filter((column): column is TableColumn => column !== undefined);
}

const alignOf = (column: TableColumn): string | undefined =>
  column.kind === 'number' ? 'data-table-number' : column.kind === 'date' ? 'data-table-date' : undefined;

/** A value as the reader's locale writes it, and as text. */
export function formatValue(value: TableValue, column: TableColumn, strings: { readonly locale: string; readonly yes: string; readonly no: string }): string {
  if (value === null || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (column.kind === 'boolean') return value === true || value === 'true' ? strings.yes : value === false || value === 'false' ? strings.no : String(value);
  if (column.kind === 'number') return formatNumber(String(value), strings.locale);
  if (column.kind === 'date') return formatDate(String(value), strings.locale) ?? String(value);
  return String(value);
}

/**
 * A number from its digits, in the reader's locale. `Intl.NumberFormat` reads a string as the
 * decimal it writes, so no digit is lost to a floating point; what is not a number stays as typed.
 */
export function formatNumber(digits: string, locale: string): string {
  const typed = digits.trim();
  const match = /^-?\d+(?:\.(\d+))?$/.exec(typed);
  if (!match) return typed;
  const fraction = match[1]?.length ?? 0;
  try {
    const format = new Intl.NumberFormat(locale, { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    return format.format(typed as unknown as number);
  } catch {
    return typed;
  }
}

/** A date or a date-time in ISO 8601, in the reader's locale, read in UTC as a property's date is. */
function formatDate(value: string, locale: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match;
  const when = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours ?? 0), Number(minutes ?? 0)));
  if (when.getUTCDate() !== Number(day)) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(hours ? { timeStyle: 'short' } : {}), timeZone: 'UTC' }).format(when);
  } catch {
    return null;
  }
}
