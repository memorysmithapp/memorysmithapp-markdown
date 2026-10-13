/**
 * The frontmatter of a note, read for drawing (§6).
 *
 * The frontmatter is content: what the author wrote about the note. The
 * renderer reads it the way the specification reads it and hands it to the
 * theme, which decides how — and whether — it is drawn. The default theme
 * draws `name` as the note's title and every other entry as a property, by
 * the shape of its value.
 *
 * It reads the subset of YAML §6.2 names — scalars, inline lists and dash
 * lists, with one layer of matching quotes stripped — and nothing else; a line
 * it does not read is left out, never guessed at. A value written as a
 * wikilink, `"[[Note]]"`, is kept as written: the theme draws it as a link,
 * resolved by the host as a link of the body is. That is a decision of the
 * reading surface; it adds no edge, and what an Indexer reads is unchanged.
 */

/** The shape of a value, which decides how it is drawn (§6.3). */
export type PropertyShape = 'list' | 'date' | 'boolean' | 'text' | 'prose' | 'empty';

/** One entry of the frontmatter, other than `name`. */
export interface PropertyEntry {
  /** The key as the author wrote it, in their language. */
  readonly key: string;
  readonly shape: PropertyShape;
  /**
   * The value as written, one layer of quotes stripped: one item, or each item of a list. A
   * theme reads a boolean or a date from it, and shows what was typed where it shows the bytes.
   */
  readonly values: readonly string[];
}

/** The frontmatter, read. */
export interface NoteProperties {
  /** The name of the note: `name:` when it is a single text value (§6.5), else `null`. */
  readonly name: string | null;
  /** Every other entry, in the order written. */
  readonly entries: readonly PropertyEntry[];
}

/** Above this a single value is prose rather than a category (§6.3). */
const CATEGORY_CEILING = 40;

const KEY = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/;
const DASH = /^\s+-\s+(.*)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const BOOLEAN = /^(true|false|yes|no)$/i;
/** A value that is one wikilink and nothing else, which YAML would otherwise read as a nested list. */
const WIKILINK_VALUE = /^\[\[[^\]]+\]\]$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(["'])([\s\S]*)\1$/.exec(trimmed);
  return (quoted ? (quoted[2] ?? '') : trimmed).trim();
}

/** The items of an inline list, split on the commas outside quotes and outside a wikilink. */
function inlineItems(inside: string): string[] {
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < inside.length; i++) {
    const character = inside[i]!;
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (inside.startsWith('[[', i)) {
      depth += 1;
      current += '[[';
      i += 1;
      continue;
    } else if (inside.startsWith(']]', i) && depth > 0) {
      depth -= 1;
      current += ']]';
      i += 1;
      continue;
    } else if (character === ',' && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  items.push(current);
  return items.map(unquote).filter((item) => item.length > 0);
}

function isDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function scalarEntry(key: string, raw: string): PropertyEntry {
  const value = unquote(raw);
  if (value.length === 0) return { key, shape: 'empty', values: [] };
  if (isDate(value)) return { key, shape: 'date', values: [value] };
  if (BOOLEAN.test(value)) return { key, shape: 'boolean', values: [value] };
  return { key, shape: value.length > CATEGORY_CEILING ? 'prose' : 'text', values: [value] };
}

/**
 * The frontmatter of a note, or no name and no entries when it has none. The block begins on the
 * first line with `---` and ends at the next line that is `---` (§6.1).
 */
export function readProperties(markdown: string): NoteProperties {
  const text = markdown.replace(/\r\n?/g, '\n');
  const none: NoteProperties = { name: null, entries: [] };
  if (!text.startsWith('---\n')) return none;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return none;
  const lines = text.slice(4, end).split('\n');

  const entries: { key: string; raw: string; items: string[] | null }[] = [];
  for (const line of lines) {
    const pair = KEY.exec(line);
    if (pair) {
      const raw = (pair[2] ?? '').trim();
      const inline = raw.startsWith('[') && raw.endsWith(']') && !WIKILINK_VALUE.test(raw);
      entries.push({ key: pair[1]!, raw, items: inline ? inlineItems(raw.slice(1, -1)) : null });
      continue;
    }
    const dash = DASH.exec(line);
    const last = entries[entries.length - 1];
    // A dash list belongs to the key above it, which was written with no value.
    if (dash && last && (last.items !== null || last.raw === '')) {
      const item = unquote(dash[1] ?? '');
      if (item.length > 0) last.items = [...(last.items ?? []), item];
    }
  }

  let name: string | null = null;
  const read: PropertyEntry[] = [];
  for (const { key, raw, items } of entries) {
    if (key === 'name') {
      // Only a single text value names a note; any other shape leaves it unnamed (§6.5).
      const value = items === null ? unquote(raw) : '';
      name = value.length > 0 ? value : null;
      continue;
    }
    // A list written with no item, `[]`, is an empty value, never a list (§6.3).
    read.push(
      items === null
        ? scalarEntry(key, raw)
        : items.length === 0
          ? { key, shape: 'empty', values: [] }
          : { key, shape: 'list', values: items },
    );
  }
  return { name, entries: read };
}

/**
 * What a value may carry that is a link: a wikilink, a Markdown link to the web, or a bare web
 * address — as MemorySmith's properties read it, and nothing else of Markdown.
 */
export const VALUE_LINK =
  /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s,]+)/g;

/** Whether a boolean value reads true: `true` or `yes`, in any case. */
export function isTrue(value: string): boolean {
  return /^(true|yes)$/i.test(value.trim());
}

/** The reserved keys a theme draws as properties (§6.4): `name` is the title, not a property. */
export const DRAWN_RESERVED_KEYS: readonly string[] = ['aliases', 'tags'];
