import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import {
  isValidElement,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import { followable } from './address.js';
import { CopyButton } from './CopyButton.js';
import { fileAddress, fileKind, formatBytes, opensInBrowser, rendersAs } from './file-types.js';
import { highlightLanguage, highlightTree, languageToLoad, loadGrammar } from './highlight.js';
import { useHost, type KeptFile } from './host.js';
import { readDimensions, readImageAlt } from './image-dimensions.js';
import { choiceTargetOf, LinkChoice } from './LinkChoice.js';
import { toUnixNewlines } from './markdown.js';
import { MermaidDiagram } from './MermaidDiagram.js';
import { readingPlugins } from './reading.js';
import { CLOBBER_PREFIX, rehypeFootnoteRun, rehypeFootnoteSection, type FootnoteRef } from './footnotes.js';
import { drawSlot, headings, InBlock, MarkdownBlockquote, MarkdownDiv, MarkdownSection, MarkdownTable, useInBlock, useSlot } from './slots.js';
import type { TaskSave } from './task-saves.js';
import { ordinalAt } from './tasklist.js';

/**
 * One run of a note, parsed and drawn: the pipeline of MemorySmith's reading page.
 *
 * It draws the text it is given and nothing else. What a note becomes before this — its
 * frontmatter cut, its embeds split out, its wikilinks resolved — is `NoteBody`'s.
 */
export interface MarkdownProps {
  readonly children: string;
  /**
   * The text the ordinal of a task box is counted over. It has to be the text
   * the PARSER saw, because the offsets come from it — not the bytes a write
   * sends back, which are the original ones. Keeping the two aligned is the
   * caller's job, and `NoteBody` does it by refusing to enable the boxes when
   * the two disagree on how many there are.
   */
  readonly source?: string;
  /** A box of this run was ticked: its ordinal in the run, and the state it is being set to. */
  readonly onToggleTask?: (ordinal: number, checked: boolean) => void;
  /** Where the save of a box of this run stands, by its ordinal in the run (`task-saves.ts`). */
  readonly taskSave?: (ordinal: number) => TaskSave | null;
  readonly writable?: boolean;
  /**
   * How this run takes part in the footnotes of a note drawn in several runs
   * (`footnotes.ts`): the number and id of each of its references, or
   * `'section'` for the pass that draws the note's one section.
   */
  readonly footnotes?: { readonly refs: readonly FootnoteRef[] } | 'section';
}

type LiProps = HTMLAttributes<HTMLLIElement> & { node?: unknown };

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
    // The note is the root `NoteBody` draws, since a footnote's way back may
    // cross runs; inside an embed it is the embed's own run. A match inside
    // an embed answers only a link inside that same embed.
    const link = event.currentTarget;
    const embed = link.closest('.embed');
    const note = embed ? link.closest('.markdown') : (link.closest('.markdown[data-theme]') ?? link.closest('.markdown'));
    const target = [...(note?.querySelectorAll(`[id="${CSS.escape(id)}"]`) ?? [])].find(
      (candidate) => candidate.closest('.embed') === embed,
    );
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
 * A file the notebook keeps, where a note embedded it, drawn by its type — an
 * image, audio, video, or a card — by the host's `renderAttachment`, else from
 * what its `fileOf` says (#77). A name the notebook keeps nothing under is
 * reported the way a pending link is: a notebook is read most while it is
 * being written (§5.8).
 */
function Attachment({ name, width, height }: { name: string; width: number | null; height: number | null }) {
  const host = useHost();
  if (!host.keeps(name)) return <AttachmentMissing name={name} />;
  if (host.renderAttachment) return <>{host.renderAttachment({ name, width, height })}</>;
  if (!host.fileOf) return <span className="attachment-loading">{name}</span>;
  return <KeptAttachment name={name} width={width} height={height} />;
}

function AttachmentMissing({ name }: { name: string }) {
  const host = useHost();
  return (
    <span className="attachment-missing" title={host.strings.attachmentMissing}>
      {name}
    </span>
  );
}

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * What the host's `fileOf` says of a name: the file, `null` for none, or `undefined` while a
 * promise is on its way. An answer given at once is drawn at once, a server's render included.
 */
function useKeptFile(name: string): KeptFile | null | undefined {
  const { fileOf } = useHost();
  const answer = useMemo(() => fileOf?.(name) ?? null, [fileOf, name]);
  const [settled, setSettled] = useState<{ answer: unknown; file: KeptFile | null } | null>(null);
  useEffect(() => {
    if (!isThenable<KeptFile | null>(answer)) return;
    let live = true;
    answer.then(
      (file) => live && setSettled({ answer, file }),
      () => live && setSettled({ answer, file: null }),
    );
    return () => {
      live = false;
    };
  }, [answer]);
  if (!isThenable(answer)) return answer;
  return settled?.answer === answer ? settled.file : undefined;
}

/**
 * Opens a file kept as `data:` in a new tab as the `blob:` of its bytes: a browser navigates no tab
 * to a `data:` address, so the link alone would do nothing (#79). Any other address is the link's.
 */
function openInTab(event: MouseEvent<HTMLAnchorElement>, url: string): void {
  if (!/^data:/i.test(url.trim()) || typeof URL.createObjectURL !== 'function') return;
  event.preventDefault();
  const tab = window.open('', '_blank');
  void fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      const address = URL.createObjectURL(blob);
      if (tab) tab.location.href = address;
      else window.open(address, '_blank', 'noreferrer');
      // The tab has the bytes once it loaded them; the address is let go after a while.
      setTimeout(() => URL.revokeObjectURL(address), 60_000);
    })
    .catch(() => tab?.close());
}

/**
 * A kept file drawn as MemorySmith's `Attachment` draws it (*observed* at `4b67c7e`): an image with
 * the dimensions the embed declared, an audio or a video player, and everything else — the PDF
 * included — a card with what it is, its size, and the ways out of the page: Open only for what a
 * browser shows, Download always. A theme may draw it through the `attachment` slot.
 */
function KeptAttachment({ name, width, height }: { name: string; width: number | null; height: number | null }) {
  const host = useHost();
  const slot = useSlot('attachment');
  const described = useKeptFile(name);
  if (described === undefined) return <span className="attachment-loading">{name}</span>;
  const url = described ? fileAddress(described.url) : '';
  if (!described || url === '') return <AttachmentMissing name={name} />;
  const file: KeptFile = { ...described, url, downloadUrl: fileAddress(described.downloadUrl ?? described.url) || url };
  const shape = rendersAs(file.mimeType);
  const kind = fileKind(file.mimeType, host.strings.fileKinds);
  const size = formatBytes(file.bytes, host.strings.locale);
  const opens = opensInBrowser(file.mimeType);
  if (slot) return <>{drawSlot(slot, { name, file, shape, kind, size, opens, width, height })}</>;
  // The attributes reserve the box before the bytes arrive; a height is a style too, since the
  // surface gives an image `height: auto`, which two numbers overrule (§3.14).
  const sized = {
    ...(width === null ? {} : { width }),
    ...(height === null ? {} : { height, style: { height: `${height}px` } }),
  };
  if (shape === 'image') return <img className="attachment-image" src={file.url} alt={file.description || name} {...sized} />;
  if (shape === 'audio') return <audio className="attachment-player" controls src={file.url} />;
  if (shape === 'video') return <video className="attachment-player" controls src={file.url} {...sized} />;
  return (
    <span className="attachment-card">
      <span className="attachment-card-body">
        <span className="attachment-card-name">{name}</span>
        <span className="attachment-card-note" title={file.mimeType}>
          {kind} · {size}
        </span>
        {file.description && <span className="attachment-card-note">{file.description}</span>}
      </span>
      <span className="attachment-card-actions">
        {opens && (
          <a href={file.url} target="_blank" rel="noreferrer" onClick={(event) => openInTab(event, file.url)}>
            {host.strings.attachmentOpen}
          </a>
        )}
        <a href={file.downloadUrl} download={name}>
          {host.strings.attachmentDownload}
        </a>
      </span>
    </span>
  );
}

export function MarkdownAnchor({ href, children, node: _node, ...rest }: WithNode<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  const host = useHost();
  const wikilinkSlot = useSlot('wikilink');
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
    const pending = (label: ReactNode) => (
      <span className="wikilink-pending" title={host.strings.pendingLink}>
        {label}
      </span>
    );
    return wikilinkSlot ? drawSlot(wikilinkSlot, { pending: true, children, link: pending }) : pending(children);
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
  if (choice !== null) {
    const link = (label: ReactNode) => <LinkChoice target={choice}>{label}</LinkChoice>;
    if (!wikilinkSlot) return link(children);
    return drawSlot(wikilinkSlot, { pending: host.reaches(choice) === 0, children, link });
  }
  // An address of the host's own: its router draws it.
  if (href.startsWith('/')) {
    const link = (label: ReactNode) => <>{host.renderLink({ href, className: 'wikilink', children: label })}</>;
    return wikilinkSlot ? drawSlot(wikilinkSlot, { pending: false, children, link }) : link(children);
  }
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
  const { scheme } = useHost();
  const inBlock = useInBlock();
  const inlineSlot = useSlot('inlineCode');
  // A grammar not among the fifteen is fetched the first time a fence names it, and the block
  // drawn again highlighted once it is there (#84); until then it is plain code.
  const toLoad = inBlock ? languageToLoad(className) : null;
  const [, arrived] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!toLoad) return;
    let live = true;
    void loadGrammar(toLoad).then((loaded) => live && loaded && arrived());
    return () => {
      live = false;
    };
  }, [toLoad]);
  if (className?.includes('language-mermaid')) {
    return <MermaidDiagram code={String(children ?? '').trim()} scheme={scheme} />;
  }
  if (!inBlock && inlineSlot) return drawSlot(inlineSlot, { children });

  const language = highlightLanguage(className);
  if (language !== null) {
    // The source is read and never rewritten: what is on the page is the
    // bytes, split into spans. React-markdown hands the children of a fence as
    // a single string ending in the newline before the closing fence.
    // An empty fence has no children at all, and is no code rather than the word `undefined`.
    const code = String(children ?? '').replace(/\n$/, '');
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
  const slot = useSlot('codeBlock');
  const code = (node as HastElement | undefined)?.children?.find((child) => child.tagName === 'code');
  const classes = code?.properties?.['className'];
  if (Array.isArray(classes) && classes.includes('language-mermaid')) {
    return <pre {...rest}>{children}</pre>;
  }

  // The bytes as typed: the text of the fence, less the newline before its closing line.
  const typed = textOf(code).replace(/\n$/, '');
  const copy = <CopyButton className="code-copy" label={strings.copy} done={strings.copied} text={() => typed} />;
  if (slot) {
    const language = Array.isArray(classes)
      ? (classes.map(String).find((name) => name.startsWith('language-'))?.slice('language-'.length) ?? null)
      : null;
    return <InBlock.Provider value>{drawSlot(slot, { language, code: typed, children, copy })}</InBlock.Provider>;
  }
  return (
    <div className="code-block">
      <InBlock.Provider value>
        <pre {...rest}>{children}</pre>
      </InBlock.Provider>
      {copy}
    </div>
  );
}

/** The text of a hast element, which for a fence is the code as typed. */
function textOf(node: HastElement | undefined): string {
  if (!node) return '';
  const text = (node as { value?: unknown }).value;
  if (typeof text === 'string') return text;
  return (node.children ?? []).map(textOf).join('');
}

/** The hast element react-markdown hands a component, as much as is used. */
interface HastElement {
  readonly tagName?: string;
  readonly properties?: Record<string, unknown>;
  readonly children?: readonly HastElement[];
  readonly position?: { readonly start?: { readonly offset?: number } };
}

/**
 * Whether this list item is a task box, and how it is ticked.
 *
 * The state is read from the child `input` that GFM produces, and NOT from a
 * `checked` on the item itself: react-markdown 9 hands a component the **hast**
 * element, which carries no such property. Reading it there returned
 * `undefined` for every item, which once sent every task box of MemorySmith
 * down the plain branch and onto the screen as GFM's own disabled checkbox —
 * no handler, no click, on any note.
 */
function taskState(node: HastElement | undefined): boolean | null {
  const box = node?.children?.find((child) => child.tagName === 'input');
  const checked = box?.properties?.['checked'];
  return typeof checked === 'boolean' ? checked : null;
}

/**
 * A list item that carries a task box. The ordinal comes from the position the
 * parser reports, mapped back to the n-th task of the source, which is what
 * lets a click become a one-character change in the original text — made by
 * the host, never by the package.
 */
function TaskItem({
  node,
  children,
  className,
  source,
  toggleTask,
  taskSave,
  writable,
  ...rest
}: LiProps & {
  source: string;
  toggleTask: ((ordinal: number, checked: boolean) => void) | undefined;
  taskSave: ((ordinal: number) => TaskSave | null) | undefined;
  writable: boolean;
}) {
  const boxSlot = useSlot('taskBox');
  const { strings } = useHost();
  const element = node as HastElement | undefined;
  const checked = taskState(element);
  if (checked === null) {
    return (
      <li className={className} {...rest}>
        {children}
      </li>
    );
  }

  const offset = element?.position?.start?.offset;
  const ordinal = offset === undefined ? -1 : ordinalAt(source, offset);
  // While the host saves a tick the box shows the state being written and answers no click; once a
  // save failed it is back to what its source holds, which is `checked`.
  const save = ordinal >= 0 ? (taskSave?.(ordinal) ?? null) : null;
  const pending = save?.kind === 'pending';
  const failed = save?.kind === 'failed';
  const shown = save?.kind === 'pending' ? save.checked : checked;
  const enabled = writable && toggleTask !== undefined && ordinal >= 0 && !pending;
  const toggle = (): void => {
    if (enabled) toggleTask(ordinal, !checked);
  };

  return (
    // Our class comes LAST, because the one react-markdown passes in is on
    // `className` and spreading it after would silently take the item back.
    <li
      {...rest}
      className={`${className ?? ''} task-item`.trim()}
      data-save={pending ? 'pending' : failed ? 'failed' : undefined}
      aria-busy={pending || undefined}
    >
      {boxSlot ? (
        drawSlot(boxSlot, { checked: shown, enabled, toggle, pending, failed })
      ) : (
        <input type="checkbox" checked={shown} disabled={!enabled} onChange={toggle} />
      )}
      {/* The box GFM already rendered is dropped: it is `disabled`, it answers
          to nothing, and two boxes in one item is worse than none. */}
      {dropBox(children)}
      {/* The lock and the notice are said once, by the note's live region; here they are only seen. */}
      {pending && (
        <span className="task-lock" aria-hidden="true">
          <span className="task-lock-label">{strings.updating}</span>
        </span>
      )}
      {failed && (
        <span className="task-notice" aria-hidden="true">
          {strings.notSaved}
        </span>
      )}
    </li>
  );
}

/**
 * The children of the item without the checkbox GFM put in front of them.
 *
 * It is matched by element type rather than by position, because a leading
 * space follows it and neither the space nor the order is part of any contract.
 */
function dropBox(children: ReactNode): ReactNode {
  if (!Array.isArray(children)) return children;
  return (children as ReactNode[]).filter((child) => !(isValidElement(child) && child.type === 'input'));
}

export function Markdown({ children, source, onToggleTask, taskSave, writable = false, footnotes }: MarkdownProps) {
  const text = toUnixNewlines(children);
  const { strings } = useHost();
  const calloutTitle = (kind: string): string | undefined =>
    Object.hasOwn(strings.callouts, kind) ? strings.callouts[kind] : undefined;

  return (
    // The pass that draws a cut note's footnotes continues the note rather than opening a run,
    // so its section keeps the space a section takes at the end of a note.
    <div className={footnotes === 'section' ? 'markdown footnotes-run' : 'markdown'}>
      <ReactMarkdown
        remarkPlugins={readingPlugins(calloutTitle)}
        // Raw HTML is NOT enabled, and its absence is the point: no
        // `rehype-raw` is loaded, so a note carrying `<script>` is text. It is
        // a security boundary rather than a rendering preference, because a
        // notebook is written by several people and by agents (§7.9).
        // A formula KaTeX cannot typeset shows its source, never an error (§7.8).
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false }],
          ...(footnotes === undefined
            ? []
            : footnotes === 'section'
              ? [rehypeFootnoteSection]
              : [[rehypeFootnoteRun, footnotes] as [typeof rehypeFootnoteRun, typeof footnotes]]),
        ]}
        // Footnotes (§7.12): the words around them are the reader's, and the
        // label heads the notes gathered at the end of the note, where a
        // reader sees it — GFM hides it, and a stylesheet that hides nothing
        // shows it as a visible heading, so it is in the reader's language.
        remarkRehypeOptions={{
          // remark-rehype's own default, stated: `footnotes.ts` renumbers by it.
          clobberPrefix: CLOBBER_PREFIX,
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
          div: MarkdownDiv,
          table: MarkdownTable,
          blockquote: MarkdownBlockquote,
          section: MarkdownSection,
          ...headings,
          li: (props: LiProps) => (
            <TaskItem
              {...props}
              source={source ?? text}
              toggleTask={onToggleTask}
              taskSave={taskSave}
              writable={writable}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
