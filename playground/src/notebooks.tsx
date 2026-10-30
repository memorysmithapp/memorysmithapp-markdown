// The demonstration notebooks as an in-memory notebook: notes by path, named by their `name:`,
// reached by name and then by alias, and the host contract that answers from them. The page and
// the tests build it from the same files.

import type { EmbeddedNote, KeptFile, LinkChoices, NoteHost, TableRow, TableSchema } from '@memorysmithapp/markdown-renderer';
import { runTableQuery, splitFrontmatter } from '@memorysmithapp/markdown-renderer';
import SAMPLE_TABLES from '../fixtures/tables.json';

export interface Note {
  readonly notebook: string;
  /** The path inside the notebook, `01 Castas/Índice.md`. */
  readonly path: string;
  readonly folders: readonly string[];
  readonly markdown: string;
  /** The `name:` it states, or `null`: a heading never names a note. */
  readonly name: string | null;
  readonly aliases: readonly string[];
}

export interface Notebook {
  readonly slug: string;
  readonly notes: readonly Note[];
  /** The files the notebook keeps beside its notes. */
  readonly files: readonly string[];
}

/** The files a notebook carries that are not notes: generated from its model. */
const NOT_NOTES = new Set(['GUIDANCE.md', 'STRUCTURE.md', 'TEMPLATE.md']);

/** The four delimiters of the form that addresses a note: a name with one is no name. */
const UNADDRESSABLE = /[#[\]|]/;

function readName(markdown: string): { name: string | null; aliases: string[] } {
  const { frontmatter, lists } = splitFrontmatter(markdown);
  const stated = lists.has('name') ? '' : (frontmatter['name'] ?? '').normalize('NFC').trim();
  const name = stated.length === 0 || UNADDRESSABLE.test(stated) ? null : stated;
  const aliases = (frontmatter['aliases'] ?? '')
    .split(',')
    .map((alias) => alias.normalize('NFC').trim())
    .filter((alias) => alias.length > 0);
  return { name, aliases };
}

/**
 * The notebooks of a set of files, keyed by their path under `notebooks/`:
 * `continuity-engineering/01 Objectives/Failure domain.md`.
 */
export function buildNotebooks(files: Record<string, string>, kept: Record<string, readonly string[]> = {}): Notebook[] {
  const bySlug = new Map<string, Note[]>();
  for (const [key, markdown] of Object.entries(files)) {
    const [slug, ...rest] = key.split('/');
    const file = rest.at(-1) ?? '';
    if (!slug || !file.endsWith('.md') || NOT_NOTES.has(file)) continue;
    const { name, aliases } = readName(markdown);
    const note: Note = { notebook: slug, path: rest.join('/'), folders: rest.slice(0, -1), markdown, name, aliases };
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), note]);
  }
  return [...bySlug.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, notes]) => ({
      slug,
      notes: notes.sort((a, b) => a.path.localeCompare(b.path)),
      files: kept[slug] ?? [],
    }));
}

/**
 * The address of a note in the page: a path of the page's own, which is what
 * the renderer draws through `renderLink` — an address that starts with `#` is
 * an anchor inside the note. It is the note's path in its notebook without the
 * extension, so a picture the note writes as `../assets/<name>` reaches
 * `/notes/<slug>/assets/<name>`.
 */
export function addressOf(note: Note): string {
  const segments = [note.notebook, ...note.path.replace(/\.md$/, '').split('/')];
  return `/notes/${segments.map(encodeURIComponent).join('/')}`;
}

/** The note an address names, or `null`. */
export function noteAt(notebooks: readonly Notebook[], pathname: string): Note | null {
  const segments = pathname.replace(/^\/notes\//, '').split('/').map((segment) => decodeURIComponent(segment));
  const [slug, ...rest] = segments;
  const notebook = notebooks.find((each) => each.slug === slug);
  return notebook?.notes.find((note) => note.path === `${rest.join('/')}.md`) ?? null;
}

/** The notes a target reaches: by name, or — only when no name matches — by alias (§5.2). */
export function reaching(notebook: Notebook, target: string): { by: 'name' | 'alias' | null; notes: Note[] } {
  const wanted = target.normalize('NFC');
  const named = notebook.notes.filter((note) => note.name === wanted);
  if (named.length > 0) return { by: 'name', notes: named };
  const aliased = notebook.notes.filter((note) => note.aliases.includes(wanted));
  return aliased.length > 0 ? { by: 'alias', notes: aliased } : { by: null, notes: [] };
}

/** A table a notebook keeps: its columns and its rows, as `fixtures/tables.json` holds them (#138). */
interface SampleTable extends TableSchema {
  readonly rows: readonly TableRow[];
}

/** The tables of a notebook, by name compared after NFC with case folded (`SPEC.md` §5.9). */
function tablesOf(slug: string): Map<string, SampleTable> {
  const tables = (SAMPLE_TABLES as unknown as Record<string, readonly SampleTable[]>)[slug] ?? [];
  return new Map(tables.map((table) => [table.name.normalize('NFC').toLowerCase(), table]));
}

/** The host contract over one notebook, which is what MemorySmith gives the reading page. */
export function hostOf(notebook: Notebook, fileOf: (name: string) => KeptFile | null, go: (address: string) => void = () => undefined): NoteHost {
  const one = (name: string): Note | null => {
    const { notes } = reaching(notebook, name);
    return notes.length === 1 ? (notes[0] ?? null) : null;
  };
  const tables = tablesOf(notebook.slug);
  return {
    resolve: (name) => {
      const note = one(name);
      return note ? addressOf(note) : null;
    },
    reaches: (name) => reaching(notebook, name).notes.length,
    choose: async (name): Promise<LinkChoices> => {
      const { by, notes } = reaching(notebook, name);
      return {
        by,
        notes: notes.map((note) => ({ name: note.name, address: addressOf(note), trail: note.folders, folderDescription: '' })),
      };
    },
    targetAddress: () => null,
    loadNote: async (name): Promise<EmbeddedNote | null> => {
      const note = one(name);
      return note ? { markdown: note.markdown, name: note.name, address: addressOf(note) } : null;
    },
    keeps: (name) => notebook.files.includes(name.normalize('NFC')),
    // The rows a `table` block asks for, answered from the sample tables as MemorySmith answers from its own (#138).
    queryTable: async (request) => {
      const table = tables.get(request.table.normalize('NFC').toLowerCase());
      return table ? runTableQuery({ schema: table, rows: table.rows }, request) : null;
    },
    // What the editor suggests after `[[`: names that start with what was typed, then the rest that hold it.
    suggest: (query) => {
      const typed = query.normalize('NFC').toLowerCase();
      const names = [...new Set(notebook.notes.flatMap((note) => [note.name, ...note.aliases]).filter((name): name is string => name !== null))];
      const starts = names.filter((name) => name.toLowerCase().startsWith(typed));
      const holds = names.filter((name) => !starts.includes(name) && name.toLowerCase().includes(typed));
      return [...starts, ...holds].slice(0, 12);
    },
    navigate: go,
    renderLink: ({ href, className, children }) => (
      <a
        className={className}
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          go(href);
        }}
      >
        {children}
      </a>
    ),
    // The files are drawn by the renderer, by their type, from what `fileOf` says of them (#77).
    fileOf,
  };
}
