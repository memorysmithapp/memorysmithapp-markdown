import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { useRef, type AnchorHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes, type MouseEvent } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { followable } from './address.js';
import { CopyButton } from './CopyButton.js';
import { highlightLanguage, highlightTree } from './highlight.js';
import { useHost } from './host.js';
import { readDimensions, readImageAlt } from './image-dimensions.js';
import { choiceTargetOf, LinkChoice } from './LinkChoice.js';
import { toUnixNewlines } from './markdown.js';
import { MermaidDiagram } from './MermaidDiagram.js';
import { remarkCallouts } from './remark-callouts.js';
import { remarkBlockIds, remarkComments, remarkHighlight, remarkMathDollarRule } from './remark-ring.js';

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

/**
 * A file the notebook keeps, where a note embedded it. The host draws it by its
 * type — an image, audio, video, or a card — and a name the notebook keeps
 * nothing under is reported the way a pending link is: a notebook is read most
 * while it is being written (§5.8).
 */
function Attachment({ name, width, height }: { name: string; width: number | null; height: number | null }) {
  const host = useHost();
  if (!host.keeps(name)) {
    return (
      <span className="attachment-missing" title={host.strings.attachmentMissing}>
        {name}
      </span>
    );
  }
  if (!host.renderAttachment) return <span className="attachment-loading">{name}</span>;
  return <>{host.renderAttachment({ name, width, height })}</>;
}

function MarkdownAnchor({ href, children, node: _node, ...rest }: WithNode<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  const host = useHost();
  if (href?.startsWith('attachment:')) {
    /**
     * The address carries the dimension the pipe declared, after the encoded
     * name, where nothing else can be (§3.14).
     *
     * **Decoded before it is split**, because the parser percent-encodes what
     * it does not have to leave alone: the separator arrives as `%7C` and
     * looking for `|` found nothing, which sent the whole string — dimension
     * included — to be looked up as the name of a file. A name carrying a
     * pipe is no name anyway (§5.3), so the last one is the separator or
     * there is none.
     */
    const address = decodeURIComponent(href.slice('attachment:'.length));
    const at = address.lastIndexOf('|');
    const measured = at === -1 ? null : readDimensions(address.slice(at + 1));
    const name = measured ? address.slice(0, at) : address;
    return <Attachment name={name} width={measured?.width ?? null} height={measured?.height ?? null} />;
  }
  if (href?.startsWith('pending:')) {
    return (
      <span className="wikilink-pending" title={host.strings.pendingLink}>
        {children}
      </span>
    );
  }
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
  // A target no single note answers by name opens its choice in place.
  const choice = choiceTargetOf(href);
  if (choice !== null) return <LinkChoice target={choice}>{children}</LinkChoice>;
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

/**
 * A code span, a fenced block, and the one info string with a rendering rule.
 *
 * The order of the three branches is the contract. `mermaid` is checked first
 * and reaches `MermaidDiagram` with its source untouched, because it is the
 * only info string the specification attaches a rendering rule to (§7.2) and a
 * highlighter in front of that check would swallow a diagram. A language the
 * highlighter carries is tokenised. Everything else — a code span, a fence
 * with no info string, a language nobody registered — renders exactly as it
 * did before highlighting existed, which is the pattern the specification sets
 * for the diagram it cannot draw and the formula it cannot typeset: show the
 * source, never hide it.
 *
 * The tokens arrive as ELEMENTS. `refractor` produces a hast tree and
 * `toJsxRuntime` builds React out of it, so no note-derived markup is ever
 * parsed as HTML — the boundary §7.9 draws, held at the one place a
 * highlighter would otherwise breach it.
 */
function MarkdownCode({ className, children, node: _node, ...rest }: WithNode<HTMLAttributes<HTMLElement>>) {
  const { theme } = useHost();
  if (className?.includes('language-mermaid')) {
    return <MermaidDiagram code={String(children).trim()} theme={theme} />;
  }

  const language = highlightLanguage(className);
  if (language !== null) {
    // The source is read and never rewritten: what is on the page is the
    // bytes, split into spans. React-markdown hands the children of a fence as
    // a single string ending in the newline before the closing fence.
    const code = String(children).replace(/\n$/, '');
    return (
      <code className={className} {...rest}>
        {toJsxRuntime(highlightTree(code, language), { Fragment, jsx, jsxs })}
      </code>
    );
  }

  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

/**
 * A fenced block in a frame of its own, with the verb that carries it
 * somewhere else. The frame is not the `pre`: the `pre` scrolls and never
 * wraps, since a wrapped line breaks indentation that carries meaning, and the
 * button has to stay in its corner while the content scrolls under it.
 *
 * What is copied is the `textContent` of the code, which is the bytes as
 * typed because the highlighter's tokens arrive as elements, less the newline
 * before the closing fence.
 *
 * A diagram is not code on the page: its fence is left bare, with no frame and
 * nothing to copy.
 */
function MarkdownPre({ children, node, ...rest }: WithNode<HTMLAttributes<HTMLPreElement>>) {
  const { strings } = useHost();
  const ref = useRef<HTMLPreElement>(null);
  const code = (node as HastElement | undefined)?.children?.find((child) => child.tagName === 'code');
  const classes = code?.properties?.['className'];
  if (Array.isArray(classes) && classes.includes('language-mermaid')) {
    return <pre {...rest}>{children}</pre>;
  }

  return (
    <div className="code-block">
      <pre ref={ref} {...rest}>
        {children}
      </pre>
      <CopyButton
        className="code-copy"
        label={strings.copy}
        done={strings.copied}
        text={() => (ref.current?.querySelector('code')?.textContent ?? '').replace(/\n$/, '')}
      />
    </div>
  );
}

/** The hast element react-markdown hands a component, as much as is used. */
interface HastElement {
  readonly tagName?: string;
  readonly properties?: Record<string, unknown>;
  readonly children?: readonly HastElement[];
  readonly position?: { readonly start?: { readonly offset?: number } };
}

export function Markdown({ children }: MarkdownProps) {
  const text = toUnixNewlines(children);
  const { strings } = useHost();
  const calloutTitle = (kind: string): string | undefined =>
    Object.hasOwn(strings.callouts, kind) ? strings.callouts[kind] : undefined;

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
          [remarkCallouts, { titleOf: calloutTitle }],
          remarkHighlight,
          remarkComments,
          remarkBlockIds,
          remarkMath,
          // After remark-math, and it gives back what was never a formula.
          remarkMathDollarRule,
        ]}
        // Raw HTML is NOT enabled, and its absence is the point: no
        // `rehype-raw` is loaded, so a note carrying `<script>` is text. It is
        // a security boundary rather than a rendering preference, because a
        // notebook is written by several people and by agents (§7.9).
        // A formula KaTeX cannot typeset shows its source, never an error (§7.8).
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
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
          code: MarkdownCode,
          pre: MarkdownPre,
          img: MarkdownImage,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
