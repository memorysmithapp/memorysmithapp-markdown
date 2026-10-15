import { createContext, useContext, type ReactNode } from 'react';
import { withDefaults, type NoteStrings, type NoteStringsInput } from './strings.js';
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
   * pending. Without it, every embed of a note is pending. The package never fetches.
   */
  readonly loadNote?: (name: string) => Promise<EmbeddedNote | null>;
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
   * Keeps a file the author attached in edit mode — from the toolbar, pasted or dropped — in the
   * notebook, and answers the name it is kept under, which the editor embeds as `![[name]]` (#75).
   * The package never stores a file. Without it, the editor offers no attaching.
   */
  readonly attach?: (file: File) => string | PromiseLike<string>;
  /**
   * Draws a file the notebook keeps where a note embeds it: an image, audio, video, or a card. The
   * dimensions are the ones the embed declared, in CSS pixels, or `null`.
   */
  readonly renderAttachment?: (file: AttachmentRequest) => ReactNode;
  /** Draws a link to an internal address, through the host's router. */
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
export interface AttachmentRequest {
  readonly name: string;
  readonly width: number | null;
  readonly height: number | null;
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
  writable: 1,
  onToggleTask: 1,
  keeps: 1,
  suggest: 1,
  attach: 1,
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
  readonly keeps: (name: string) => boolean;
  readonly suggest: ((query: string) => readonly string[] | PromiseLike<readonly string[]>) | null;
  readonly attach: ((file: File) => string | PromiseLike<string>) | null;
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
    keeps: host.keeps ?? never,
    suggest: host.suggest ?? null,
    attach: host.attach ?? null,
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
