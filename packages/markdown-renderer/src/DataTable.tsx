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
  type TableRow,
  type TableRowView,
  type TableSortKey,
  type TableValue,
} from './table-block.js';

type State =
  | { readonly kind: 'loading'; readonly answer: TablePage | null }
  | { readonly kind: 'ready'; readonly answer: TablePage }
  | { readonly kind: 'problems'; readonly problems: readonly TableProblem[] }
  | { readonly kind: 'failed' };

export function DataTable({ source, fallback }: { readonly source: string; readonly fallback: ReactNode }) {
  const { queryTable, openTableRow, strings, printing } = useHost();
  const block = useMemo(() => readTableBlock(source), [source]);
  const readable = block.table !== null && block.problems.length === 0;
  // Read through a ref: a host that gives its functions anew on each render asks nothing again (#99).
  const query = useRef(queryTable);
  query.current = queryTable;
  const openRow = useRef(openTableRow);
  openRow.current = openTableRow;
  // The row a reader opened, where the host shows none itself (#163).
  const [opened, setOpened] = useState<TableRowView | null>(null);
  // Each column's width on the screen, by its folded name, fixed by the first answer (#163).
  const widths = useRef(new Map<string, number | null>());
  const [page, setPage] = useState(1);
  // The reader's order, from a header: theirs alone, and gone when the note is opened again.
  const [order, setOrder] = useState<readonly TableSortKey[] | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading', answer: null });
  const asked = useRef(0);

  useEffect(() => {
    setPage(1);
    setOrder(null);
    setOpened(null);
    widths.current = new Map();
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
  const shown = Math.min(page, pages);
  const current = order ?? block.sort ?? [];
  const sortBy = (column: TableColumn): void => {
    const first = current[0];
    const descending = first !== undefined && fold(first.column) === fold(column.name) && !first.descending;
    setOrder([{ column: column.name, descending }]);
    setPage(1);
  };
  const totalAt = block.total === null ? -1 : columns.findIndex((column) => fold(column.name) === fold(block.total!));
  // On the screen each column keeps the width the first answer gave it, so turning a page or
  // sorting moves none (#163); paper takes the widths its values need.
  const layout = printing ? null : layoutOf(columns, answer, totalAt, strings, widths.current);
  // A shorter last page keeps the height of a full one, so the footer stays where it was (#163).
  const fillers = printing || pages < 2 ? 0 : Math.max(0, block.page - answer.rows.length);
  const open = (row: TableRow): void => {
    const view: TableRowView = { table: block.table ?? '', columns, row, values: columns.map((column) => formatValue(row[column.name] ?? null, column, strings)) };
    if (openRow.current) openRow.current(view);
    else setOpened(view);
  };

  return (
    <div className={printing ? 'data-table data-table-printing' : 'data-table'} aria-busy={state.kind === 'loading'}>
      <div className="data-table-scroll">
        <table style={layout ? { minWidth: layout.minWidth } : undefined}>
          {layout && (
            <colgroup>
              {layout.widths.map((width, index) => (
                <col key={columns[index]!.name} style={width ? { width } : undefined} />
              ))}
            </colgroup>
          )}
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
              answer.rows.map((row, index) =>
                printing ? (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.name} className={alignOf(column)}>
                        {formatValue(row[column.name] ?? null, column, strings)}
                      </td>
                    ))}
                  </tr>
                ) : (
                  <tr
                    key={index}
                    className="data-table-row"
                    tabIndex={0}
                    onClick={() => {
                      // Text the reader selected in a cell is theirs to copy, and opens nothing.
                      if (!window.getSelection?.()?.isCollapsed && window.getSelection()?.toString()) return;
                      open(row);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
                      event.preventDefault();
                      open(row);
                    }}
                  >
                    {columns.map((column) => {
                      const value = formatValue(row[column.name] ?? null, column, strings);
                      return (
                        <td key={column.name} className={alignOf(column)} title={value || undefined}>
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )
            )}
            {Array.from({ length: fillers }, (_, index) => (
              <tr key={`filler-${index}`} className="data-table-filler" aria-hidden="true">
                <td colSpan={columns.length}>{'\u00a0'}</td>
              </tr>
            ))}
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
          <span className="data-table-count">
            {strings.tableShowing(answer.count === 0 ? 0 : (shown - 1) * block.page + 1, Math.min(shown * block.page, answer.count), answer.count)}
          </span>
          {pages > 1 && (
            <span className="data-table-pages">
              <button type="button" className="data-table-page" disabled={shown <= 1} onClick={() => setPage(shown - 1)} title={strings.tablePrevious}>
                <span className="data-table-page-arrow" aria-hidden="true">
                  ‹
                </span>
                <span className="data-table-page-word">{strings.tablePrevious}</span>
              </button>
              <button type="button" className="data-table-page" disabled={shown >= pages} onClick={() => setPage(shown + 1)} title={strings.tableNext}>
                <span className="data-table-page-word">{strings.tableNext}</span>
                <span className="data-table-page-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            </span>
          )}
        </div>
      )}
      {opened && <RowDialog view={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}

/**
 * A row shown whole where the host gives no `openTableRow` (#163): a native modal dialog with each
 * column's name and its value as the table draws it, wrapping as long as it needs. Escape, the
 * button and a click outside it close it.
 */
function RowDialog({ view, onClose }: { readonly view: TableRowView; readonly onClose: () => void }) {
  const { strings } = useHost();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const closed = (): void => close.current();
    element.addEventListener('close', closed);
    // A browser without modal dialogs shows it in place, open.
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
    } else element.setAttribute('open', '');
    return () => element.removeEventListener('close', closed);
  }, []);
  const dismiss = (): void => {
    if (typeof dialog.current?.close === 'function' && dialog.current.open) dialog.current.close();
    else close.current();
  };
  return (
    <dialog
      ref={dialog}
      className="data-table-dialog"
      aria-label={view.table}
      onClick={(event) => event.target === event.currentTarget && dismiss()}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="data-table-dialog-body">
        <p className="data-table-dialog-title">{view.table}</p>
        <dl>
          {view.columns.map((column, index) => (
            <div key={column.name}>
              <dt>{column.name}</dt>
              <dd className={alignOf(column)}>{view.values[index]}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="data-table-dialog-close" onClick={dismiss}>
          {strings.close}
        </button>
      </div>
    </dialog>
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

/**
 * How a block lays its columns out on the screen (#163): at the width of the block, a date, a number
 * and a yes or no as wide as their drawn values need, and the text and list columns sharing the
 * rest. A column's width is fixed the first time it is drawn and kept in `known`, so no page and no
 * order moves it; a longer value later ends in an ellipsis, as a long text does, and its row shows
 * it whole. Below the width the fixed columns and a least share for each text column take, the
 * block scrolls sideways.
 */
function layoutOf(
  columns: readonly TableColumn[],
  answer: TablePage,
  totalAt: number,
  strings: { readonly locale: string; readonly yes: string; readonly no: string },
  known: Map<string, number | null>,
): { readonly widths: readonly (string | null)[]; readonly minWidth: string } {
  const sizes = columns.map((column, index) => {
    const key = fold(column.name);
    if (!known.has(key)) known.set(key, characters(column, answer, index === totalAt, strings));
    return known.get(key) ?? null;
  });
  const fixed = sizes.filter((size): size is number => size !== null);
  const shared = sizes.length - fixed.length;
  const sum = fixed.reduce((total, size) => total + size, 0);
  return {
    widths: sizes.map((size) => (size === null ? null : `calc(${size}ch + ${CELL_SPACE})`)),
    minWidth: `calc(${sum}ch + ${fixed.length} * ${CELL_SPACE} + ${shared} * ${TEXT_LEAST})`,
  };
}

/** What a cell takes beside its text: its padding and its rule. */
const CELL_SPACE = '1.25rem';
/** The least a text column keeps before the block scrolls sideways. */
const TEXT_LEAST = '8rem';

/** How many characters wide a column's drawn values are, or `null` for a column that shares what is left. */
function characters(column: TableColumn, answer: TablePage, isTotal: boolean, strings: { readonly locale: string; readonly yes: string; readonly no: string }): number | null {
  if (column.kind === 'text' || column.kind === 'list') return null;
  const drawn: string[] = answer.rows.map((row) => formatValue(row[column.name] ?? null, column, strings));
  if (isTotal && answer.total !== null) drawn.push(formatNumber(answer.total, strings.locale));
  if (column.kind === 'boolean') drawn.push(strings.yes, strings.no);
  if (column.kind === 'date' && !drawn.some((value) => value !== '')) drawn.push(formatDate('2000-12-28', strings.locale) ?? '');
  // The header shows its name and the arrow of an order, and may end in an ellipsis past a few words.
  const header = Math.min([...column.name].length + 2, 16);
  // A letter of a date or a word is about as wide as a digit, some a little wider.
  return Math.max(header, Math.ceil(Math.max(4, ...drawn.map((value) => [...value].length)) * 1.1));
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
