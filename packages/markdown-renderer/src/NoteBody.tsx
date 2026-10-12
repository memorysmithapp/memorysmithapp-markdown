import { useMemo } from 'react';
import { HOST_KEYS, HostProvider, resolveHost, type NoteHost, type ResolvedHost } from './host.js';
import { CHOICE_SCHEME } from './LinkChoice.js';
import { Markdown } from './Markdown.js';
import { bodyStart, remoteImageHosts, resolveWikilinks } from './markdown.js';

export interface NoteBodyProps extends NoteHost {
  /**
   * The note as the host keeps it, frontmatter included. It is drawn from these bytes and never
   * rewritten; the frontmatter is not drawn, because a host shows it as properties.
   */
  readonly markdown: string;
}

/**
 * Where a wikilink goes: the note when exactly one answers it, and the choice
 * otherwise — several notes, or none, which is pending and still asks — when
 * the host can say which notes a target may lead to. With no such host, a
 * target no single note answers is pending.
 */
export function wikilinkAddress(host: ResolvedHost, name: string): string | null {
  const address = host.resolve(name);
  if (address !== null) return address;
  return host.choose ? `${CHOICE_SCHEME}${encodeURIComponent(name)}` : null;
}

/**
 * The body of a note, drawn as MemorySmith's reading page draws it.
 *
 * It renders inside `.markdown`, so the stylesheet of the package applies, and asks the host for
 * every piece of notebook data through the props of `NoteHost`.
 */
export function NoteBody({ markdown, ...host }: NoteBodyProps) {
  const resolved = useMemo(
    () => resolveHost(host),
    // Every member of the contract, so a host that passes the same functions keeps the same host.
    HOST_KEYS.map((key) => host[key]),
  );
  // Frontmatter is shown as properties, not as prose, so the reading surface
  // starts after it.
  const body = markdown.slice(bodyStart(markdown));
  // One resolver for every surface: one note is a link, several are the
  // choice, and none is pending and still asks.
  const rendered = resolveWikilinks(body, (name) => wikilinkAddress(resolved, name), resolved.keeps);

  /**
   * Whom this note asked the browser to talk to (§7.10).
   *
   * The specification admits three answers about a remote image and forbids
   * only silence: never fetching, fetching on the reader's action, or fetching
   * and saying so. This surface fetches — the destination reaches `<img src>`,
   * and React even preloads it — so this line is the half that says so, and
   * the reason it has to exist is that this is the one of the three answers a
   * person cannot work out from the page.
   *
   * It appears only where it is true, naming the hosts, because a notice on
   * every note would be a thing to scroll past rather than a thing to read.
   */
  const hosts = resolved.remoteNotice ? remoteImageHosts(body) : [];

  return (
    <HostProvider value={resolved}>
      <div className="markdown">
        <Markdown>{rendered}</Markdown>
        {hosts.length > 0 && <p className="remote-notice">{resolved.strings.remoteImages(hosts)}</p>}
      </div>
    </HostProvider>
  );
}
