import { createContext, useContext, type ReactNode } from 'react';
import { withDefaults, type NoteStrings } from './strings.js';

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
  /** Whether the notebook keeps a file under that name. Only an embed reaches a file. */
  readonly keeps?: (name: string) => boolean;
  /**
   * Draws a file the notebook keeps where a note embeds it: an image, audio, video, or a card. The
   * dimensions are the ones the embed declared, in CSS pixels, or `null`.
   */
  readonly renderAttachment?: (file: AttachmentRequest) => ReactNode;
  /** Draws a link to an internal address, through the host's router. */
  readonly renderLink?: (link: LinkRequest) => ReactNode;
  /** The words the page shows, in the reader's language; each one left out is MemorySmith's English. */
  readonly strings?: Partial<NoteStrings>;
  /** The theme the host draws in, which picks the theme of a Mermaid diagram. Defaults to `light`. */
  readonly theme?: 'light' | 'dark';
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

/** A file to draw: its name, and the dimensions the embed declared. */
export interface AttachmentRequest {
  readonly name: string;
  readonly width: number | null;
  readonly height: number | null;
}

/** A link to draw through the host's router. */
export interface LinkRequest {
  readonly href: string;
  readonly className: string;
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
  keeps: 1,
  renderAttachment: 1,
  renderLink: 1,
  strings: 1,
  theme: 1,
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
  readonly keeps: (name: string) => boolean;
  readonly renderAttachment: ((file: AttachmentRequest) => ReactNode) | null;
  readonly renderLink: (link: LinkRequest) => ReactNode;
  readonly strings: NoteStrings;
  readonly theme: 'light' | 'dark';
}

const nothing = (): null => null;
const never = (): false => false;
const plainLink = ({ href, className, children }: LinkRequest): ReactNode => (
  <a className={className} href={href}>
    {children}
  </a>
);

export function resolveHost(host: NoteHost): ResolvedHost {
  const resolve = host.resolve ?? nothing;
  return {
    resolve,
    reaches: host.reaches ?? ((name) => (resolve(name) === null ? 0 : 1)),
    choose: host.choose ?? null,
    targetAddress: host.targetAddress ?? nothing,
    navigate: host.navigate ?? ((address) => window.location.assign(address)),
    remoteNotice: host.remoteNotice ?? true,
    keeps: host.keeps ?? never,
    renderAttachment: host.renderAttachment ?? null,
    renderLink: host.renderLink ?? plainLink,
    strings: withDefaults(host.strings),
    theme: host.theme ?? 'light',
  };
}

const HostContext = createContext<ResolvedHost>(resolveHost({}));

export const HostProvider = HostContext.Provider;

/** The host the note is drawn under, read by every part of the surface. */
export function useHost(): ResolvedHost {
  return useContext(HostContext);
}
