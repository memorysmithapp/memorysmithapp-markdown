// @vitest-environment node
// The `table` block (§7.15, #137): the table it references, against the conformance suite, and the
// query language its `where` is written in (§6.9). The notices it raises are `diagnose.test.ts`'s.

import { cases } from '@memorysmithapp/markdown-spec';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { fold, isTableBlock, parseQuery, QuerySyntaxError, readTableBlock, tableKey } from '../src/table-block.js';

interface Node {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: Node[];
}

/** The tables a note references, each once, as an Indexer extracts them (§5.9). */
function references(markdown: string): string[] {
  const found = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === 'code' && isTableBlock(node.lang, node.meta)) {
      const table = readTableBlock(node.value ?? '').table;
      if (table !== null && !found.has(tableKey(table))) found.set(tableKey(table), table);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(unified().use(remarkParse).parse(markdown) as Node);
  return [...found.values()];
}

describe('the conformance suite', () => {
  const referencing = cases.filter((testCase) => testCase.tables !== undefined);

  it('has table cases to run', () => {
    expect(referencing.length).toBeGreaterThan(0);
  });

  for (const testCase of referencing) {
    it(testCase.id, () => {
      const expected = (testCase.tables ?? []).map(tableKey).sort();
      expect(references(testCase.markdown).map(tableKey).sort()).toEqual(expected);
    });
  }

  for (const testCase of cases.filter((each) => each.notation === 'table-reference' && each.resolution)) {
    it(`${testCase.id}, resolved`, () => {
      const kept = new Set((testCase.notebook?.tables ?? []).map((table) => tableKey(table.name)));
      for (const outcome of testCase.resolution ?? []) {
        expect(kept.has(tableKey(outcome.target)) ? 'table' : 'pending').toBe(outcome.kind);
      }
    });
  }
});

describe('a query', () => {
  it('reads every term as one that must match, and OR as looser than that', () => {
    expect(parseQuery('a b OR c')).toEqual({
      kind: 'or',
      nodes: [
        { kind: 'and', nodes: [{ kind: 'term', field: null, value: 'a' }, { kind: 'term', field: null, value: 'b' }] },
        { kind: 'term', field: null, value: 'c' },
      ],
    });
  });

  it('negates with a dash that starts a term, and keeps one inside a word', () => {
    expect(parseQuery('-rascunho lei-14133')).toEqual({
      kind: 'and',
      nodes: [
        { kind: 'not', node: { kind: 'term', field: null, value: 'rascunho' } },
        { kind: 'term', field: null, value: 'lei-14133' },
      ],
    });
    expect(parseQuery('(-a)')).toEqual({ kind: 'not', node: { kind: 'term', field: null, value: 'a' } });
  });

  it('reads a field, folded, and gives one a phrase as its value', () => {
    expect(parseQuery('Descrição:"Aluguel de Março"')).toEqual({ kind: 'term', field: 'descricao', value: 'aluguel de marco' });
  });

  it('reads a phrase as text, whatever it holds', () => {
    expect(parseQuery('"status:pending"')).toEqual({ kind: 'term', field: null, value: 'status:pending' });
  });

  it('reads a colon at either end of a word as text', () => {
    expect(parseQuery('nota: :')).toEqual({
      kind: 'and',
      nodes: [{ kind: 'term', field: null, value: 'nota:' }, { kind: 'term', field: null, value: ':' }],
    });
  });

  it('reads a comparison and a range, keeping both ends of the range', () => {
    expect(parseQuery('amount:>=100 date:2026-01..2026-03')).toEqual({
      kind: 'and',
      nodes: [
        { kind: 'compare', field: 'amount', op: '>=', value: '100' },
        { kind: 'range', field: 'date', from: '2026-01', to: '2026-03' },
      ],
    });
  });

  it.each(['"open', '(a', 'a)', 'a OR', 'OR a', 'a OR OR b', 'a -', '()', 'x:>=', 'x:..b', 'x:a..', '""', ' ', 'a'.repeat(501)])(
    'refuses %j as a syntax error',
    (query) => {
      expect(() => parseQuery(query)).toThrow(QuerySyntaxError);
    },
  );

  it('folds case and marks, as the search does', () => {
    expect(fold('Vigência AÇÃO')).toBe('vigencia acao');
  });
});

describe('a block', () => {
  it('reads its keys, and the defaults of the ones it leaves out', () => {
    const block = readTableBlock('table: expenses\ncolumns: date, amount\nsort: date desc, amount\n');
    expect(block).toMatchObject({
      table: 'expenses',
      columns: ['date', 'amount'],
      sort: [
        { column: 'date', descending: true },
        { column: 'amount', descending: false },
      ],
      page: 25,
      total: null,
      where: null,
      problems: [],
    });
  });

  it('places each mistake on its line, the opening fence being line 0', () => {
    expect(readTableBlock('colour: red\npage: 0\n').problems).toEqual([
      { code: 'table-unnamed', line: 0 },
      { code: 'table-key-unknown', line: 1, detail: 'colour' },
      { code: 'table-key-invalid', line: 2, detail: '0 is not a whole number from 1 to 100' },
    ]);
  });
});
