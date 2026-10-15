/**
 * The frontmatter of a note, read as ranges of its bytes, and the edits the properties form makes
 * to it (#58).
 *
 * An edit rewrites the lines of the one entry it names, in the form that entry was written in —
 * a scalar stays a scalar with its quotes, an inline list stays inline, a dash list keeps its
 * indent — and leaves every other line of the block as written: the order of the keys, their
 * quoting, and any line the form does not read, such as a comment.
 */

import type { Span } from './analyze.js';
import type { TextChange } from './table.js';

export type EntryForm = 'scalar' | 'inline' | 'dash';

export interface FrontmatterEntry extends Span {
  readonly key: string;
  readonly keySpan: Span;
  readonly form: EntryForm;
  /** The value written on the key's line, after the colon and its spaces: empty for a dash list. */
  readonly valueSpan: Span;
  /** The quote a scalar was written in, which an edit keeps. */
  readonly quote: '"' | "'" | null;
  /** The indent of a dash list's items, which a new item copies. */
  readonly indent: string;
}

export interface Frontmatter extends Span {
  readonly source: string;
  /** Where a new entry goes: the start of the closing `---` line. */
  readonly end: number;
  readonly entries: readonly FrontmatterEntry[];
}

const KEY = /^([A-Za-z0-9_-]+)([ \t]*:[ \t]*)(.*)$/;
const DASH = /^([ \t]+)-[ \t]+/;

/** The frontmatter of a note, or `null` when it has none (§6.1). */
export function readFrontmatter(source: string): Frontmatter | null {
  if (!source.startsWith('---\n')) return null;
  const close = /\n---[ \t]*(?:\n|$)/.exec(source.slice(3));
  if (!close) return null;
  const end = 3 + close.index + 1;
  type Mutable = { -readonly [K in keyof FrontmatterEntry]: FrontmatterEntry[K] };
  const entries: Mutable[] = [];
  // The entry the next dash line may belong to; a line the form does not read ends it.
  let open: Mutable | null = null;
  let at = 4;
  while (at < end) {
    const newline = source.indexOf('\n', at);
    const lineTo = newline === -1 || newline > end ? end : newline;
    const line = source.slice(at, lineTo);
    const pair = KEY.exec(line);
    const dash = DASH.exec(line);
    if (pair) {
      const key = pair[1]!;
      const valueFrom = at + key.length + pair[2]!.length;
      const raw = pair[3]!.replace(/[ \t]+$/, '');
      const inline = raw.startsWith('[') && raw.endsWith(']') && !/^\[\[[^\]]+\]\]$/.test(raw);
      const quote = /^(["'])[\s\S]*\1$/.exec(raw)?.[1];
      open = {
        key,
        from: at,
        to: lineTo,
        keySpan: { from: at, to: at + key.length },
        form: inline ? 'inline' : 'scalar',
        valueSpan: { from: valueFrom, to: valueFrom + raw.length },
        quote: quote === '"' || quote === "'" ? quote : null,
        indent: '  ',
      };
      entries.push(open);
    } else if (open && dash && (open.form === 'dash' || open.valueSpan.from === open.valueSpan.to)) {
      open.form = 'dash';
      open.indent = dash[1]!;
      open.to = lineTo;
    } else {
      open = null;
    }
    at = lineTo + 1;
  }
  return { source, from: 0, to: end + 3, end, entries };
}

/** A scalar as YAML reads it back as the same text: quoted when it would otherwise mean something else. */
export function scalarText(value: string, quote: '"' | "'" | null = null): string {
  const single = value.replace(/\r?\n/g, ' ');
  if (quote === "'") return `'${single.replace(/'/g, "''")}'`;
  if (quote === '"' || needsQuotes(single)) return `"${single.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return single;
}

function needsQuotes(value: string): boolean {
  if (value.length === 0) return false;
  if (/^\[\[[^\]]+\]\]$/.test(value)) return true;
  return /^[\s\-?:,[\]{}#&*!|>'"%@`]|\s$|: | #|:$/.test(value);
}

function itemText(value: string): string {
  const single = value.replace(/\r?\n/g, ' ').trim();
  return /[,[\]{}#&*!|>'"%@`]|: /.test(single) || /^[\s-?:]/.test(single)
    ? `"${single.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : single;
}

function entryOf(frontmatter: Frontmatter, key: string): FrontmatterEntry | undefined {
  return frontmatter.entries.find((entry) => entry.key === key);
}

/** Sets an entry to one value, keeping its quote; a list becomes the scalar on the key's line. */
export function setScalar(frontmatter: Frontmatter, key: string, value: string): TextChange[] {
  const entry = entryOf(frontmatter, key);
  if (!entry) return addEntry(frontmatter, key, value);
  const insert = scalarText(value, entry.quote);
  if (entry.form === 'scalar') {
    const written = frontmatter.source.slice(entry.valueSpan.from, entry.valueSpan.to);
    if (written === insert) return [];
    // `key:` with nothing after it gains the space a value is written after.
    const spaced = entry.valueSpan.from === entry.keySpan.to + 1 && insert.length > 0 ? ` ${insert}` : insert;
    return [{ from: entry.valueSpan.from, to: entry.valueSpan.to, insert: spaced }];
  }
  return [{ from: entry.keySpan.to, to: entry.to, insert: `: ${insert}` }];
}

/** Sets an entry to a list, in the form it was written in; a scalar becomes an inline list. */
export function setList(frontmatter: Frontmatter, key: string, items: readonly string[]): TextChange[] {
  const entry = entryOf(frontmatter, key);
  const inline = `[${items.map(itemText).join(', ')}]`;
  if (!entry) return addEntry(frontmatter, key, items);
  if (entry.form === 'dash' && items.length > 0) {
    const lines = items.map((item) => `\n${entry.indent}- ${itemText(item)}`).join('');
    const written = frontmatter.source.slice(entry.keySpan.to, entry.to);
    const keyLine = frontmatter.source.slice(entry.keySpan.to, frontmatter.source.indexOf('\n', entry.keySpan.to));
    const insert = `${keyLine}${lines}`;
    return written === insert ? [] : [{ from: entry.keySpan.to, to: entry.to, insert }];
  }
  if (entry.form === 'inline' || entry.form === 'scalar') {
    if (frontmatter.source.slice(entry.valueSpan.from, entry.valueSpan.to) === inline) return [];
    const spaced = entry.valueSpan.from === entry.keySpan.to + 1 ? ` ${inline}` : inline;
    return [{ from: entry.valueSpan.from, to: entry.valueSpan.to, insert: spaced }];
  }
  return [{ from: entry.keySpan.to, to: entry.to, insert: `: ${inline}` }];
}

/** Renames a key, and only the key. */
export function renameKey(frontmatter: Frontmatter, key: string, next: string): TextChange[] {
  const entry = entryOf(frontmatter, key);
  if (!entry || !/^[A-Za-z0-9_-]+$/.test(next) || next === key || entryOf(frontmatter, next)) return [];
  return [{ from: entry.keySpan.from, to: entry.keySpan.to, insert: next }];
}

/** Removes an entry with all its lines. */
export function removeEntry(frontmatter: Frontmatter, key: string): TextChange[] {
  const entry = entryOf(frontmatter, key);
  return entry ? [{ from: entry.from, to: entry.to + 1, insert: '' }] : [];
}

/** Adds an entry at the end of the block, before its closing line. */
export function addEntry(frontmatter: Frontmatter, key: string, value: string | readonly string[]): TextChange[] {
  if (!/^[A-Za-z0-9_-]+$/.test(key) || entryOf(frontmatter, key)) return [];
  const written = typeof value === 'string' ? scalarText(value) : `[${value.map(itemText).join(', ')}]`;
  return [{ from: frontmatter.end, to: frontmatter.end, insert: `${key}:${written.length > 0 ? ` ${written}` : ''}\n` }];
}

/** The frontmatter a note gains when its author adds properties to a note with none. */
export const NEW_FRONTMATTER = '---\n---\n';
