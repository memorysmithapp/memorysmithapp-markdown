// The tables of a printed note as appendices at its end (#165): in place of each table, a reference
// to its appendix; at the end, one appendix per table, in order, numbered in one sequence across a
// `table` block and a Markdown table, each titled and whole. Nothing changes on the screen, nor in
// print when the host does not ask.

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteBody, type NoteHost } from '../src/index.js';
import { planAppendices } from '../src/appendices.js';
import { runTableQuery, type TablePage, type TableRequest, type TableRow } from '../src/table-block.js';
import { mount, type Mounted } from './render.js';

const ROWS: TableRow[] = Array.from({ length: 30 }, (_, index) => ({ item: `Item ${index + 1}`, amount: String(index + 1) }));

const queryTable = async (request: TableRequest): Promise<TablePage | null> =>
  request.table === 'gastos'
    ? runTableQuery({ schema: { name: 'gastos', columns: [{ name: 'item', kind: 'text' }, { name: 'amount', kind: 'number' }] }, rows: ROWS }, request, '2026-11-18T12:00:00Z')
    : null;

const NOTE = [
  '# Ata',
  '',
  'The expenses:',
  '',
  '```table',
  'table: gastos',
  'page: 5',
  'total: amount',
  '```',
  '',
  'Who came:',
  '',
  '| Name | Present |',
  '|------|:-------:|',
  '| [[Ana]] | yes |',
  '| Bruno | no |',
  '',
  'The end.',
  '',
].join('\n');

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function draw(markdown: string, host: Partial<NoteHost>): Promise<HTMLElement> {
  mounted = await mount(<NoteBody markdown={markdown} actions={false} {...host} />);
  await act(async () => undefined);
  return mounted.container;
}

const texts = (container: Element, selector: string): string[] => [...container.querySelectorAll(selector)].map((each) => each.textContent ?? '');

describe('a printed note with its tables as appendices', () => {
  const host = { queryTable, printing: true, tablesAsAppendices: true };

  it('draws a reference in place of each table, linked to its appendix', async () => {
    const container = await draw(NOTE, host);
    const references = [...container.querySelectorAll<HTMLAnchorElement>('p.table-reference a')];
    expect(references.map((link) => link.getAttribute('href'))).toEqual(['#table-appendix-1', '#table-appendix-2']);
    expect(references.map((link) => link.textContent)).toEqual(['See appendix 1, gastos.', 'See appendix 2, table 1.']);
    // The references stand where the tables stood, between the paragraphs around them.
    const flow = texts(container, '.markdown:not(.table-appendix *) > p');
    expect(flow).toEqual(['The expenses:', 'See appendix 1, gastos.', 'Who came:', 'See appendix 2, table 1.', 'The end.']);
  });

  it('draws the appendices at the end of the note, in order, numbered in one sequence, each titled', async () => {
    const container = await draw(NOTE, host);
    const appendices = [...container.querySelectorAll<HTMLElement>('.table-appendices > section.table-appendix')];
    expect(appendices.map((section) => section.id)).toEqual(['table-appendix-1', 'table-appendix-2']);
    expect(appendices.map((section) => section.dataset['tableKind'])).toEqual(['block', 'markdown']);
    expect(texts(container, '.table-appendix-title')).toEqual(['Appendix 1 — gastos', 'Appendix 2 — Table 1']);
    // Nothing of the note follows them.
    expect(container.querySelector('.markdown[data-theme]')?.lastElementChild?.className).toBe('table-appendices');
  });

  it('prints a table block whole in its appendix: every row, the total and the printed line', async () => {
    const container = await draw(NOTE, host);
    const appendix = container.querySelector('#table-appendix-1')!;
    expect(appendix.querySelectorAll('.data-table-printing tbody tr')).toHaveLength(30);
    expect(texts(appendix, 'tfoot td')).toEqual(['Total', '465']);
    expect(appendix.querySelector('.data-table-printed')?.textContent).toMatch(/^Table gastos: 30 rows, read on /);
  });

  it('prints a Markdown table whole in its appendix, its alignment and its links kept', async () => {
    const container = await draw(NOTE, { ...host, resolve: (name: string) => (name === 'Ana' ? '/notes/ana' : null) });
    const appendix = container.querySelector('#table-appendix-2')!;
    expect(texts(appendix, 'th')).toEqual(['Name', 'Present']);
    expect(texts(appendix, 'tbody td')).toEqual(['Ana', 'yes', 'Bruno', 'no']);
    expect(appendix.querySelector('td a')?.getAttribute('href')).toBe('/notes/ana');
    expect(appendix.querySelector('th:nth-child(2)')?.getAttribute('style')).toContain('center');
  });

  it('takes a table out of the quote or callout that holds it', async () => {
    const container = await draw('> [!note] Counts\n> | a | b |\n> |---|---|\n> | 1 | 2 |\n', host);
    expect(container.querySelector('.callout p.table-reference')).not.toBeNull();
    expect(texts(container.querySelector('#table-appendix-1')!, 'td')).toEqual(['1', '2']);
  });

  it('leaves a table block where the host reaches no tables as the code block it is', async () => {
    const container = await draw(NOTE, { printing: true, tablesAsAppendices: true });
    expect(container.querySelector('pre code')?.textContent).toContain('table: gastos');
    expect(texts(container, '.table-appendix-title')).toEqual(['Appendix 1 — Table 1']);
  });

  it('words the references and the titles as the host does', async () => {
    const container = await draw(NOTE, {
      ...host,
      strings: {
        tableAppendix: ({ number, table, markdownTable }) => `Anexo ${number} — ${table ?? `Tabela ${markdownTable}`}`,
        tableAppendixReference: ({ number }) => `Ver anexo ${number}.`,
      },
    });
    expect(texts(container, '.table-appendix-title')).toEqual(['Anexo 1 — gastos', 'Anexo 2 — Tabela 1']);
    expect(texts(container, 'p.table-reference')).toEqual(['Ver anexo 1.', 'Ver anexo 2.']);
  });
});

describe('a note whose tables are not asked for as appendices', () => {
  it('draws its tables in place on the screen, even when the host asks for appendices', async () => {
    const container = await draw(NOTE, { queryTable, tablesAsAppendices: true });
    expect(container.querySelector('.table-reference, .table-appendices')).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(2);
  });

  it('prints its tables in place when the host does not ask for appendices', async () => {
    const container = await draw(NOTE, { queryTable, printing: true });
    expect(container.querySelector('.table-reference, .table-appendices')).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(2);
  });
});

describe('planAppendices', () => {
  it('numbers the tables across the runs an embed cuts, the Markdown tables among themselves too', () => {
    const plan = planAppendices(['| a |\n|---|\n| 1 |\n', 'No table here.\n', '```table\ntable: gastos\n```\n\n| b |\n|---|\n| 2 |\n'], true);
    expect(plan.first).toEqual([1, 2, 2]);
    expect(plan.appendices.map(({ number, table, markdownTable }) => ({ number, table, markdownTable }))).toEqual([
      { number: 1, table: null, markdownTable: 1 },
      { number: 2, table: 'gastos', markdownTable: null },
      { number: 3, table: null, markdownTable: 2 },
    ]);
    expect(plan.appendices[1]?.source).toBe('```table\ntable: gastos\n```\n');
  });

  it('finds no table inside code, and no table block where tables are not reached', () => {
    expect(planAppendices(['```\n| a |\n|---|\n```\n'], true).appendices).toEqual([]);
    expect(planAppendices(['```table\ntable: gastos\n```\n'], false).appendices).toEqual([]);
  });
});
