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
  /** The heading of the properties a note's frontmatter declares. */
  readonly properties: string;
  /** The locale a date of a property is written in, as `Intl` takes it: `en-US`, `pt-BR`. */
  readonly locale: string;
  /** How a boolean property reads, true and false. */
  readonly yes: string;
  readonly no: string;
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
  /** A card's ways to a file: open it where a browser shows it, and save it (#77). */
  readonly attachmentOpen: string;
  readonly attachmentDownload: string;
  /** What each type MemorySmith keeps is called, by media type; a type left out is named by its media type. */
  readonly fileKinds: Readonly<Record<string, string>>;
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
  /** What an embed says when the section or block it names is not in the note. */
  readonly embedSectionMissing: (section: string) => string;
  /** The caption of a note that has no name. */
  readonly unnamedNote: string;
  /** What a task item says while the host saves its tick. */
  readonly updating: string;
  /** What is said, to whoever hears the page, once a tick is saved. */
  readonly saved: string;
  /** What a task item says for a moment when the host failed to save its tick. */
  readonly notSaved: string;
  /** The switch to edit mode, which says the action. */
  readonly edit: string;
  /** The switch back to reading, which says the action. */
  readonly view: string;
  /** What edit mode says of a note it cannot keep byte for byte, and so opens read-only. */
  readonly editUnavailable: string;
  /** The words of the editor: its toolbar, its forms and its controls. */
  readonly editor: EditorWords;
  /** What a region says while it waits for the host. */
  readonly loading: string;
  /** What a region says when the host failed to answer. */
  readonly failed: string;
  /** The control that closes the choice. */
  readonly close: string;
  /** The button that dismisses the choice. */
  readonly cancel: string;
}

/** The words of the editor (`./edit`), each a label a control shows or is named by. */
export interface EditorWords {
  readonly toolbar: string;
  /** The control that gives back the note as edit mode opened it (#67). */
  readonly revert: string;
  readonly undo: string;
  readonly redo: string;
  readonly paragraph: string;
  readonly heading: string;
  readonly bold: string;
  readonly italic: string;
  readonly strikethrough: string;
  readonly highlight: string;
  readonly code: string;
  readonly link: string;
  readonly wikilink: string;
  readonly bulletList: string;
  readonly orderedList: string;
  readonly taskList: string;
  readonly quote: string;
  readonly callout: string;
  readonly table: string;
  readonly codeBlock: string;
  readonly math: string;
  readonly diagram: string;
  readonly rule: string;
  readonly footnote: string;
  readonly comment: string;
  /** The toolbar's button that attaches a file, and what it says while the host keeps it or failed (#75). */
  readonly attach: string;
  readonly attaching: string;
  readonly attachFailed: string;
  /** Said after the host's step while more files wait their turn (#88). */
  readonly attachQueued: (count: number) => string;
  /** Said over a drawn block's lines when drawing it failed, so the block is never left empty (#90). */
  readonly blockFailed: string;
  /** A code block's language, chosen at its top right (#84). */
  readonly language: string;
  readonly plainText: string;
  readonly mermaidDiagram: string;
  readonly searchLanguages: string;
  readonly noLanguage: string;
  readonly notHighlighted: string;
  /** The editing menu of a right-click (#81): its name, its groups, and the clipboard's verbs. */
  readonly menu: string;
  readonly menuFormat: string;
  readonly menuInsert: string;
  readonly menuEdit: string;
  readonly cut: string;
  readonly paste: string;
  /** The attach dialog (#78): its title, its three ways in, and what each one asks and says. */
  readonly attachTitle: string;
  readonly fromComputer: string;
  readonly fromNotebook: string;
  readonly fromWeb: string;
  readonly chooseFiles: string;
  readonly fileName: string;
  readonly fileDescription: string;
  readonly attachConfirm: string;
  readonly searchFiles: string;
  readonly noFiles: string;
  readonly noMatch: string;
  readonly webAddress: string;
  readonly webName: string;
  readonly webInsert: string;
  readonly webInvalid: string;
  /** The control that shows a block as the text it is written in. */
  readonly source: string;
  readonly title: string;
  readonly addProperties: string;
  readonly addProperty: string;
  readonly removeProperty: string;
  readonly propertyKey: string;
  readonly propertyValue: string;
  /** The type of a property, chosen at its key, and each type's word (#70, #71). */
  readonly propertyType: string;
  readonly typeText: string;
  readonly typeList: string;
  readonly typeBoolean: string;
  readonly typeDate: string;
  readonly addItem: string;
  readonly removeItem: string;
  readonly calloutType: string;
  /** The field of an image's width in edit mode, in pixels (#98). */
  readonly imageWidth: string;
  /** The button that draws an image at its own size again (#98). */
  readonly imageOwnSize: string;
  /** The handle at an image's corner that drags its size (#98). */
  readonly imageResize: string;
  readonly fold: string;
  readonly foldNone: string;
  readonly foldOpen: string;
  readonly foldClosed: string;
  readonly addRow: string;
  readonly addColumn: string;
  readonly removeRow: string;
  readonly removeColumn: string;
  readonly alignLeft: string;
  readonly alignCenter: string;
  readonly alignRight: string;
  /** The buttons beside the switch that show the note's Markdown and copy it, and the dialog (#63, #76). */
  readonly showMarkdown: string;
  readonly copyMarkdown: string;
  readonly sourceTitle: string;
  readonly copy: string;
  readonly copied: string;
  readonly copyFailed: string;
  /** Where the save of the last change stands (#64); `saved` and `notSaved` are the page's own. */
  readonly saving: string;
  readonly retry: string;
  /** Said when the author asked to go back to reading and the last change is not saved. */
  readonly stayInEdit: string;
  /** Said while a refused save waits for the author's choice before the note is written in again (#101). */
  readonly chooseToEdit: string;
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
  properties: 'Properties',
  locale: 'en-US',
  yes: 'Yes',
  no: 'No',
  footnotes: 'Notes',
  footnoteBack: (number) => `Back to reference ${number}`,
  pendingLink: 'Pending link: the target note does not exist yet.',
  refusedLink: 'This address is not one the reading surface follows, so the text stays and the link does not.',
  attachmentMissing: 'This notebook keeps no file under that name.',
  attachmentOpen: 'Open',
  attachmentDownload: 'Download',
  fileKinds: {
    'image/png': 'PNG image',
    'image/jpeg': 'JPEG image',
    'image/webp': 'WebP image',
    'image/gif': 'GIF image',
    'image/svg+xml': 'SVG image',
    'application/pdf': 'PDF document',
    'audio/mpeg': 'MP3 audio',
    'audio/wav': 'WAV audio',
    'audio/ogg': 'Ogg audio',
    'audio/webm': 'WebM audio',
    'video/mp4': 'MP4 video',
    'video/webm': 'WebM video',
    'video/quicktime': 'QuickTime video',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint presentation',
  },
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
  embedSectionMissing: (section) => `The section "${section}" is not in this note.`,
  unnamedNote: 'Unnamed note',
  updating: 'Updating…',
  saved: 'Saved',
  notSaved: 'Not saved',
  edit: 'Edit',
  view: 'View',
  editUnavailable:
    'This note mixes line endings, which the editor cannot keep byte for byte, so it opens read-only.',
  editor: {
    toolbar: 'Formatting',
    revert: 'Undo all changes',
    undo: 'Undo',
    redo: 'Redo',
    paragraph: 'Paragraph',
    heading: 'Heading',
    bold: 'Bold',
    italic: 'Italic',
    strikethrough: 'Strikethrough',
    highlight: 'Highlight',
    code: 'Code',
    link: 'Link',
    wikilink: 'Link to a note',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    taskList: 'Task list',
    quote: 'Quotation',
    callout: 'Callout',
    table: 'Table',
    codeBlock: 'Code block',
    math: 'Formula',
    diagram: 'Diagram',
    rule: 'Divider',
    footnote: 'Footnote',
    comment: 'Comment',
    attach: 'Attach a file',
    attaching: 'Attaching…',
    attachFailed: 'The file was not attached',
    attachQueued: (count) => (count === 1 ? '1 more file waiting' : `${count} more files waiting`),
    blockFailed: 'This block could not be drawn; its Markdown is below',
    language: 'Language',
    plainText: 'Plain text',
    mermaidDiagram: 'Mermaid diagram',
    searchLanguages: 'Search languages',
    noLanguage: 'No language matches.',
    notHighlighted: 'not highlighted',
    menu: 'Editing',
    menuFormat: 'Format',
    menuInsert: 'Insert',
    menuEdit: 'Edit',
    cut: 'Cut',
    paste: 'Paste',
    attachTitle: 'Attach',
    fromComputer: 'From the computer',
    fromNotebook: 'From the notebook',
    fromWeb: 'From the web',
    chooseFiles: 'Choose files',
    fileName: 'Name',
    fileDescription: 'Description',
    attachConfirm: 'Attach',
    searchFiles: "Search the notebook's files",
    noFiles: 'The notebook keeps no file yet.',
    noMatch: 'No file matches.',
    webAddress: 'Address',
    webName: 'Name',
    webInsert: 'Insert',
    webInvalid: 'An address on the web starts with https:// or http://.',
    source: 'Source',
    title: 'Title',
    addProperties: 'Add properties',
    addProperty: 'Add a property',
    removeProperty: 'Remove the property',
    propertyKey: 'Key',
    propertyValue: 'Value',
    propertyType: 'Type',
    typeText: 'Text',
    typeList: 'List',
    typeBoolean: 'Yes or no',
    typeDate: 'Date',
    addItem: 'Add',
    removeItem: 'Remove',
    calloutType: 'Type',
    imageWidth: 'Width, in pixels',
    imageOwnSize: 'Its own size',
    imageResize: 'Drag to resize',
    fold: 'Folding',
    foldNone: 'Not foldable',
    foldOpen: 'Folds, open',
    foldClosed: 'Folds, closed',
    addRow: 'Add a row',
    addColumn: 'Add a column',
    removeRow: 'Remove the row',
    removeColumn: 'Remove the column',
    alignLeft: 'Align left',
    alignCenter: 'Center',
    alignRight: 'Align right',
    showMarkdown: 'Show Markdown',
    copyMarkdown: 'Copy Markdown',
    sourceTitle: 'The note in Markdown',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    saving: 'Saving…',
    retry: 'Try again',
    stayInEdit: 'Not saved: the note stays in edit',
    chooseToEdit: 'Choose what to do with it to keep writing',
  },
  loading: 'Loading…',
  failed: 'Something went wrong.',
  close: 'Close',
  cancel: 'Cancel',
};

/** The host's words over the English ones, key by key. */
export function withDefaults(strings: NoteStringsInput | undefined): NoteStrings {
  // The editor's words and the names of the file types are merged one by one too, so a host may
  // translate some and keep the rest.
  return {
    ...ENGLISH,
    ...strings,
    editor: { ...ENGLISH.editor, ...strings?.editor },
    fileKinds: { ...ENGLISH.fileKinds, ...strings?.fileKinds },
  };
}

/** The words a host gives: any of them, and any of the editor's. */
export type NoteStringsInput = Partial<Omit<NoteStrings, 'editor'>> & { readonly editor?: Partial<EditorWords> };
