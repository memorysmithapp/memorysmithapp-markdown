import { useMemo } from 'react';
import { HOST_KEYS, HostProvider, resolveHost, type NoteHost } from './host.js';
import { Markdown } from './Markdown.js';
import { bodyStart, remoteImageHosts, resolveWikilinks } from './markdown.js';
import { Transclusion } from './Transclusion.js';
import { splitEmbeds } from './transclusion.js';
import { wikilinkAddress } from './wikilink-address.js';

export interface NoteBodyProps extends NoteHost {
  /**
   * The note as the host keeps it, frontmatter included. It is drawn from these bytes and never
   * rewritten; the frontmatter is not drawn, because a host shows it as properties.
   */
  readonly markdown: string;
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

  // The body is cut into runs of text and the embeds between them; each run
  // is parsed on its own, as on MemorySmith's reading page.
  const segments = splitEmbeds(body, resolved.keeps).map((segment) =>
    segment.kind === 'text'
      ? {
          ...segment,
          // One resolver for every run: one note is a link, several are the
          // choice, and none is pending and still asks.
          rendered: resolveWikilinks(segment.text, (name) => wikilinkAddress(resolved, name), resolved.keeps),
        }
      : segment,
  );

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
        {segments.map((segment, index) =>
          'rendered' in segment ? (
            <Markdown key={index}>{segment.rendered}</Markdown>
          ) : (
            <Transclusion key={index} target={segment.target} anchor={segment.anchor} />
          ),
        )}
        {hosts.length > 0 && <p className="remote-notice">{resolved.strings.remoteImages(hosts)}</p>}
      </div>
    </HostProvider>
  );
}
