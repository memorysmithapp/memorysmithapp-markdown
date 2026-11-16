/**
 * What an embed reaches (`SPEC.md` §5.2, §5.8): a note of that name, else an attachment of that
 * name, else nothing.
 *
 * **A note comes first.** What a target is is decided by what the notebook holds, in that order,
 * so a file reaches an embed only when no note answers its name: by name, or, when no name matched,
 * by alias, which is what `reaches` counts. The page used to ask for the file first, so a note and a
 * file of one name drew the file while the index made the edge to the note (#148).
 *
 * Every place that decides between a note and a file asks here: the runs of the reading page, the
 * content of an embedded note, the editor's blocks and marks, and `diagnose`.
 */

import type { ResolvedHost } from './host.js';

/** What the count of the host says an embed reaches. */
export type EmbedReach =
  /** Exactly one note: it is expanded in place. */
  | 'note'
  /** Several notes: a choice the reader makes, never expanded. */
  | 'choice'
  /** No note, and a file the notebook keeps under the name. */
  | 'file'
  /** Nothing the notebook holds. */
  | 'pending';

/** What the decision reads of the host. */
export type EmbedHost = Pick<ResolvedHost, 'reaches' | 'keeps'>;

/** What an embed of `name` reaches. */
export function embedReach(host: EmbedHost, name: string): EmbedReach {
  const notes = host.reaches(name.normalize('NFC'));
  if (notes === 1) return 'note';
  if (notes > 1) return 'choice';
  return host.keeps(name) ? 'file' : 'pending';
}

/**
 * Whether an embed of a name draws a file: the predicate `splitEmbeds`, `demoteEmbeds` and
 * `resolveWikilinks` take, which leaves the bang on an embed of a file and turns every other
 * embed into a note's.
 */
export function embedsFile(host: EmbedHost): (name: string) => boolean {
  return (name) => embedReach(host, name) === 'file';
}
