import { createContext, useContext, type ReactNode } from 'react';
import { withDefaults, type NoteStrings, type NoteStringsInput } from './strings.js';
import type { TablePage, TableRequest } from './table-block.js';
import { DEFAULT_THEME, schemeOf, type Scheme, type Theme } from './theme.js';

/**
 * The host contract: everything the renderer needs from the notebook a note lives in, given by
 * whoever draws it.
 *
 * The package knows no API, no router, no i18n library and no query cache. What MemorySmith reads
 * from those reaches the component as these props: functions that answer about the notebook, and
 * the words the page shows. The host decides; the package draws.
 *
 * **Every default is the safe one.** With no `resolve`, every link is pending; with no `keeps`, no
 * embed reaches a file; with no `renderLink`, an internal address is a plain anchor; with no
 * `strings`, the words are MemorySmith's English.
 */
export interface NoteHost {
  /**
   * The address of the one note a link target names, compared after NFC, or `null` when no single
   * note answers it. The target is a name, literal: never slugified, never stripped of an extension.
   */
  readonly resolve?: (name: string) => string | null;
  /**
   * How many notes a target reaches, by name or, when no name matches, by alias (§5.2). One is a
   * link; more than one is a choice; none is pending. Defaults to one when `resolve` answers and
   * none otherwise.
   */
  readonly reaches?: (name: string) => number;
  /**
   * The notes a target no single note answers may lead to, asked when its link is clicked. With it,
   * such a link opens the choice in place — or goes straight to the note, when one answers by
   * alias. Without it, the link is pending and asks nothing.
   */
  readonly choose?: (name: string) => Promise<LinkChoices>;
  /** The address of the host's page about a target, which a choice link carries for a new tab. */
  readonly targetAddress?: (name: string) => string | null;
  /** Goes to an internal address, through the host's router. Defaults to `location.assign`. */
  readonly navigate?: (address: string) => void;
  /**
   * The note a target names, for an embed to draw in place: its body as the host keeps it, its name
   * and its address. Asked only for a target exactly one note reaches; `null` draws the embed as
   * pending. Without it, every embed of a note is pending. The package never fetches. In edit mode
   * each embedded note is also asked for as the editor opens, to lay the page out at its height
   * before it is reached (#94): a host that loads from the network may cache what it answered.
   */
  readonly loadNote?: (name: string) => Promise<EmbeddedNote | null>;
  /**
   * The rows a `table` block asks for (`SPEC.md` §7.15, #138): the table it names, the columns, the
   * filter as written, the order, the page and its size, and the column to sum. The host runs the
   * filter and answers the table's columns, the page's rows, the row count of the whole filter, the
   * total and when the rows were read; `null` says the notebook keeps no table of that name. A block
   * that cannot be read asks nothing. Without it, a `table` block is a code block, its lines as
   * written, as it is wherever no tables are kept. The package never fetches; `runTableQuery`
   * answers a request from rows held in memory.
   */
  readonly queryTable?: (request: TableRequest) => Promise<TablePage | null>;
  /**
   * Whether the reader may tick the task boxes of this note. Defaults to `false`: every box shows
   * its state and none answers a click.
   */
  readonly writable?: boolean;
  /**
   * A task box was ticked. The ordinal counts the boxes of the note as the host gave it, frontmatter
   * included; the host applies it with `toggleTaskAt`, a one-character change of its bytes. The
   * package never writes the note.
   *
   * Answered with a promise, the item is locked under `strings.updating` until it settles: resolved,
   * the box is what the host's bytes say; rejected, it returns to the state its source holds and the
   * item says `strings.notSaved` for a moment. Ticks are queued, so a host is never asked again
   * before its last save settled, and applies each one to its latest bytes. Answered with anything
   * but a promise, no lock is drawn.
   */
  readonly onToggleTask?: (ordinal: number) => unknown;
  /** Whether the notebook keeps a file under that name. Only an embed reaches a file. */
  readonly keeps?: (name: string) => boolean;
  /**
   * The names of notes that start with, or contain, what an author typed after `[[` in edit mode,
   * best first. Without it, the editor suggests nothing.
   */
  readonly suggest?: (query: string) => readonly string[] | PromiseLike<readonly string[]>;
  /**
   * Keeps a file the author attached in edit mode — from the attach dialog, pasted or dropped — in
   * the notebook, under the name and with the description the author gave (a pasted or dropped file
   * has its own name and none), and answers the name it is kept under, which the editor embeds as
   * `![[name]]` (#75, #78). The package never stores a file. Without it, the editor offers no file
   * from the computer.
   *
   * While it keeps the file, the host may report each step through `progress`, which the paperclip
   * shows and announces; a promise rejected with an `AttachRefusal` has the paperclip say why until
   * the author acts (#88). A host that ignores `progress` and rejects with an error keeps the
   * paperclip's own words.
   */
  readonly attach?: (file: File, attributes: AttachAttributes, progress: (report: AttachProgress) => void) => string | PromiseLike<string>;
  /**
   * The files the notebook keeps, with their names, which the attach dialog lists for the author to
   * embed one (#78). Without it, the dialog offers no file of the notebook.
   */
  readonly files?: () => readonly KeptFileEntry[] | PromiseLike<readonly KeptFileEntry[]>;
  /**
   * What the notebook knows of a file it keeps (#77): its media type, its size and where its bytes
   * are. With it, the package draws the file as MemorySmith does, by its type — an image, an audio,
   * a video, or a card — and `null` is a name it keeps nothing under. `renderAttachment` wins over it.
   */
  readonly fileOf?: (name: string) => KeptFile | null | PromiseLike<KeptFile | null>;
  /**
   * Draws a file the notebook keeps where a note embeds it: an image, audio, video, or a card. The
   * dimensions are the ones the embed declared, in CSS pixels or as a share of the page, or `null`.
   *
   * In edit mode the node may be drawn outside the host's React tree, in the root of a block the
   * editor draws, so it must not depend on the host's context; a node that throws there leaves the
   * block's Markdown in its place (#90).
   */
  readonly renderAttachment?: (file: AttachmentRequest) => ReactNode;
  /**
   * Draws a link to an internal address, through the host's router.
   *
   * In edit mode the node may be drawn outside the host's React tree, in the root of a block the
   * editor draws — a callout, a table, an embed, the properties — so it must not depend on the host's
   * context: a router's `<Link>`, which reads its router from context, throws there. Hand it what it
   * needs (a `navigate` captured where the router is) or draw an anchor whose click the host follows.
   * A node that throws leaves the block's Markdown in its place (#90).
   */
  readonly renderLink?: (link: LinkRequest) => ReactNode;
  /** The words the page shows, in the reader's language; each one left out is MemorySmith's English. */
  readonly strings?: NoteStringsInput;
  /**
   * How the note looks: a theme (`defineTheme`), or `light` or `dark`, which are the default
   * theme — MemorySmith's look — in that scheme. Defaults to the default theme.
   */
  readonly theme?: Scheme | Theme;
  /**
   * The scheme a theme is drawn in, which also picks the theme of a Mermaid diagram. Defaults to
   * the scheme `theme` names when it is `light` or `dark`, and to `light` otherwise; a theme of one
   * scheme is drawn in it whatever is asked.
   */
  readonly scheme?: Scheme;
  /**
   * Whether a note that fetched images from other sites says so, naming them, under the body
   * (§7.10). Defaults to `true`: the specification forbids only silence. A host that discloses it
   * elsewhere turns it off and reads the hosts with `remoteImageHosts`.
   */
  readonly remoteNotice?: boolean;
}

/** What a target that no single note answers may lead to. */
export interface LinkChoices {
  /** What matched: the names of notes, their aliases, or nothing. */
  readonly by: 'name' | 'alias' | null;
  readonly notes: readonly LinkChoiceNote[];
}

/** A note a choice offers. */
export interface LinkChoiceNote {
  /** Its name, or `null` for a note that has none. */
  readonly name: string | null;
  /** Its address, which the host follows. */
  readonly address: string;
  /** The folders from the root down to the one that holds it. */
  readonly trail: readonly string[];
  /** What the folder that holds it is for, in the notebook's words. */
  readonly folderDescription: string;
}

/** A note an embed draws in place. */
export interface EmbeddedNote {
  /** The note as the host keeps it, frontmatter included. */
  readonly markdown: string;
  /** Its name, or `null` for a note that has none. */
  readonly name: string | null;
  /** Its address, which the caption under the embed links to, or `null`. */
  readonly address: string | null;
}

/** A file to draw: its name, and the dimensions the embed declared. */
/** A file the notebook keeps, as the host describes it to draw it (#77). */
export interface KeptFile {
  /** Its media type, which decides how it is drawn; the name decides nothing (§5.8). */
  readonly mimeType: string;
  /** Its size, in bytes. */
  readonly bytes: number;
  /** Where its bytes are shown: the source of an image or a player, and what a card opens. */
  readonly url: string;
  /** Where its bytes are saved from. Defaults to `url`. */
  readonly downloadUrl?: string;
  /** What the author said it is: an image's `alt`, a line of its card. */
  readonly description?: string;
}

/** A kept file with the name it is kept under, as `files` lists it (#78). */
export interface KeptFileEntry extends KeptFile {
  readonly name: string;
}

/** A step of keeping a file, as the host words it (#88). */
export interface AttachProgress {
  /** What is happening, in the reader's language: "Sending part 12 of 40". */
  readonly message: string;
  /** How much is done, from 0 to 1, when the host knows it: drawn as a determinate indicator. */
  readonly fraction?: number;
}

/**
 * Why the host would not keep a file, what `attach` rejects with (#88): a plain object, so that an
 * `Error`, whose message is meant for a developer, keeps the paperclip's own words.
 */
export interface AttachRefusal {
  /** Why, in the reader's language: "An attached file goes up to 100 MB". */
  readonly message: string;
}

/** Whether a rejection is a refusal the host worded for the author, and not an error. */
export function isAttachRefusal(value: unknown): value is AttachRefusal {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as AttachRefusal).message === 'string' &&
    (value as AttachRefusal).message.length > 0
  );
}

/** What the author said of a file they attach (#78). */
export interface AttachAttributes {
  /** The name to keep it under; the host may answer another, when that one is taken. */
  readonly name: string;
  readonly description: string;
}

export interface AttachmentRequest {
  readonly name: string;
  /** The width and height the embed declared, in CSS pixels, or `null`. */
  readonly width: number | null;
  readonly height: number | null;
  /**
   * The width it declared as a share of the width the note is read at, from 1 to 100, which it is
   * drawn at most, or `null` (#108). `width` and `height` are then `null`.
   */
  readonly percent: number | null;
  /**
   * What a Markdown image that names the file wrote before its pipe, `![description](name)`
   * (`SPEC.md` §5.8, #104): an image's `alt`, a card's text. Absent for an embed, and empty when
   * the image wrote none, when the file's own description is the one to draw.
   */
  readonly description?: string;
  /** The title that image wrote after its destination, `![…](name "title")`, when it wrote one. */
  readonly title?: string;
}

/** A link to draw through the host's router. */
export interface LinkRequest {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Every member of the contract, by name. The `satisfies` is what makes it complete: a member added
 * to `NoteHost` and not listed here does not compile.
 */
export const HOST_KEYS = Object.keys({
  resolve: 1,
  reaches: 1,
  choose: 1,
  targetAddress: 1,
  navigate: 1,
  loadNote: 1,
  queryTable: 1,
  writable: 1,
  onToggleTask: 1,
  keeps: 1,
  suggest: 1,
  attach: 1,
  files: 1,
  fileOf: 1,
  renderAttachment: 1,
  renderLink: 1,
  strings: 1,
  theme: 1,
  scheme: 1,
  remoteNotice: 1,
} satisfies Record<keyof NoteHost, 1>) as (keyof NoteHost)[];

/** The host contract with every default applied. */
export interface ResolvedHost {
  readonly resolve: (name: string) => string | null;
  readonly reaches: (name: string) => number;
  readonly choose: ((name: string) => Promise<LinkChoices>) | null;
  readonly targetAddress: (name: string) => string | null;
  readonly navigate: (address: string) => void;
  readonly remoteNotice: boolean;
  readonly loadNote: ((name: string) => Promise<EmbeddedNote | null>) | null;
  readonly queryTable: ((request: TableRequest) => Promise<TablePage | null>) | null;
  readonly keeps: (name: string) => boolean;
  readonly suggest: ((query: string) => readonly string[] | PromiseLike<readonly string[]>) | null;
  readonly attach: ((file: File, attributes: AttachAttributes, progress: (report: AttachProgress) => void) => string | PromiseLike<string>) | null;
  readonly files: (() => readonly KeptFileEntry[] | PromiseLike<readonly KeptFileEntry[]>) | null;
  readonly fileOf: ((name: string) => KeptFile | null | PromiseLike<KeptFile | null>) | null;
  readonly renderAttachment: ((file: AttachmentRequest) => ReactNode) | null;
  readonly renderLink: (link: LinkRequest) => ReactNode;
  readonly strings: NoteStrings;
  /** The theme the note is drawn in. */
  readonly theme: Theme;
  /** The scheme it is drawn in. */
  readonly scheme: Scheme;
}

const nothing = (): null => null;
const never = (): false => false;
const plainLink = ({ href, className, children }: LinkRequest): ReactNode => (
  <a className={className} href={href}>
    {children}
  </a>
);

function themeOf(host: NoteHost): { theme: Theme; scheme: Scheme } {
  const given = host.theme ?? DEFAULT_THEME;
  const theme = typeof given === 'string' ? DEFAULT_THEME : given;
  const asked = host.scheme ?? (typeof given === 'string' ? given : 'light');
  return { theme, scheme: schemeOf(theme, asked) };
}

export function resolveHost(host: NoteHost): ResolvedHost {
  const resolve = host.resolve ?? nothing;
  return {
    resolve,
    reaches: host.reaches ?? ((name) => (resolve(name) === null ? 0 : 1)),
    choose: host.choose ?? null,
    targetAddress: host.targetAddress ?? nothing,
    navigate: host.navigate ?? ((address) => window.location.assign(address)),
    remoteNotice: host.remoteNotice ?? true,
    loadNote: host.loadNote ?? null,
    queryTable: host.queryTable ?? null,
    keeps: host.keeps ?? never,
    suggest: host.suggest ?? null,
    attach: host.attach ?? null,
    files: host.files ?? null,
    fileOf: host.fileOf ?? null,
    renderAttachment: host.renderAttachment ?? null,
    renderLink: host.renderLink ?? plainLink,
    strings: withDefaults(host.strings),
    ...themeOf(host),
  };
}

const HostContext = createContext<ResolvedHost>(resolveHost({}));

export const HostProvider = HostContext.Provider;

/** The host the note is drawn under, read by every part of the surface. */
export function useHost(): ResolvedHost {
  return useContext(HostContext);
}
