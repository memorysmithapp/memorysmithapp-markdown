// The justified column of a table, `;---;` in its delimiter row (`SPEC.md` §4.1, #164): this
// specification's own form, which GFM does not have. Read as a centred column and turned
// justified, every offset of the text kept; a `;` on one side, or beside a colon, leaves no table.

import { describe, expect, it } from 'vitest';
import { justifyColumns } from '../src/justified.js';
import { tableRegions } from '../src/source.js';
import { html } from './render.js';

const TABLE = '| Item | Note | Amount |\n|:---|;---;|---:|\n| Chairs | Bought in two instalments | 480 |\n';

describe('a justified column', () => {
  it('draws its header and its cells justified, and leaves the other columns as their delimiters say', () => {
    const drawn = html(TABLE);
    expect(drawn).toContain('<th style="text-align:left">Item</th>');
    expect(drawn).toContain('<th style="text-align:justify">Note</th>');
    expect(drawn).toContain('<td style="text-align:justify">Bought in two instalments</td>');
    expect(drawn).toContain('<td style="text-align:right">480</td>');
  });

  it('takes spaces around its cell, and a table with no outer pipes', () => {
    expect(html('| a | b |\n| --- |  ;---;  |\n| 1 | 2 |\n')).toContain('<td style="text-align:justify">2</td>');
    expect(html('| a | b |\n| --- | ; --- ; |\n| 1 | 2 |\n')).not.toContain('<table');
    expect(html('a | b\n--- | ;---;\n1 | 2\n')).toContain('<td style="text-align:justify">2</td>');
  });

  it('is a table inside a callout or a quote', () => {
    expect(html('> [!note] Counts\n> | a | b |\n> |---|;---;|\n> | 1 | 2 |\n')).toContain('<td style="text-align:justify">2</td>');
  });

  it('keeps a link in a justified cell a link', () => {
    expect(html('| a | b |\n|---|;---;|\n| 1 | [[Treasurer]] |\n', { resolve: () => '/notes/treasurer' })).toMatch(/<td style="text-align:justify"><a[^>]*href="\/notes\/treasurer"/);
  });

  it('leaves no table where a `;` stands on one side only, or beside a colon', () => {
    for (const row of ['|---|;---|', '|---|---;|', '|---|;---:|', '|---|:---;|']) {
      const drawn = html(`| a | b |\n${row}\n| 1 | 2 |\n`);
      expect(drawn, row).not.toContain('<table');
      expect(drawn, row).toContain(row.replace(/\|/g, '|'));
    }
  });

  it('touches nothing inside code, where it is an example', () => {
    const drawn = html('```markdown\n| a | b |\n|---|;---;|\n```\n');
    expect(drawn).not.toContain('<table');
    expect(drawn).toContain('|---|;---;|');
  });

  it('keeps every offset of the text, so a task box after it is the one ticked', () => {
    const text = `${TABLE}\n- [ ] after\n`;
    const prepared = justifyColumns(text);
    expect(prepared.text).toHaveLength(text.length);
    expect(prepared.text.indexOf('- [ ] after')).toBe(text.indexOf('- [ ] after'));
    expect([...prepared.columns]).toEqual([[2, [1]]]);
  });

  it('is a table to what escapes a pipe inside a cell', () => {
    expect(tableRegions('| a | b |\n|---|;---;|\n| 1 | 2 |\n')).toEqual([[0, 31]]);
  });
});
