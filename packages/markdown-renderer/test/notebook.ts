// An in-memory notebook for the tests: notes by name, an address per note, and the host contract
// that answers from them.

import type { EmbeddedNote, LinkChoices, NoteHost } from '../src/index.js';
import { readProperties } from '../src/properties.js';

export function notebook(notes: Record<string, string>, files: readonly string[] = []): NoteHost {
  const names = Object.keys(notes).map((name) => name.normalize('NFC'));
  const address = (name: string) => `/notes/${encodeURIComponent(name)}`;
  return {
    resolve: (name) => (names.includes(name) ? address(name) : null),
    reaches: (name) => (names.includes(name) ? 1 : 0),
    keeps: (name) => files.includes(name),
    loadNote: async (name): Promise<EmbeddedNote | null> =>
      name in notes ? { markdown: notes[name] ?? '', name, address: address(name) } : null,
  };
}

/** A note of a notebook given as documents: its address, its name and its aliases, read as §5.3 says. */
interface Kept {
  readonly address: string;
  readonly markdown: string;
  readonly name: string | null;
  readonly aliases: readonly string[];
}

/**
 * The host of a notebook given as whole documents, as a conformance case gives it: each note is
 * named by its own frontmatter, two notes may carry one name, and a target reaches every note whose
 * name matches, or, when none does, every note whose alias does (§5.2).
 */
export function documents(markdowns: readonly string[], files: readonly string[] = []): NoteHost & { readonly notes: readonly Kept[] } {
  const notes: Kept[] = markdowns.map((markdown, index) => {
    const read = readProperties(markdown);
    const aliases = read.entries.find((entry) => entry.key === 'aliases')?.values ?? [];
    return { address: `/notes/${index}`, markdown, name: read.name, aliases };
  });
  const matching = (target: string): { by: LinkChoices['by']; notes: Kept[] } => {
    const named = notes.filter((note) => note.name === target);
    if (named.length > 0) return { by: 'name', notes: named };
    const aliased = notes.filter((note) => note.aliases.includes(target));
    return { by: aliased.length > 0 ? 'alias' : null, notes: aliased };
  };
  const embedded = (note: Kept): EmbeddedNote => ({ markdown: note.markdown, name: note.name, address: note.address });
  return {
    notes,
    resolve: (name) => {
      const found = matching(name).notes;
      return found.length === 1 ? found[0]!.address : null;
    },
    reaches: (name) => matching(name).notes.length,
    choose: async (name) => {
      const { by, notes: found } = matching(name);
      return { by, notes: found.map((note) => ({ name: note.name, address: note.address, trail: [], folderDescription: '' })) };
    },
    keeps: (name) => files.includes(name),
    loadNote: async (name) => {
      const found = matching(name).notes;
      return found.length === 1 ? embedded(found[0]!) : null;
    },
  };
}
