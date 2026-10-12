import type { AnchorHTMLAttributes, ImgHTMLAttributes, MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { followable } from './address.js';
import { useHost } from './host.js';
import { readImageAlt } from './image-dimensions.js';
import { toUnixNewlines } from './markdown.js';

/**
 * One run of a note, parsed and drawn: the pipeline of MemorySmith's reading page.
 *
 * It draws the text it is given and nothing else. What a note becomes before this — its
 * frontmatter cut, its embeds split out, its wikilinks resolved — is `NoteBody`'s.
 */
export interface MarkdownProps {
  readonly children: string;
}

/**
 * What react-markdown hands a component beside the attributes: the hast
 * element it came from. It is not an attribute, and spread onto the element
 * it reached the page as `node="[object Object]"` on every link, image and
 * code span.
 */
type WithNode<T> = T & { node?: unknown };

/**
 * An image, with the dimensions the specification puts in its alt text
 * (§3.14). What precedes the pipe is the description and is never dropped;
 * what follows it is width, or width and height, in CSS pixels, and never
 * appears as text. A value that is neither stays part of the description,
 * because deleting an accessibility label is the worse failure.
 */
function MarkdownImage({ alt, node: _node, ...rest }: WithNode<ImgHTMLAttributes<HTMLImageElement>>) {
  const read = readImageAlt(alt ?? '');
  return (
    <img
      {...rest}
      alt={read.description}
      {...(read.width === null ? {} : { width: read.width })}
      {...(read.height === null ? {} : { height: read.height })}
    />
  );
}

/**
 * A link to a place in the same note: a footnote and its way back (§7.12),
 * or an anchor an author wrote.
 *
 * It must not open the whole page in another tab, and a bare hash is not
 * enough either: a host may scroll the note inside a pane of its own rather
 * than the window, and an embedded note renders the same identifiers a second
 * time. So the target is looked up inside the note the link was drawn in, and
 * brought into view in whatever scrolls it; the address of the page does not
 * change, because nothing was navigated.
 */
function InPageAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    const id = decodeURIComponent(href.slice(1));
    const note = event.currentTarget.closest('.markdown');
    const target = note?.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'center' });
  };
  return (
    <a href={href} onClick={follow} {...rest}>
      {children}
    </a>
  );
}

function MarkdownAnchor({ href, children, node: _node, ...rest }: WithNode<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  const host = useHost();
  // Refused by `followable`: the text stays on the page and stops being
  // something to click. An author sees they got nothing, which is the same
  // answer the specification gives for a notation it does not implement.
  if (!href) {
    return (
      <span className="link-refused" title={host.strings.refusedLink}>
        {children}
      </span>
    );
  }
  // An address of the host's own: its router draws it.
  if (href.startsWith('/')) return <>{host.renderLink({ href, className: 'wikilink', children })}</>;
  if (href.startsWith('#')) {
    return (
      <InPageAnchor href={href} {...rest}>
        {children}
      </InPageAnchor>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

export function Markdown({ children }: MarkdownProps) {
  const text = toUnixNewlines(children);
  const { strings } = useHost();

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[
          /**
           * `singleTilde: false` is a decision and not a default.
           *
           * GFM specifies strikethrough as `~~x~~`; GitHub also accepts a
           * single tilde, outside its own specification. Here that extension
           * actively misrenders a notation the specification leaves out:
           * somebody writing `H~2~O` for a subscript would get `H` struck-out
           * `2` `O`, which is a worse answer than nothing. With it off the
           * characters stay on the page, and the author can see they got what
           * the specification says they get, which is nothing.
           */
          [remarkGfm, { singleTilde: false }],
        ]}
        // Raw HTML is NOT enabled, and its absence is the point: no
        // `rehype-raw` is loaded, so a note carrying `<script>` is text. It is
        // a security boundary rather than a rendering preference, because a
        // notebook is written by several people and by agents (§7.9).
        // Footnotes (§7.12): the words around them are the reader's, and the
        // label heads the notes gathered at the end of the note, where a
        // reader sees it — GFM hides it, and a stylesheet that hides nothing
        // shows it as a visible heading, so it is in the reader's language.
        remarkRehypeOptions={{
          footnoteLabel: strings.footnotes,
          footnoteLabelProperties: { className: ['footnotes-label'] },
          footnoteBackLabel: (referenceIndex: number) => strings.footnoteBack(referenceIndex + 1),
        }}
        // Which addresses this surface will follow, and the reason the stock
        // filter is not doing it, are in `address.ts`.
        urlTransform={followable}
        components={{
          a: MarkdownAnchor,
          img: MarkdownImage,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
