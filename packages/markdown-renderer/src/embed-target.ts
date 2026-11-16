/**
 * What an embed reaches (`SPEC.md` §5.2, §5.8): a note of that name, else an attachment of that
 * name, else nothing.
 *
 * **A note comes first.** What a target is is decided by what the notebook holds, in that order,
 * so a file reaches an embed only when no note answers its name: by name, or, when no name matched,
 * by alias, which is what `reaches` counts. The page used to ask for the file first, so a note and a
 * file of one name drew the file while the index made the edge to the note (#148).
 *
 * **An embed never reaches the note it is written in** (§5.2, #147). It is resolved as any
 * reference is, and the note itself is then taken out of what matched; when the note was the only
 * match, no later step is tried, and the embed reaches the file of that name, else nothing. So
 * `![[x]]` in the note `x` beside the file `x` draws the file, which is what an author naming a note
 * after the file it shows means. The renderer knows the note by the address the host gives
 * (`noteAddress`), and reads its name and aliases from its own frontmatter (§5.3, §6.4):
 *
 * - matched **by its name**, the note is one of the name matches, so the count less one is the
 *   number of other notes, known at once and with no request;
 * - matched **by an alias**, the count does not say whether a name matched first, so the host's
 *   `choose`, which says `by` what and lists the addresses, is asked;
 * - and the one other note left is loaded **by its address**, `loadNoteAt`, because by name the
 *   host answers no single note.
 *
 * Every place that decides between a note and a file asks here: the runs of the reading page, the
 * content of an embedded note, the editor's blocks and marks, and `diagnose`.
 */

import type { EmbeddedNote, ResolvedHost } from './host.js';
import { readProperties } from './properties.js';

/** The note being drawn, which an embed of its own name or alias does not reach. */
export interface DrawnNote {
  /** Its address, as the host's `choose` gives addresses. */
  readonly address: string;
  /** Its name, from its frontmatter, in NFC; `null` for a note that has none. */
  readonly name: string | null;
  /** Its aliases, from its frontmatter, in NFC. */
  readonly aliases: readonly string[];
}

/**
 * The note at `address` whose text is `markdown`, or `null` with no address: what is not a note the
 * notebook keeps — a guidance, a template, a dashboard, a draft never saved — excludes nothing,
 * because the host counts no note for it.
 */
export function drawnNote(address: string | null | undefined, markdown: string): DrawnNote | null {
  if (!address) return null;
  const read = readProperties(markdown);
  const aliases = read.entries.find((entry) => entry.key === 'aliases')?.values ?? [];
  return {
    address,
    name: read.name === null ? null : read.name.normalize('NFC'),
    aliases: aliases.map((alias) => alias.normalize('NFC')),
  };
}

/** The same host drawing `drawn`; the host itself when nothing changes, so its identity holds. */
export function drawing<T extends { readonly drawn: DrawnNote | null }>(host: T, drawn: DrawnNote | null): T {
  if (host.drawn === drawn) return host;
  if (host.drawn && drawn && sameNote(host.drawn, drawn)) return host;
  return { ...host, drawn };
}

function sameNote(one: DrawnNote, other: DrawnNote): boolean {
  return (
    one.address === other.address &&
    one.name === other.name &&
    one.aliases.length === other.aliases.length &&
    one.aliases.every((alias, index) => alias === other.aliases[index])
  );
}

/** What the host says, at once, an embed reaches. */
export type EmbedReach =
  /** Exactly one note: it is expanded in place. */
  | 'note'
  /** Several notes: a choice the reader makes, never expanded. */
  | 'choice'
  /** No note, and a file the notebook keeps under the name. */
  | 'file'
  /** Nothing the notebook holds. */
  | 'pending'
  /** The note being drawn carries the name as an alias: only `choose` can say what is left. */
  | 'ask';

/** What the decision reads of the host. */
export type EmbedHost = Pick<ResolvedHost, 'reaches' | 'keeps' | 'choose' | 'drawn'>;

/** What an embed of `name` reaches, as far as the count of the host tells at once. */
export function embedReach(host: EmbedHost, name: string): EmbedReach {
  const target = name.normalize('NFC');
  const notes = host.reaches(target);
  const { drawn } = host;
  // Matched by its name, the note is one of the matches; when it was the only one, no alias is
  // tried, and the file of that name is next (§5.2).
  if (drawn !== null && drawn.name === target) return byCount(host, name, Math.max(0, notes - 1));
  // Matched by an alias, it is among the matches only when no name matched, which the count does
  // not say. A host without `choose` cannot say it either, and its count is taken as it is.
  if (drawn !== null && drawn.aliases.includes(target) && host.choose) return 'ask';
  return byCount(host, name, notes);
}

function byCount(host: EmbedHost, name: string, notes: number): EmbedReach {
  if (notes === 1) return 'note';
  if (notes > 1) return 'choice';
  return host.keeps(name) ? 'file' : 'pending';
}

/**
 * Whether an embed of a name draws a file: the predicate `splitEmbeds`, `demoteEmbeds` and
 * `resolveWikilinks` take, which leaves the bang on an embed of a file and turns every other
 * embed into a note's. An embed the count cannot decide is a note's here, and is decided where it
 * is expanded.
 */
export function embedsFile(host: EmbedHost): (name: string) => boolean {
  return (name) => embedReach(host, name) === 'file';
}

/** What an embed reaches, decided: the note with how to load it, or what is drawn instead. */
export type EmbedTarget =
  | { readonly kind: 'note'; readonly load: (() => Promise<EmbeddedNote | null>) | null }
  | { readonly kind: 'choice' | 'file' | 'pending' };

/** What the decision reads of the host to load the note it reaches. */
export type EmbedLoadHost = EmbedHost & Partial<Pick<ResolvedHost, 'loadNote' | 'loadNoteAt'>>;

/**
 * What an embed of `name` reaches, asking `choose` only when the note being drawn is among the
 * notes the name matches and another one has to be told from it. Answered at once otherwise.
 */
export function embedTarget(host: EmbedLoadHost, name: string): EmbedTarget | Promise<EmbedTarget> {
  const target = name.normalize('NFC');
  const reach = embedReach(host, name);
  const { drawn, choose } = host;
  const loadNote = host.loadNote ?? null;
  if (reach === 'choice' || reach === 'file' || reach === 'pending') return { kind: reach };
  const itself = drawn !== null && (reach === 'ask' || drawn.name === target);
  if (!itself) return { kind: 'note', load: loadNote ? () => loadNote(target) : null };
  // The one note left is not the one a name answers: only its address says which it is.
  if (!choose) return { kind: 'note', load: null };
  return choose(target).then(({ notes }) => {
    const rest = notes.filter((note) => note.address !== drawn.address);
    if (rest.length === 0) return { kind: host.keeps(name) ? 'file' : 'pending' };
    if (rest.length > 1) return { kind: 'choice' };
    const address = rest[0]!.address;
    const loadNoteAt = host.loadNoteAt ?? null;
    if (loadNoteAt) return { kind: 'note', load: () => loadNoteAt(address) };
    // By name, the host answers one note only when the count is one: the note itself was not counted.
    return { kind: 'note', load: loadNote && host.reaches(target) === 1 ? () => loadNote(target) : null };
  });
}
