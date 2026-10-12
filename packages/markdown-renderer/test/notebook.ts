// An in-memory notebook for the tests: notes by name, an address per note, and the host contract
// that answers from them.

import type { EmbeddedNote, NoteHost } from '../src/index.js';

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
