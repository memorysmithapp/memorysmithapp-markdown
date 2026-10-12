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
};

/** The host's words over the English ones, key by key. */
export function withDefaults(strings: Partial<NoteStrings> | undefined): NoteStrings {
  return { ...ENGLISH, ...strings };
}
