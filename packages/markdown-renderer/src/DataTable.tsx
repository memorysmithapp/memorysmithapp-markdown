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
 * A block the component cannot draw as a table — one it cannot read, a table the host does not
 * keep, a host that failed — is drawn as `fallback`, the code block it would be with no tables.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useHost } from './host.js';
import {
  checkTableBlock,
  fold,
  readTableBlock,
  type TableColumn,
  type TablePage,
  type TableSortKey,
  type TableValue,
} from './table-block.js';

type State =
  | { readonly kind: 'loading'; readonly answer: TablePage | null }
  | { readonly kind: 'ready'; readonly answer: TablePage }
  | { readonly kind: 'unavailable' };

export function DataTable({ source, fallback }: { readonly source: string; readonly fallback: ReactNode }) {
  const { queryTable, strings } = useHost();
  const block = useMemo(() => readTableBlock(source), [source]);
  const readable = block.table !== null && block.problems.length === 0 && queryTable !== null;
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
    if (!readable || block.table === null || !queryTable) return;
    const ticket = ++asked.current;
    setState((before) => ({ kind: 'loading', answer: before.kind === 'unavailable' ? null : before.answer }));
    queryTable({
      table: block.table,
      columns: block.columns,
      where: block.whereText,
      sort: order ?? block.sort ?? [],
      page,
      size: block.page,
      total: block.total,
    }).then(
      (answer) => {
        if (ticket !== asked.current) return;
        // A table the notebook does not keep, or that the block asks what it cannot answer.
        setState(answer && checkTableBlock(block, answer.schema).length === 0 ? { kind: 'ready', answer } : { kind: 'unavailable' });
      },
      () => ticket === asked.current && setState({ kind: 'unavailable' }),
    );
  }, [readable, block, queryTable, order, page]);

  if (!readable || state.kind === 'unavailable') return <>{fallback}</>;
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
    <div className="data-table" aria-busy={state.kind === 'loading'}>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => {
                const first = current[0];
                const sorted = first !== undefined && fold(first.column) === fold(column.name) ? (first.descending ? 'descending' : 'ascending') : undefined;
                return (
                  <th key={column.name} aria-sort={sorted} className={alignOf(column)}>
                    <button type="button" className="data-table-sort" title={strings.tableSortBy(column.name)} onClick={() => sortBy(column)}>
                      {column.name}
                      {sorted && <span aria-hidden="true">{sorted === 'ascending' ? ' ▲' : ' ▼'}</span>}
                    </button>
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
