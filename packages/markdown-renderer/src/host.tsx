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

/** The host contract with every default applied. */
export interface ResolvedHost {
  readonly resolve: (name: string) => string | null;
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
  return {
    resolve: host.resolve ?? nothing,
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
