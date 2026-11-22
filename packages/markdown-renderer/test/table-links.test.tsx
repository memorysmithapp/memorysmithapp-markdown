// A `table` block whose rows lead somewhere (#171): the host answers, beside the rows of a page,
// where each leads, and the block draws that cell as a link of the note, a click on it following
// it and a click elsewhere on the row still opening the row whole.

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteBody } from '../src/index.js';
import { runTableQuery, type TablePage, type TableRequest, type TableRow, type TableSchema } from '../src/table-block.js';
import { html, mount, type Mounted } from './render.js';

const SCHEMA: TableSchema = {
  name: 'system-notes',
  columns: [
    { name: 'name', kind: 'text' },
    { name: 'status', kind: 'text' },
  ],
};
const ROWS: TableRow[] = [
  { name: 'Ata de novembro', status: 'aprovada' },
  { name: 'Rascunho', status: 'aberta' },
  { name: 'Fonte', status: 'externa' },
];
const LINKS = ['/notes/ata', null, 'https://example.org/fonte'];

function queryTableWith(links: readonly (string | null)[] | undefined, linkColumn?: string) {
  return vi.fn(async (request: TableRequest): Promise<TablePage | null> => {
    const page = runTableQuery({ schema: SCHEMA, rows: ROWS }, request, '2026-11-22T12:00:00Z');
    return { ...page, ...(links ? { links: page.rows.map((row) => links[ROWS.indexOf(row)] ?? null) } : {}), ...(linkColumn ? { linkColumn } : {}) };
  });
}

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const BLOCK = '```table\ntable: system-notes\n```\n';

async function draw(queryTable: ReturnType<typeof queryTableWith>, extra: Record<string, unknown> = {}): Promise<HTMLElement> {
  mounted = await mount(<NoteBody markdown={BLOCK} actions={false} queryTable={queryTable} {...extra} />);
  await act(async () => undefined);
  return mounted.container;
}

describe('a table block whose rows lead somewhere', () => {
  it('draws the first column of each row the host gives an address as a link, through renderLink for its own', async () => {
    const renderLink = vi.fn(({ href, className, children }) => <a data-router="" href={href} className={className}>{children}</a>);
    const container = await draw(queryTableWith(LINKS), { renderLink });
    const rows = [...container.querySelectorAll('tbody tr.data-table-row')];
    expect(rows[0]!.querySelector('td a[data-router]')?.getAttribute('href')).toBe('/notes/ata');
    expect(rows[1]!.querySelector('a')).toBeNull();
    expect(rows[2]!.querySelector('td a')?.getAttribute('href')).toBe('https://example.org/fonte');
    expect(rows[2]!.querySelector('td a')?.getAttribute('target')).toBe('_blank');
    // The other columns are text.
    expect(rows[0]!.querySelectorAll('td')[1]!.querySelector('a')).toBeNull();
  });

  it('puts the link on the column the host names, when drawn, and on the first when it is not', async () => {
    const container = await draw(queryTableWith(LINKS, 'status'));
    expect(container.querySelector('tbody tr td:nth-child(2) a')?.textContent).toBe('aprovada');
    mounted?.unmount();
    const ignored = await draw(queryTableWith(LINKS, 'nowhere'));
    expect(ignored.querySelector('tbody tr td:nth-child(1) a')?.textContent).toBe('Ata de novembro');
  });

  it('follows the link on a click, and opens the row whole on a click elsewhere or Enter on the row', async () => {
    const openTableRow = vi.fn();
    const container = await draw(queryTableWith(LINKS), { openTableRow, renderLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href} onClick={(event) => event.preventDefault()}>{children}</a> });
    const row = container.querySelector<HTMLElement>('tbody tr.data-table-row')!;
    act(() => row.querySelector<HTMLElement>('a')!.click());
    expect(openTableRow).not.toHaveBeenCalled();
    act(() => row.querySelectorAll<HTMLElement>('td')[1]!.click());
    expect(openTableRow).toHaveBeenCalledTimes(1);
    act(() => {
      row.querySelector<HTMLElement>('a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(openTableRow).toHaveBeenCalledTimes(1);
    act(() => {
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(openTableRow).toHaveBeenCalledTimes(2);
  });

  it('keeps the link in print, and draws as before with no addresses', async () => {
    const printed = await draw(queryTableWith(LINKS), { printing: true });
    expect(printed.querySelector('tbody td a')?.getAttribute('href')).toBe('/notes/ata');
    mounted?.unmount();
    const plain = await draw(queryTableWith(undefined));
    expect(plain.querySelector('tbody a')).toBeNull();
  });

  it('answers no addresses from runTableQuery', () => {
    const page = runTableQuery({ schema: SCHEMA, rows: ROWS }, { table: 'system-notes', columns: null, where: null, sort: [], page: 1, size: 25, total: null });
    expect(page.links).toBeUndefined();
    expect(html('Nothing here.')).not.toContain('data-table-link');
  });
});
