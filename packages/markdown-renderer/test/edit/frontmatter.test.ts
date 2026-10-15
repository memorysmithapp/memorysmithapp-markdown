/**
 * The edits of the properties form (#58): each rewrites the lines of the one entry it names, in
 * the form it was written in, and leaves the order, the quoting and the comments of the rest.
 */

import { describe, expect, it } from 'vitest';
import { addEntry, readFrontmatter, removeEntry, renameKey, setList, setScalar } from '../../src/edit/frontmatter.js';
import { applyChanges } from '../../src/edit/table.js';

const NOTE = [
  '---',
  'name: "Failing over"',
  '# a comment the form does not read',
  'aliases: []',
  'tags: [runbook, payments]',
  'owners:',
  '    - Ana',
  '    - Bia',
  'reviewed: 2026-10-01',
  'draft: yes',
  'empty:',
  '---',
  '# Body',
  '',
].join('\n');
const front = readFrontmatter(NOTE)!;
const apply = (changes: ReturnType<typeof setScalar>) => applyChanges(NOTE, changes);

describe('reading the frontmatter', () => {
  it('reads each entry with its form, its quote and its lines', () => {
    expect(front.entries.map((entry) => [entry.key, entry.form, entry.quote])).toEqual([
      ['name', 'scalar', '"'],
      ['aliases', 'inline', null],
      ['tags', 'inline', null],
      ['owners', 'dash', null],
      ['reviewed', 'scalar', null],
      ['draft', 'scalar', null],
      ['empty', 'scalar', null],
    ]);
    const owners = front.entries[3]!;
    expect(NOTE.slice(owners.from, owners.to)).toBe('owners:\n    - Ana\n    - Bia');
    expect(NOTE.slice(front.end, front.end + 4)).toBe('---\n');
  });

  it('has none for a note with no block', () => {
    expect(readFrontmatter('# Just a body\n')).toBeNull();
    expect(readFrontmatter('---\nname: never closed\n')).toBeNull();
  });
});

describe('editing the frontmatter', () => {
  it('sets a scalar in its own quotes, and nothing else changes', () => {
    expect(apply(setScalar(front, 'name', 'Failing back'))).toBe(NOTE.replace('"Failing over"', '"Failing back"'));
    expect(apply(setScalar(front, 'reviewed', '2026-10-15'))).toBe(NOTE.replace('2026-10-01', '2026-10-15'));
    expect(apply(setScalar(front, 'empty', 'now'))).toBe(NOTE.replace('empty:', 'empty: now'));
  });

  it('quotes a value YAML would read otherwise', () => {
    expect(apply(setScalar(front, 'draft', 'a: b'))).toBe(NOTE.replace('draft: yes', 'draft: "a: b"'));
    expect(apply(setScalar(front, 'draft', '[[Note]]'))).toBe(NOTE.replace('draft: yes', 'draft: "[[Note]]"'));
  });

  it('keeps a list in the form it was written in', () => {
    expect(apply(setList(front, 'tags', ['runbook', 'payments', 'db']))).toBe(NOTE.replace('[runbook, payments]', '[runbook, payments, db]'));
    expect(apply(setList(front, 'owners', ['Ana', 'Caio']))).toBe(NOTE.replace('    - Bia', '    - Caio'));
    expect(apply(setList(front, 'aliases', ['Failover']))).toBe(NOTE.replace('aliases: []', 'aliases: [Failover]'));
  });

  it('renames, removes and adds an entry', () => {
    expect(apply(renameKey(front, 'draft', 'wip'))).toBe(NOTE.replace('draft: yes', 'wip: yes'));
    expect(renameKey(front, 'draft', 'tags')).toEqual([]);
    expect(apply(removeEntry(front, 'owners'))).toBe(NOTE.replace('owners:\n    - Ana\n    - Bia\n', ''));
    expect(apply(addEntry(front, 'status', 'open'))).toBe(NOTE.replace('empty:\n---', 'empty:\nstatus: open\n---'));
    expect(apply(addEntry(front, 'people', ['A', 'B']))).toBe(NOTE.replace('empty:\n---', 'empty:\npeople: [A, B]\n---'));
  });
});
