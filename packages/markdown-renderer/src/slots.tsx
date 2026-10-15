/**
 * The slots of a theme, where the reading surface hands a drawn notation over.
 *
 * Each component here draws exactly what the default theme draws when the
 * theme leaves its slot empty, so a note with no theme is the same DOM it was
 * before slots existed, and calls the slot with the notation already
 * interpreted when the theme fills it. Nothing a slot is given lets it reach
 * the source: what it draws is decided before it is called.
 */

import {
  Children,
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useContext,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useHost } from './host.js';
import type { ThemeComponents } from './theme.js';

/** The slot a theme fills, or `undefined`. */
export function useSlot<K extends keyof ThemeComponents>(name: K): ThemeComponents[K] | undefined {
  return useHost().theme.components?.[name];
}

/** Draws a slot as a component, so a slot may use hooks. */
export function drawSlot<P extends object>(slot: (props: P) => ReactNode, props: P): ReactNode {
  return createElement(slot as (props: P) => ReactElement, props);
}

type WithNode<T> = T & { node?: unknown };

/** Whether a code element sits in a fenced block, which is what tells a block from a span. */
export const InBlock = createContext(false);

// ── Callouts ─────────────────────────────────────────────────────────────────

/**
 * The words of a title, in one element: the title is laid out as a row beside
 * its icon, and every text node and every `<strong>` of it would otherwise be
 * an item of that row of its own, drawn as columns. One run wraps as a sentence.
 */
function CalloutTitleText({ children }: { children?: ReactNode }) {
  return <span className="callout-title-text">{children}</span>;
}

/** The title `remarkCallouts` built, carried to the callout that holds it. */
function CalloutTitle({ children }: { children?: ReactNode }) {
  return (
    <div className="callout-title">
      <CalloutTitleText>{children}</CalloutTitleText>
    </div>
  );
}

function Callout({ kind, fold, children }: { kind: string; fold: '+' | '-' | null; children?: ReactNode }) {
  const { theme } = useHost();
  const slot = useSlot('callout');
  const iconSlot = useSlot('calloutIcon');
  const icon: ReactNode =
    theme.icons && Object.hasOwn(theme.icons, kind)
      ? theme.icons[kind]
      : iconSlot
        ? drawSlot(iconSlot, { kind })
        : null;

  const parts = Children.toArray(children);
  // The title arrives as the `div` react-markdown draws through `MarkdownDiv`.
  const at = parts.findIndex(
    (part) =>
      isValidElement<{ className?: string }>(part) &&
      part.type === MarkdownDiv &&
      (part.props.className?.split(/\s+/) ?? []).includes('callout-title'),
  );
  const title = at === -1 ? null : (parts[at] as ReactElement<{ children?: ReactNode }>).props.children;
  const titled =
    icon === null ? (
      <CalloutTitle>{title}</CalloutTitle>
    ) : (
      // An icon of the theme's takes the place of the one the stylesheet draws.
      <div className="callout-title has-icon">
        <span className="callout-icon" aria-hidden="true">
          {icon}
        </span>
        <CalloutTitleText>{title}</CalloutTitleText>
      </div>
    );

  if (slot) {
    const body = parts.filter((_, index) => index !== at);
    return drawSlot(slot, { kind, fold, title, icon, children: body });
  }
  if (fold) {
    const body = parts.filter((_, index) => index !== at);
    return (
      <FoldingCallout kind={kind} fold={fold} icon={icon} body={body}>
        {title}
      </FoldingCallout>
    );
  }
  return (
    <div className="callout" data-callout={kind} {...(fold ? { 'data-fold': fold } : {})}>
      {parts.map((part, index) => (index === at ? <Fragment key="title">{titled}</Fragment> : part))}
    </div>
  );
}

/**
 * A callout marked `+` or `-`, which the default theme folds (§7, #83): a disclosure whose title
 * is its control, open at first for `+` and closed for `-`, where only the title shows. A callout
 * with no mark keeps MemorySmith's markup, which draws every callout open.
 */
function FoldingCallout({ kind, fold, icon, body, children }: { kind: string; fold: '+' | '-'; icon: ReactNode; body: ReactNode[]; children?: ReactNode }) {
  const { strings } = useHost();
  const [open, setOpen] = useState(fold === '+');
  // A callout with no title is named by its type's word, so the control always says what it opens.
  const words = children ?? strings.callouts[kind.toLowerCase()] ?? kind;
  return (
    <details className="callout" data-callout={kind} data-fold={fold} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={icon === null ? 'callout-title' : 'callout-title has-icon'}>
        {icon !== null && (
          <span className="callout-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <CalloutTitleText>{words}</CalloutTitleText>
      </summary>
      {body}
    </details>
  );
}

/** A `div` of the tree: a callout or its title, which `remarkCallouts` marks, or any other. */
export function MarkdownDiv({ className, children, node: _node, ...rest }: WithNode<HTMLAttributes<HTMLDivElement>>) {
  const classes = className?.split(/\s+/) ?? [];
  const data = rest as Record<string, unknown>;
  if (classes.includes('callout-title')) return <CalloutTitle>{children}</CalloutTitle>;
  if (classes.includes('callout')) {
    const fold = data['data-fold'];
    return (
      <Callout kind={String(data['data-callout'] ?? '')} fold={fold === '+' || fold === '-' ? fold : null}>
        {children}
      </Callout>
    );
  }
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

// ── Tables, headings, quotations, footnotes ──────────────────────────────────

interface HastLike {
  readonly tagName?: string;
  readonly properties?: Record<string, unknown>;
  readonly children?: readonly HastLike[];
}

/** The alignment of each column, read from the first row's cells. */
function alignOf(node: HastLike | undefined): ('left' | 'center' | 'right' | null)[] {
  const rows: HastLike[] = [];
  const walk = (element: HastLike): void => {
    if (element.tagName === 'tr') rows.push(element);
    else for (const child of element.children ?? []) walk(child);
  };
  if (node) walk(node);
  const first = rows[0];
  return (first?.children ?? [])
    .filter((cell) => cell.tagName === 'th' || cell.tagName === 'td')
    .map((cell) => {
      const align = cell.properties?.['align'];
      return align === 'left' || align === 'center' || align === 'right' ? align : null;
    });
}

export function MarkdownTable({ children, node, ...rest }: WithNode<HTMLAttributes<HTMLTableElement>>) {
  const slot = useSlot('table');
  if (slot) return drawSlot(slot, { align: alignOf(node as HastLike | undefined), children });
  return <table {...rest}>{children}</table>;
}

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function Heading({
  level,
  className,
  children,
  node: _node,
  ...rest
}: WithNode<HTMLAttributes<HTMLHeadingElement>> & { level: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const slot = useSlot('heading');
  // The heading of the footnotes is the footnotes slot's, not a heading of the note.
  if (slot && !className?.split(/\s+/).includes('footnotes-label')) return drawSlot(slot, { level, children });
  return createElement(`h${level}` as HeadingTag, { className, ...rest }, children);
}

export const headings = {
  h1: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={1} {...props} />,
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={2} {...props} />,
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={3} {...props} />,
  h4: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={4} {...props} />,
  h5: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={5} {...props} />,
  h6: (props: HTMLAttributes<HTMLHeadingElement>) => <Heading level={6} {...props} />,
};

export function MarkdownBlockquote({ children, node: _node, ...rest }: WithNode<HTMLAttributes<HTMLQuoteElement>>) {
  const slot = useSlot('blockquote');
  if (slot) return drawSlot(slot, { children });
  return <blockquote {...rest}>{children}</blockquote>;
}

export function MarkdownSection({ children, node: _node, ...rest }: WithNode<HTMLAttributes<HTMLElement>>) {
  const slot = useSlot('footnotes');
  const { strings } = useHost();
  const footnotes = (rest as Record<string, unknown>)['data-footnotes'] !== undefined;
  if (slot && footnotes) {
    const notes = Children.toArray(children).filter(
      (child) => !(isValidElement(child) && (child.props as { id?: string }).id === 'footnote-label'),
    );
    return drawSlot(slot, { label: strings.footnotes, children: notes });
  }
  return <section {...rest}>{children}</section>;
}

/** Whether a code element is being drawn inside a fenced block. */
export function useInBlock(): boolean {
  return useContext(InBlock);
}
