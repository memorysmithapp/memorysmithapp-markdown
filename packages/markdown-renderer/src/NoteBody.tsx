import { useMemo } from 'react';
import { HostProvider, resolveHost, type NoteHost } from './host.js';
import { Markdown } from './Markdown.js';
import { bodyStart } from './markdown.js';

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
  const resolved = useMemo(() => resolveHost(host), [host.resolve, host.keeps, host.renderAttachment, host.renderLink, host.strings]);
  // Frontmatter is shown as properties, not as prose, so the reading surface
  // starts after it.
  const body = markdown.slice(bodyStart(markdown));

  return (
    <HostProvider value={resolved}>
      <div className="markdown">
        <Markdown>{body}</Markdown>
      </div>
    </HostProvider>
  );
}
