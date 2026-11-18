// A `table` block drawn as its table (§7.15, #138): asked of the host one page at a time, sorted
// for the reader by a header, formatted in the reader's locale and drawn as text; and the reference
// answer, `runTableQuery`, against the rules of §6.9 and §7.15.

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteBody } from '../src/index.js';
import { runTableQuery, sumDecimals, type TablePage, type TableRequest, type TableRow, type TableSchema } from '../src/table-block.js';
import { html, mount, type Mounted } from './render.js';

const SCHEMA: TableSchema = {
  name: 'expenses',
  columns: [
    { name: 'date', kind: 'date' },
    { name: 'descrição', kind: 'text' },
    { name: 'amount', kind: 'number' },
    { name: 'paid', kind: 'boolean' },
    { name: 'labels', kind: 'list' },
  ],
};

const ROWS: TableRow[] = [
  { date: '2026-10-03', descrição: 'Aluguel de outubro', amount: '2500.00', paid: true, labels: ['casa'] },
  { date: '2026-10-07', descrição: 'Mercado', amount: '612.40', paid: false, labels: ['casa', 'comida'] },
  { date: '2026-09-28', descrição: 'Livro [[Engelbart]] <b>raro</b>', amount: '89.90', paid: true, labels: [] },
  { date: '2026-10-15', descrição: 'Conserto', amount: null, paid: false, labels: ['casa'] },
  { date: '2026-10-21', descrição: 'Farmácia', amount: '-12.5', paid: true, labels: ['saúde'] },
];

const BLOCK = '```table\ntable: expenses\ncolumns: date, descrição, amount, paid\nwhere: date:2026-10\nsort: date desc\npage: 2\ntotal: amount\n```\n';

function hostOf(rows: readonly TableRow[] = ROWS) {
  const queryTable = vi.fn(async (request: TableRequest): Promise<TablePage | null> =>
    request.table.toLowerCase() === 'expenses' ? runTableQuery({ schema: SCHEMA, rows }, request, '2026-10-29T12:00:00Z') : null,
  );
  return { queryTable };
}

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function draw(markdown: string, host: ReturnType<typeof hostOf>, locale = 'en-US'): Promise<HTMLElement> {
  mounted = await mount(<NoteBody markdown={markdown} actions={false} queryTable={host.queryTable} strings={{ locale }} />);
  await act(async () => undefined);
  return mounted.container;
}

const cells = (container: HTMLElement, selector: string): string[] =>
  [...container.querySelectorAll(selector)].map((cell) => cell.textContent ?? '');

/** A button of the footer, by the word it carries beside its arrow. */
const button = (container: HTMLElement, word: string): HTMLButtonElement =>
  [...container.querySelectorAll<HTMLButtonElement>('.data-table-page')].find((each) => each.querySelector('.data-table-page-word')?.textContent === word)!;

describe('a table block, where the host reaches the tables', () => {
  it('asks the host for the first page of what the block declares', async () => {
    const host = hostOf();
    await draw(BLOCK, host);
    expect(host.queryTable).toHaveBeenCalledTimes(1);
    expect(host.queryTable.mock.calls[0]?.[0]).toEqual({
      table: 'expenses',
      columns: ['date', 'descrição', 'amount', 'paid'],
      where: 'date:2026-10',
      sort: [{ column: 'date', descending: true }],
      page: 1,
      size: 2,
      total: 'amount',
    });
  });

  it('draws the header, the rows of the page in the reader’s locale, the total, the count and the pages', async () => {
    const container = await draw(BLOCK, hostOf());
    expect(container.querySelector('pre')).toBeNull();
    expect(cells(container, 'thead th')).toEqual(['date ▼', 'descrição', 'amount', 'paid']);
    expect(cells(container, 'tbody tr:first-child td')).toEqual(['Oct 21, 2026', 'Farmácia', '-12.5', 'Yes']);
    expect(cells(container, 'tbody tr:nth-child(2) td')).toEqual(['Oct 15, 2026', 'Conserto', '', 'No']);
    // The total is the sum over the whole filter, and not over the page.
    expect(cells(container, 'tfoot td')).toEqual(['Total', '', '3,099.90', '']);
    expect(container.querySelector('.data-table-count')?.textContent).toBe('1–2 of 4');
    expect(cells(container, '.data-table-pages button')).toEqual(['‹Previous', 'Next›']);
  });

  it('formats in the locale the host gives', async () => {
    const container = await draw(BLOCK, hostOf(), 'pt-BR');
    expect(cells(container, 'tbody tr:first-child td').slice(0, 1)).toEqual(['21 de out. de 2026']);
    expect(cells(container, 'tfoot td')[2]).toBe('3.099,90');
  });

  it('moves to the next page by asking the host for it', async () => {
    const host = hostOf();
    const container = await draw(BLOCK, host);
    await act(async () => button(container, 'Next').click());
    expect(host.queryTable.mock.calls.at(-1)?.[0].page).toBe(2);
    expect(cells(container, 'tbody tr:not(.data-table-filler) td:nth-child(2)')).toEqual(['Mercado', 'Aluguel de outubro']);
    expect(container.querySelector('.data-table-count')?.textContent).toBe('3–4 of 4');
    expect(button(container, 'Next').disabled).toBe(true);
    expect(button(container, 'Previous').disabled).toBe(false);
  });

  it('sorts by a header for the reader alone, asking the host again, from the first page', async () => {
    const host = hostOf();
    const onChange = vi.fn();
    mounted = await mount(<NoteBody markdown={BLOCK} actions={false} queryTable={host.queryTable} onChange={onChange} />);
    await act(async () => undefined);
    const header = () => [...mounted!.container.querySelectorAll<HTMLButtonElement>('th button')].find((button) => button.textContent?.startsWith('amount'))!;
    await act(async () => header().click());
    expect(host.queryTable.mock.calls.at(-1)?.[0]).toMatchObject({ sort: [{ column: 'amount', descending: false }], page: 1 });
    expect(mounted.container.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('amount');
    await act(async () => header().click());
    expect(host.queryTable.mock.calls.at(-1)?.[0]).toMatchObject({ sort: [{ column: 'amount', descending: true }] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws a value as text, never as Markdown or HTML', async () => {
    const container = await draw('```table\ntable: expenses\ncolumns: descrição\nwhere: livro\n```\n', hostOf());
    expect(cells(container, 'tbody td')).toEqual(['Livro [[Engelbart]] <b>raro</b>']);
    expect(container.querySelector('tbody b, tbody a')).toBeNull();
  });

  it('draws every column, in the table’s order, when the block names none, and a list as its items', async () => {
    const container = await draw('```table\ntable: expenses\nwhere: mercado\n```\n', hostOf());
    expect(cells(container, 'thead th')).toEqual(['date', 'descrição', 'amount', 'paid', 'labels']);
    expect(cells(container, 'tbody td').at(-1)).toBe('casa, comida');
  });

  it('formats a number from its digits, so none is lost to a floating point', async () => {
    const container = await draw('```table\ntable: expenses\ncolumns: amount\n```\n', hostOf([{ amount: '12345678901234567890123456789012345678' }]));
    expect(cells(container, 'tbody td')).toEqual(['12,345,678,901,234,567,890,123,456,789,012,345,678']);
  });

  it('says so when the filter returns no row', async () => {
    const container = await draw('```table\ntable: expenses\nwhere: nothing-matches-this\n```\n', hostOf());
    expect(container.querySelector('.data-table-empty')?.textContent).toBe('No row answers this filter.');
    expect(container.querySelector('.data-table-pages')).toBeNull();
  });

  const problems = (container: HTMLElement): (string | undefined)[] =>
    [...container.querySelectorAll<HTMLElement>('.data-table-problems li')].map((item) => item.dataset['code']);

  it('draws what is wrong with a block it cannot read in place of the table, and asks the host nothing', async () => {
    const host = hostOf();
    const container = await draw('```table\ntable: expenses\ncolour: red\npage: 0\nwhere: "open\n```\n', host);
    expect(host.queryTable).not.toHaveBeenCalled();
    expect(container.querySelector('table, pre')).toBeNull();
    expect(problems(container)).toEqual(['table-key-unknown', 'table-key-invalid', 'table-filter-invalid']);
    expect(cells(container, '.data-table-problems code')).toEqual(['colour: red', 'page: 0', 'where: "open']);
  });

  it('says a block names no table', async () => {
    const container = await draw('```table\ncolumns: date\n```\n', hostOf());
    expect(problems(container)).toEqual(['table-unnamed']);
  });

  it('says the notebook keeps no such table, by its name', async () => {
    const container = await draw('```table\ntable: budget\n```\n', hostOf());
    expect(problems(container)).toEqual(['table-pending']);
    expect(container.querySelector('.data-table-problems')?.textContent).toContain('budget');
  });

  it('says what the columns of the table cannot answer', async () => {
    const container = await draw('```table\ntable: expenses\ncolumns: colour\nwhere: paid:>true\ntotal: paid\n```\n', hostOf());
    expect(problems(container)).toEqual(['table-column-unknown', 'table-filter-invalid', 'table-key-invalid']);
  });

  it('leaves the rest of the note as written', async () => {
    const container = await draw('Before.\n\n```table\ntable: budget\n```\n\nAfter.\n', hostOf());
    expect(container.textContent).toContain('Before.');
    expect(container.textContent).toContain('After.');
  });

  it('says the host failed above the block as written, which is no mistake of the block', async () => {
    const container = await draw('```table\ntable: expenses\n```\n', { queryTable: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect(container.querySelector('.data-table-failed [role="status"]')).not.toBeNull();
    expect(container.querySelector('code.language-table')).not.toBeNull();
  });

  it('asks a host that gives its function anew on each render once', async () => {
    const host = hostOf();
    mounted = await mount(<NoteBody markdown={BLOCK} actions={false} queryTable={(request) => host.queryTable(request)} />);
    await act(async () => undefined);
    await act(async () => mounted!.root.render(<NoteBody markdown={BLOCK} actions={false} queryTable={(request) => host.queryTable(request)} />));
    expect(host.queryTable).toHaveBeenCalledTimes(1);
  });
});

describe('a table block on the screen (#163)', () => {
  const widths = (container: HTMLElement): string[] => [...container.querySelectorAll<HTMLElement>('colgroup col')].map((col) => col.style.width);

  it('gives a date, a number and a yes or no a width of their own, and leaves the text columns the rest', async () => {
    const container = await draw(BLOCK, hostOf());
    const [date, text, amount, paid] = widths(container);
    expect(date).toMatch(/^calc\(\d+ch \+ 1\.25rem\)$/);
    expect(text).toBe('');
    expect(amount).toMatch(/^calc\(\d+ch \+ 1\.25rem\)$/);
    expect(paid).toMatch(/^calc\(\d+ch \+ 1\.25rem\)$/);
    expect(container.querySelector<HTMLElement>('table')?.style.minWidth).toContain('8rem');
  });

  it('keeps every column where it was as the pages turn and the order changes', async () => {
    const container = await draw(BLOCK, hostOf());
    const first = widths(container);
    await act(async () => button(container, 'Next').click());
    expect(widths(container)).toEqual(first);
    const header = [...container.querySelectorAll<HTMLButtonElement>('th button')].find((each) => each.textContent?.startsWith('amount'))!;
    await act(async () => header.click());
    expect(widths(container)).toEqual(first);
  });

  it('fills a shorter last page with rows nobody sees, so the footer stays where it was', async () => {
    const container = await draw('```table\ntable: expenses\npage: 2\n```\n', hostOf());
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    await act(async () => button(container, 'Next').click());
    await act(async () => button(container, 'Next').click());
    expect(container.querySelector('.data-table-count')?.textContent).toBe('5–5 of 5');
    expect(container.querySelectorAll('tbody tr.data-table-row').length).toBe(1);
    const fillers = container.querySelectorAll('tbody tr.data-table-filler');
    expect(fillers.length).toBe(1);
    expect(fillers[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('fills nothing on a table of one page, which has no Previous or Next', async () => {
    const container = await draw('```table\ntable: expenses\nwhere: casa\n```\n', hostOf());
    expect(container.querySelector('.data-table-filler')).toBeNull();
    expect(container.querySelector('.data-table-pages')).toBeNull();
    expect(container.querySelector('.data-table-count')?.textContent).toBe('1–3 of 3');
  });

  it('draws Previous and Next with the host’s words, the arrows hidden from a screen reader', async () => {
    mounted = await mount(
      <NoteBody markdown={BLOCK} actions={false} queryTable={hostOf().queryTable} strings={{ tablePrevious: 'Anterior', tableNext: 'Próxima', tableShowing: (first, last, total) => `${first}–${last} de ${total}` }} />,
    );
    await act(async () => undefined);
    const container = mounted.container;
    expect(container.querySelector('.data-table-count')?.textContent).toBe('1–2 de 4');
    expect(button(container, 'Anterior').disabled).toBe(true);
    expect(button(container, 'Próxima').disabled).toBe(false);
    for (const arrow of container.querySelectorAll('.data-table-page-arrow')) expect(arrow.getAttribute('aria-hidden')).toBe('true');
  });

  it('says so when the filter returns no row', async () => {
    const container = await draw('```table\ntable: expenses\nwhere: nothing-matches-this\n```\n', hostOf());
    expect(container.querySelector('.data-table-count')?.textContent).toBe('No rows');
  });

  it('hands the host a row clicked, with its columns and each value as the table draws it', async () => {
    const openTableRow = vi.fn();
    mounted = await mount(<NoteBody markdown={BLOCK} actions={false} queryTable={hostOf().queryTable} openTableRow={openTableRow} />);
    await act(async () => undefined);
    const row = mounted.container.querySelector<HTMLTableRowElement>('tbody tr.data-table-row')!;
    await act(async () => row.click());
    expect(openTableRow).toHaveBeenCalledTimes(1);
    expect(openTableRow.mock.calls[0]?.[0]).toEqual({
      table: 'expenses',
      columns: [
        { name: 'date', kind: 'date' },
        { name: 'descrição', kind: 'text' },
        { name: 'amount', kind: 'number' },
        { name: 'paid', kind: 'boolean' },
      ],
      row: ROWS[4],
      values: ['Oct 21, 2026', 'Farmácia', '-12.5', 'Yes'],
    });
    expect(mounted.container.querySelector('dialog')).toBeNull();
  });

  it('opens a row with Enter on it, as a click does', async () => {
    const openTableRow = vi.fn();
    mounted = await mount(<NoteBody markdown={BLOCK} actions={false} queryTable={hostOf().queryTable} openTableRow={openTableRow} />);
    await act(async () => undefined);
    const row = mounted.container.querySelectorAll<HTMLTableRowElement>('tbody tr.data-table-row')[1]!;
    expect(row.tabIndex).toBe(0);
    await act(async () => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(openTableRow.mock.calls[0]?.[0].values).toEqual(['Oct 15, 2026', 'Conserto', '', 'No']);
  });

  it('shows a row whole in a dialog of its own where the host shows none, and closes it', async () => {
    const container = await draw('```table\ntable: expenses\ncolumns: descrição, amount\nwhere: livro\n```\n', hostOf());
    await act(async () => container.querySelector<HTMLTableRowElement>('tbody tr.data-table-row')!.click());
    const dialog = container.querySelector('dialog.data-table-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('expenses');
    expect(cells(container, 'dialog dt')).toEqual(['descrição', 'amount']);
    expect(cells(container, 'dialog dd')).toEqual(['Livro [[Engelbart]] <b>raro</b>', '89.90']);
    expect(container.querySelector('dialog b, dialog a')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('.data-table-dialog-close')!.click());
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('closes its own dialog with Escape', async () => {
    const container = await draw(BLOCK, hostOf());
    await act(async () => container.querySelector<HTMLTableRowElement>('tbody tr.data-table-row')!.click());
    const dialog = container.querySelector('dialog')!;
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('dialog')).toBeNull();
  });
});

describe('a table block being printed', () => {
  async function printed(markdown: string, host = hostOf(), locale = 'en-US'): Promise<HTMLElement> {
    mounted = await mount(<NoteBody markdown={markdown} actions={false} queryTable={host.queryTable} printing strings={{ locale }} />);
    await act(async () => undefined);
    return mounted.container;
  }

  it('asks for every row the filter returns, in the declared order', async () => {
    const host = hostOf();
    const container = await printed(BLOCK, host);
    expect(host.queryTable.mock.calls[0]?.[0]).toMatchObject({ page: 1, size: 'all', sort: [{ column: 'date', descending: true }] });
    expect(cells(container, 'tbody td:nth-child(2)')).toEqual(['Farmácia', 'Conserto', 'Mercado', 'Aluguel de outubro']);
  });

  it('carries every value whole: no column fixed, no row to open, no row that fills a page (#163)', async () => {
    const openTableRow = vi.fn();
    mounted = await mount(<NoteBody markdown={'```table\ntable: expenses\npage: 2\n```\n'} actions={false} queryTable={hostOf().queryTable} openTableRow={openTableRow} printing />);
    await act(async () => undefined);
    const container = mounted.container;
    expect(container.querySelector('colgroup')).toBeNull();
    expect(container.querySelector('.data-table-row, .data-table-filler, [tabindex]')).toBeNull();
    expect(container.querySelectorAll('tbody tr').length).toBe(5);
    await act(async () => container.querySelector<HTMLTableRowElement>('tbody tr')!.click());
    expect(openTableRow).not.toHaveBeenCalled();
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('draws no control, and keeps the header and the total', async () => {
    const container = await printed(BLOCK);
    expect(container.querySelector('.data-table button')).toBeNull();
    expect(container.querySelector('.data-table-pages')).toBeNull();
    expect(container.querySelector('thead th')?.textContent).toBe('date');
    expect(cells(container, 'tfoot td')[2]).toBe('3,099.90');
  });

  it('closes with a line naming the table, the filter, the count and when the rows were read', async () => {
    const container = await printed(BLOCK);
    expect(container.querySelector('.data-table-printed')?.textContent).toBe('Table expenses, filtered by date:2026-10: 4 rows, read on Oct 29, 2026, 12:00 PM.');
  });

  it('says nothing of a filter the block does not write', async () => {
    const container = await printed('```table\ntable: expenses\n```\n');
    expect(container.querySelector('.data-table-printed')?.textContent).toMatch(/^Table expenses: 5 rows, read on /);
  });
});

describe('a table block, where no tables are kept', () => {
  it('is a code block, its lines as written', () => {
    const page = html(BLOCK);
    expect(page).toContain('language-table');
    expect(page).toContain('where: date:2026-10');
    expect(page).not.toContain('<table>');
  });

  it('is a code block when its info string says more than table, even with a host', async () => {
    const host = hostOf();
    const container = await draw('```table sorted\ntable: expenses\n```\n', host);
    expect(host.queryTable).not.toHaveBeenCalled();
    expect(container.querySelector('pre')).not.toBeNull();
  });
});

describe('runTableQuery', () => {
  const ask = (request: Partial<TableRequest>): TablePage =>
    runTableQuery({ schema: SCHEMA, rows: ROWS }, { table: 'expenses', columns: null, where: null, sort: [], page: 1, size: 25, total: null, ...request }, 'now');
  const descriptions = (page: TablePage): string[] => page.rows.map((row) => String(row['descrição']));

  it('matches a bare term in every text and list column, with case and marks folded', () => {
    expect(descriptions(ask({ where: 'SAUDE' }))).toEqual(['Farmácia']);
    expect(descriptions(ask({ where: 'aluguel OR livro' }))).toEqual(['Aluguel de outubro', 'Livro [[Engelbart]] <b>raro</b>']);
  });

  it('matches a field by its kind: a date by prefix, a number as a number, a boolean as its word', () => {
    expect(descriptions(ask({ where: 'date:2026-09' }))).toEqual(['Livro [[Engelbart]] <b>raro</b>']);
    expect(descriptions(ask({ where: 'amount:612.4' }))).toEqual(['Mercado']);
    expect(descriptions(ask({ where: 'paid:false' }))).toEqual(['Mercado', 'Conserto']);
    expect(descriptions(ask({ where: 'labels:comida' }))).toEqual(['Mercado']);
  });

  it('compares a number as a number and a date at the length of its bound', () => {
    expect(descriptions(ask({ where: 'amount:>100' }))).toEqual(['Aluguel de outubro', 'Mercado']);
    expect(descriptions(ask({ where: 'amount:-20..90' }))).toEqual(['Livro [[Engelbart]] <b>raro</b>', 'Farmácia']);
    expect(descriptions(ask({ where: 'date:<=2026-09' }))).toEqual(['Livro [[Engelbart]] <b>raro</b>']);
  });

  it('negates, and an empty value matches a negation', () => {
    expect(descriptions(ask({ where: '-amount:>0' }))).toEqual(['Conserto', 'Farmácia']);
  });

  it('orders by kind, an empty value last either way, ties in insertion order', () => {
    expect(descriptions(ask({ sort: [{ column: 'amount', descending: false }] }))).toEqual([
      'Farmácia',
      'Livro [[Engelbart]] <b>raro</b>',
      'Mercado',
      'Aluguel de outubro',
      'Conserto',
    ]);
    expect(descriptions(ask({ sort: [{ column: 'amount', descending: true }] })).at(-1)).toBe('Conserto');
    expect(descriptions(ask({ sort: [{ column: 'paid', descending: false }] }))).toEqual(['Mercado', 'Conserto', 'Aluguel de outubro', 'Livro [[Engelbart]] <b>raro</b>', 'Farmácia']);
  });

  it('pages, counts the whole filter and sums it exactly, or returns every row', () => {
    const page = ask({ where: 'casa', page: 2, size: 2, total: 'amount' });
    expect(page.count).toBe(3);
    expect(descriptions(page)).toEqual(['Conserto']);
    expect(page.total).toBe('3112.40');
    expect(ask({ size: 'all' }).rows).toHaveLength(5);
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.3');
    expect(sumDecimals(['-12.5', '2'])).toBe('-10.5');
  });
});
