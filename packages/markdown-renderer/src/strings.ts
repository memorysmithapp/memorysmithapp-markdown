/**
 * The words the reading surface shows of its own, around what a note says.
 *
 * The package carries no i18n library: the host gives the words in the language of whoever
 * reads, and every word it leaves out falls back to the English MemorySmith ships. A callout
 * kind with no title in `callouts` titles itself, capitalised, as the vault editors do.
 */
export interface NoteStrings {
  /** The title of an untitled callout, by kind (`note`, `warning`, …). */
  readonly callouts: Readonly<Record<string, string>>;
  /** The heading of the footnotes gathered at the end of a note. */
  readonly footnotes: string;
  /** The label of the way back from a footnote to its reference, counted from 1. */
  readonly footnoteBack: (number: number) => string;
  /** The title of a link no note answers yet. */
  readonly pendingLink: string;
  /** The title of an address the surface does not follow. */
  readonly refusedLink: string;
  /** The title of an embed naming a file the notebook does not keep. */
  readonly attachmentMissing: string;
  /** The verb of the button that copies a block of code. */
  readonly copy: string;
  /** What that button says once the block is copied. */
  readonly copied: string;
  /** The notice under a note that fetched images from other sites, naming them. */
  readonly remoteImages: (hosts: readonly string[]) => string;
  /** The accessible name of the choice a link opens. */
  readonly linkChoice: (target: string) => string;
  /** The heading of the choice when no note answers the target yet. */
  readonly linkLeadsNowhere: string;
  /** The heading of the choice when several notes answer it. */
  readonly linkLeadsToSeveral: string;
  /** What the choice says when no note answers the target. */
  readonly targetPending: (target: string) => string;
  /** What it says when notes are named the target. */
  readonly targetNamed: (target: string, count: number) => string;
  /** What it says when notes carry the target as an alias. */
  readonly targetAliased: (target: string, count: number) => string;
  /** The caption of a note that has no name. */
  readonly unnamedNote: string;
  /** What a region says while it waits for the host. */
  readonly loading: string;
  /** What a region says when the host failed to answer. */
  readonly failed: string;
  /** The control that closes the choice. */
  readonly close: string;
  /** The button that dismisses the choice. */
  readonly cancel: string;
}

/** The callout titles of MemorySmith, in English. */
const CALLOUTS: Readonly<Record<string, string>> = {
  note: 'Note',
  info: 'Info',
  todo: 'To do',
  abstract: 'Abstract',
  summary: 'Summary',
  tldr: 'TL;DR',
  tip: 'Tip',
  hint: 'Hint',
  important: 'Important',
  success: 'Success',
  check: 'Check',
  done: 'Done',
  question: 'Question',
  help: 'Help',
  faq: 'FAQ',
  warning: 'Warning',
  caution: 'Caution',
  attention: 'Attention',
  failure: 'Failure',
  fail: 'Fail',
  missing: 'Missing',
  danger: 'Danger',
  error: 'Error',
  bug: 'Bug',
  example: 'Example',
  quote: 'Quote',
  cite: 'Cite',
};

/** The words MemorySmith shows in English, used for every word a host does not give. */
export const ENGLISH: NoteStrings = {
  callouts: CALLOUTS,
  footnotes: 'Notes',
  footnoteBack: (number) => `Back to reference ${number}`,
  pendingLink: 'Pending link: the target note does not exist yet.',
  refusedLink: 'This address is not one the reading surface follows, so the text stays and the link does not.',
  attachmentMissing: 'This notebook keeps no file under that name.',
  copy: 'Copy',
  copied: 'Copied',
  remoteImages: (hosts) =>
    hosts.length === 1
      ? `Opening this note fetched an image from ${hosts.join(', ')}, so that site was told your address and the moment you read this.`
      : `Opening this note fetched images from ${hosts.length} other sites — ${hosts.join(', ')} — so each of them was told your address and the moment you read this.`,
  linkChoice: (target) => `The notes the link “${target}” may lead to`,
  linkLeadsNowhere: 'This link leads nowhere yet',
  linkLeadsToSeveral: 'This link leads to more than one note',
  targetPending: (target) =>
    `No note carries the name “${target}” yet. The link is kept and resolves on its own when one does.`,
  targetNamed: (target, count) =>
    count === 1
      ? `“${target}” is the name of one note.`
      : `“${target}” is the name of ${count} notes, each in its own folder. Choose which one to open.`,
  targetAliased: (target, count) =>
    count === 1
      ? `No note is named “${target}”. One note carries it as an alias.`
      : `No note is named “${target}”, so it matched ${count} notes that carry it as an alias — and one of them gives the link up the day somebody writes a note under this name.`,
  unnamedNote: 'Unnamed note',
  loading: 'Loading…',
  failed: 'Something went wrong.',
  close: 'Close',
  cancel: 'Cancel',
};

/** The host's words over the English ones, key by key. */
export function withDefaults(strings: Partial<NoteStrings> | undefined): NoteStrings {
  return { ...ENGLISH, ...strings };
}
