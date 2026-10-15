/**
 * The edits of a table (#56): each one changes the cells it names and leaves every other byte of
 * the note as written — spacing, pipes, alignment and the rows it does not reach.
 */

import { describe, expect, it } from 'vitest';
import { addColumn, addRow, alignColumn, applyChanges, readTable, removeColumn, removeRow, setCell, type TextChange } from '../../src/edit/table.js';

const NOTE = 'Before.\n\n| Name   |  Qty |\n|:-------|-----:|\n| apple  |    3 |\n| pear |  12 |\n\nAfter.\n';
const from = NOTE.indexOf('|');
const to = NOTE.indexOf('\n\nAfter');
const table = readTable(NOTE, from, to);
const apply = (changes: TextChange[]) => applyChanges(NOTE, changes);

describe('reading a table', () => {
  it('reads its rows, cells and alignment', () => {
    expect(table.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ['Name', 'Qty'],
      [':-------', '-----:'],
      ['apple', '3'],
      ['pear', '12'],
    ]);
    expect(table.align).toEqual(['left', 'right']);
    expect(table.leadingPipe && table.trailingPipe).toBe(true);
  });

  it('keeps an escaped pipe and a pipe in code inside their cell', () => {
    const text = '| a \\| b | `c|d` |\n|---|---|\n';
    expect(readTable(text, 0, text.length - 1).rows[0]?.cells.map((cell) => cell.text)).toEqual(['a \\| b', '`c|d`']);
  });

  it('reads a table inside a quotation, its markers as the prefix of every row', () => {
    const text = '> | a | b |\n> |---|---|\n> | 1 | 2 |';
    const quoted = readTable(text, 2, text.length);
    expect(quoted.prefix).toBe('> ');
    expect(quoted.rows[2]?.cells.map((cell) => cell.text)).toEqual(['1', '2']);
  });
});

describe('editing a table', () => {
  it('replaces one cell and nothing else', () => {
    expect(apply(setCell(table, 3, 0, 'quince'))).toBe(NOTE.replace('| pear |', '| quince |'));
    expect(apply(setCell(table, 0, 1, 'Count'))).toBe(NOTE.replace('|  Qty |', '|  Count |'));
  });

  it('escapes a pipe typed in a cell', () => {
    expect(apply(setCell(table, 2, 0, 'a|b'))).toContain('| a\\|b  |');
  });

  it('adds a row after another, in the table\'s own style, and removes one', () => {
    expect(apply(addRow(table, 2))).toBe(NOTE.replace('|    3 |\n', '|    3 |\n|  |  |\n'));
    expect(apply(addRow(table, 0))).toBe(NOTE.replace('-----:|\n', '-----:|\n|  |  |\n'));
    expect(apply(removeRow(table, 2))).toBe(NOTE.replace('| apple  |    3 |\n', ''));
    expect(removeRow(table, 1)).toEqual([]);
  });

  it('adds and removes a column in every row', () => {
    expect(apply(addColumn(table, 0))).toBe(
      'Before.\n\n| Name   |  |  Qty |\n|:-------| --- |-----:|\n| apple  |  |    3 |\n| pear |  |  12 |\n\nAfter.\n',
    );
    expect(apply(removeColumn(table, 0))).toBe('Before.\n\n|  Qty |\n|-----:|\n|    3 |\n|  12 |\n\nAfter.\n');
    expect(apply(removeColumn(table, 1))).toBe('Before.\n\n| Name   |\n|:-------|\n| apple  |\n| pear |\n\nAfter.\n');
  });

  it('aligns a column by rewriting its delimiter cell only', () => {
    expect(apply(alignColumn(table, 1, 'center'))).toBe(NOTE.replace('-----:', ':---:'));
    expect(alignColumn(table, 0, 'left')).toEqual([{ from: expect.any(Number), to: expect.any(Number), insert: ':---' }]);
  });

  it('fills a short row at its end', () => {
    const text = '| a | b |\n|---|---|\n| 1 |';
    const short = readTable(text, 0, text.length);
    expect(applyChanges(text, setCell(short, 2, 1, 'two'))).toBe('| a | b |\n|---|---|\n| 1 | two |');
  });
});
