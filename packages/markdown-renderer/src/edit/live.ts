/**
 * The page the editor draws over the note's text (ADR-006).
 *
 * The text is the model, and nothing here changes it: each construct the analysis finds is drawn
 * by decorations — its notation hidden and its content styled while the cursor is elsewhere, its
 * notation shown, dimmed, while the cursor is in it; a block drawn by the reading surface's own
 * components in place of its lines until the cursor enters it, and then its lines as source.
 */

import { EditorSelection, Facet, Prec, StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import katex from 'katex';
import { Component, createElement, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { followable } from '../address.js';
import { highlightTree, languageToLoad, loadGrammar } from '../highlight.js';
import { HostProvider, resolveHost, type ResolvedHost } from '../host.js';
import { readImageAlt, type ImageAlt } from '../image-dimensions.js';
import { highlightLanguage } from '../highlight.js';
import { analyze, type Analysis, type Construct } from './analyze.js';
import { DEFAULT_METRICS, estimateHeight, measuredHeight, rememberHeight, withinReason, type BlockKind, type BlockMetrics } from './heights.js';
import { AddProperties, CalloutBlock, PropertiesBlock, reveal, Snippet, TableBlock } from './blocks.js';
import { LanguageControl } from './LanguageControl.js';
import { toggleTaskBox } from './commands.js';

/** What the drawn blocks read: the host the note is edited under. */
export interface EditorEnvironment {
  readonly host: ResolvedHost;
}

export const editorEnvironment = Facet.define<EditorEnvironment, EditorEnvironment>({
  combine: (values) => values[0] ?? { host: resolveHost({}) },
});

/** The note's text with `\n` between lines, whose offsets are the editor's positions. */
export function textOf(state: EditorState): string {
  return state.doc.sliceString(0, state.doc.length, '\n');
}

/** The analysis of the note, kept with the state and made again when the text changes. */
export const analysisField = StateField.define<Analysis>({
  create: (state) => analyze(textOf(state)),
  update: (analysis, transaction) => (transaction.docChanged ? analyze(textOf(transaction.state)) : analysis),
});

/** Says the editor took or lost the focus. */
export const setFocused = StateEffect.define<boolean>();
/** A grammar a code block names has arrived: its tokens can be coloured now (#84). */
export const grammarArrived = StateEffect.define<string>();

/** The editor's metrics changed: the blocks made from now on estimate their height by them (#91). */
const setBlockMetrics = StateEffect.define<BlockMetrics>();

/** The metrics of the editor's text column, which a drawn block estimates its height by (#91). */
const metricsField = StateField.define<BlockMetrics>({
  create: () => DEFAULT_METRICS,
  update: (metrics, transaction) => {
    for (const effect of transaction.effects) if (effect.is(setBlockMetrics)) return effect.value;
    return metrics;
  },
});

/** Reads the editor's metrics again whenever its geometry changes, and keeps them when they moved. */
const metricsWatcher = ViewPlugin.define((view) => {
  let destroyed = false;
  const check = () =>
    view.requestMeasure({
      read: () => withinReason({ width: view.contentDOM.clientWidth, lineHeight: view.defaultLineHeight, charWidth: view.defaultCharacterWidth }),
      write: (next) => {
        const now = view.state.field(metricsField);
        const moved = Math.abs(next.width - now.width) >= 1 || Math.abs(next.lineHeight - now.lineHeight) >= 0.5 || Math.abs(next.charWidth - now.charWidth) >= 0.05;
        // Not inside the measure, where CodeMirror takes no transaction.
        if (moved) queueMicrotask(() => destroyed || view.dispatch({ effects: setBlockMetrics.of(next) }));
      },
    });
  check();
  return {
    update: (update: ViewUpdate) => {
      if (update.geometryChanged) check();
    },
    destroy: () => {
      destroyed = true;
    },
  };
});

/** Whether the editor has the focus: a construct is shown as source only to an author who is in it. */
const focusField = StateField.define<boolean>({
  create: () => false,
  update: (focused, transaction) => {
    for (const effect of transaction.effects) if (effect.is(setFocused)) return effect.value;
    return focused;
  },
});

// ── Widgets ──────────────────────────────────────────────────────────────────

/**
 * What a drawn block shows when drawing it threw — a host's `renderLink` that needs the host's own
 * context, which a block's root, outside the host's tree, does not carry (#90): its lines as written,
 * under a notice, so a failure never hides a part of the note. A click on it shows its source.
 */
class BlockBoundary extends Component<{ host: ResolvedHost; source: string; children?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // React reports a caught error only in development; the host is told in every build.
    console.error('A block of the note could not be drawn:', error, info.componentStack);
  }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const notice = this.props.host.strings.editor.blockFailed;
    if (!this.props.source) return createElement('span', { className: 'cm-ms-block-failed', title: notice });
    return createElement(
      'div',
      { className: 'cm-ms-block-failed', role: 'note' },
      createElement('p', { className: 'cm-ms-block-failed-notice' }, notice),
      createElement('pre', null, this.props.source),
    );
  }
}

/** The React roots the widgets mounted, unmounted when CodeMirror lets the widget go. */
const roots = new WeakMap<HTMLElement, { unmount: () => void; observer: ResizeObserver | null }>();

function mount(view: EditorView, element: HTMLElement, node: ReactNode, source: string, measured: (height: number) => void): void {
  const { host } = view.state.facet(editorEnvironment);
  const root = createRoot(element);
  // Drawn on React's own schedule: CodeMirror builds its widgets inside its update, which may run
  // inside a React commit, where React cannot be asked to render synchronously.
  root.render(createElement(HostProvider, { value: host }, createElement(BlockBoundary, { host, source }, node)));
  // A block whose content arrives later — an embed, a diagram — changes its height after it is
  // measured; the editor is told so, or the lines below it would be placed by the old height.
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          measured(element.getBoundingClientRect().height);
          view.requestMeasure();
        });
  observer?.observe(element);
  roots.set(element, { unmount: () => root.unmount(), observer });
}

function unmount(element: HTMLElement): void {
  const mounted = roots.get(element);
  if (!mounted) return;
  roots.delete(element);
  mounted.observer?.disconnect();
  // Not during CodeMirror's update, which may be inside React's own commit.
  queueMicrotask(() => mounted.unmount());
}

/** What a drawn block is besides how it is drawn. */
interface BlockOptions {
  /** A block drawn within a line, whose height is the line's. */
  readonly inline?: boolean;
  /** The lines it stands for, shown as written when drawing it fails (#90), and what it estimates by. */
  readonly source?: string;
  /** What it draws, for its estimate (#91); a block of no kind estimates two lines. */
  readonly kind?: BlockKind;
  /** The editor's metrics when it was made. */
  readonly metrics?: BlockMetrics;
}

/** A block drawn with React in place of lines of the note. */
class BlockWidget extends WidgetType {
  readonly inline: boolean;
  readonly source: string;
  constructor(
    readonly key: string,
    readonly host: ResolvedHost,
    readonly draw: (view: EditorView) => ReactNode,
    /** Whether a click on it shows its source; a block with controls of its own handles its clicks. */
    readonly revealsOnClick: boolean,
    readonly options: BlockOptions = {},
  ) {
    super();
    this.inline = options.inline ?? false;
    this.source = options.source ?? '';
  }
  /** What it is remembered by once measured: what it draws, wherever in the note it stands. */
  private get identity(): string {
    return `${this.options.kind ?? 'block'}\u0000${this.source}`;
  }
  override eq(other: BlockWidget): boolean {
    return other.key === this.key && other.host === this.host;
  }
  toDOM(view: EditorView): HTMLElement {
    const element: HTMLElement = document.createElement(this.inline ? 'span' : 'div');
    element.className = this.inline ? 'cm-ms-inline-block' : 'cm-ms-block';
    mount(view, element, this.draw(view), this.source, (height) => rememberHeight(this.identity, view.state.field(metricsField), height));
    element.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-ms-control]')) return;
      if (event.metaKey || event.ctrlKey) return;
      if (!this.revealsOnClick) return;
      event.preventDefault();
      // At the end of its first line: after a fence's language, a callout's title, a formula's `$$`.
      reveal(view, view.state.doc.lineAt(blockStart(view, element, this.key)).to);
    });
    // A link inside a drawn block is followed with a modifier only, as in the text.
    element.addEventListener('click', (event) => {
      const anchor = (event.target as HTMLElement).closest('a');
      if (anchor && !(event.metaKey || event.ctrlKey)) event.preventDefault();
    });
    return element;
  }
  override destroy(element: HTMLElement): void {
    unmount(element);
  }
  override ignoreEvent(): boolean {
    return true;
  }
  /**
   * The height CodeMirror lays the block out at until it is drawn, which it reads once, when the
   * block is made: the height it was drawn at before at this width, or its estimate (#91).
   */
  override get estimatedHeight(): number {
    if (this.inline) return -1;
    const metrics = this.options.metrics ?? DEFAULT_METRICS;
    const kind = this.options.kind;
    return measuredHeight(this.identity, metrics) ?? (kind ? estimateHeight(kind, this.source, metrics) : 2 * metrics.lineHeight);
  }
}

/**
 * Where the lines a drawn block stands for start. `posAtDOM` answers the end of the line before a
 * block widget, so the start is read from the decoration that drew it, the one nearest that answer.
 */
function blockStart(view: EditorView, element: HTMLElement, key: string): number {
  const near = view.posAtDOM(element);
  let found = -1;
  view.state.field(decorationsField).between(Math.max(0, near - 1), Math.min(view.state.doc.length, near + 1), (from, _to, decoration) => {
    const widget = decoration.spec.widget as unknown;
    if (widget instanceof BlockWidget && widget.key === key) {
      found = from;
      return false;
    }
    return undefined;
  });
  return found === -1 ? near : found;
}

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    const element = document.createElement('span');
    element.className = 'cm-ms-bullet';
    element.textContent = '•';
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
}

class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  override eq(other: TaskWidget): boolean {
    return other.checked === this.checked;
  }
  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'cm-ms-task';
    box.checked = this.checked;
    box.disabled = view.state.readOnly;
    box.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const at = view.posAtDOM(box);
      const transaction = toggleTaskBox(view.state, at);
      if (transaction) view.dispatch({ ...transaction, userEvent: 'input.toggle' });
    });
    return box;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

/** What a rule and a formula's row are drawn at by the default theme, before they are measured (#91). */
const RULE_HEIGHT = 33;
const MATH_ROW = 32;
const MATH_MARGINS = 32;

class RuleWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-ms-rule';
    wrap.appendChild(document.createElement('hr'));
    return wrap;
  }
  override get estimatedHeight(): number {
    return RULE_HEIGHT;
  }
}

class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
  ) {
    super();
  }
  override eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display;
  }
  toDOM(): HTMLElement {
    const element = document.createElement(this.display ? 'div' : 'span');
    element.className = this.display ? 'cm-ms-math-block' : 'cm-ms-math';
    // A formula KaTeX cannot typeset shows its source, as on the page (§7.8).
    katex.render(this.tex, element, { throwOnError: false, displayMode: this.display, strict: 'ignore' });
    return element;
  }
  /** A formula's rows, each a line of KaTeX's display, within its margins (#91). */
  override get estimatedHeight(): number {
    return this.display ? MATH_MARGINS + MATH_ROW * this.tex.split('\\\\').length : -1;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

/** What an image declares no height for is drawn at before it loads, near enough (#91). */
const UNDECLARED_IMAGE_HEIGHT = 200;

class ImageWidget extends WidgetType {
  readonly match: RegExpExecArray | null;
  readonly alt: ImageAlt;
  constructor(readonly source: string) {
    super();
    this.match = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/.exec(source);
    this.alt = readImageAlt(this.match?.[1] ?? '');
  }
  override eq(other: ImageWidget): boolean {
    return other.source === this.source;
  }
  toDOM(): HTMLElement {
    const match = this.match;
    const address = match ? followable(match[2] ?? '') : '';
    if (!match || !address) {
      const text = document.createElement('span');
      text.className = 'cm-ms-raw';
      text.textContent = this.source;
      return text;
    }
    const image = document.createElement('img');
    image.className = 'cm-ms-image';
    image.src = address;
    // Its description and the dimensions it declares, as the page draws it (`SPEC.md` §3.14).
    image.alt = this.alt.description;
    if (this.alt.width !== null) image.width = this.alt.width;
    if (this.alt.height !== null) image.height = this.alt.height;
    return image;
  }
  /** The line it stands in is as tall as the image: the height it declares, or a guess (#91). */
  override get estimatedHeight(): number {
    if (!this.match) return -1;
    if (this.alt.height !== null) return this.alt.height;
    return this.alt.width !== null ? Math.round(this.alt.width * 0.75) : UNDECLARED_IMAGE_HEIGHT;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

// ── Decorations ──────────────────────────────────────────────────────────────

const hide = Decoration.replace({});
const syntax = Decoration.mark({ class: 'cm-ms-syntax' });
const line = (className: string) => Decoration.line({ class: className });
const mark = (className: string, attributes?: Record<string, string>) => Decoration.mark({ class: className, attributes });

/** The kinds drawn as blocks in place of their lines. */
const BLOCK_KINDS = new Set<Construct['kind']>(['frontmatter', 'callout', 'table', 'mathBlock', 'embed', 'rule', 'code']);

function build(state: EditorState): DecorationSet {
  const { constructs, bodyFrom } = state.field(analysisField);
  const { host } = state.facet(editorEnvironment);
  const metrics = state.field(metricsField);
  const focused = state.field(focusField);
  const doc = state.doc;
  const text = textOf(state);
  const ranges = state.selection.ranges;
  const out: Range<Decoration>[] = [];
  const covered: { from: number; to: number }[] = [];

  /** Whether the author's cursor or selection is on this range, ends included. */
  const touches = (from: number, to: number) => focused && ranges.some((range) => range.from <= to && range.to >= from);
  /** The whole lines a construct takes, its last line break left out. */
  const linesOf = (from: number, to: number) => {
    const end = to > from && text[to - 1] === '\n' ? to - 1 : to;
    return { from: doc.lineAt(from).from, to: doc.lineAt(end).to };
  };
  const alone = (from: number, to: number) => {
    const lines = linesOf(from, to);
    return /^[ \t]*$/.test(text.slice(lines.from, from)) && /^[ \t]*$/.test(text.slice(to, lines.to));
  };
  const inCovered = (from: number, to: number) => covered.some((block) => from >= block.from && to <= block.to);
  const eachLine = (from: number, to: number, className: string) => {
    const lines = linesOf(from, to);
    for (let at = doc.lineAt(lines.from).number; at <= doc.lineAt(lines.to).number; at++) out.push(line(className).range(doc.line(at).from));
  };
  const block = (from: number, to: number, kind: BlockKind, key: string, draw: (view: EditorView) => ReactNode, revealsOnClick = true) => {
    const lines = linesOf(from, to);
    const source = text.slice(lines.from, lines.to);
    out.push(Decoration.replace({ widget: new BlockWidget(key, host, draw, revealsOnClick, { source, kind, metrics }), block: true }).range(lines.from, lines.to));
    covered.push(lines);
  };
  const after = (to: number, key: string, draw: (view: EditorView) => ReactNode, source: string) => {
    const lines = linesOf(to, to);
    out.push(Decoration.widget({ widget: new BlockWidget(key, host, draw, false, { source, kind: 'preview', metrics }), block: true, side: 1 }).range(lines.to));
  };

  if (bodyFrom === 0) {
    out.push(Decoration.widget({ widget: new BlockWidget('add-properties', host, (view) => createElement(AddProperties, { view }), false, { kind: 'add-properties', metrics }), block: true, side: -1 }).range(0));
  }

  // Blocks first: what a drawn block covers is not decorated again.
  for (const construct of constructs) {
    if (!BLOCK_KINDS.has(construct.kind) || inCovered(construct.from, construct.to)) continue;
    const { from, to } = construct;
    const lines = linesOf(from, to);
    const open = touches(lines.from, lines.to);
    const source = text.slice(lines.from, lines.to);
    switch (construct.kind) {
      case 'frontmatter':
        if (open) eachLine(from, to, 'cm-ms-yaml');
        else block(from, to, 'frontmatter', `front:${source}`, (view) => createElement(PropertiesBlock, { view, to }), false);
        break;
      case 'callout':
        if (!alone(from, to)) break;
        if (open) eachLine(from, to, `cm-ms-callout-source`);
        else {
          const marker = { ...construct.marker, type: construct.type, fold: construct.fold };
          block(from, to, 'callout', `callout:${from}:${source}`, (view) => createElement(CalloutBlock, { view, text: source, marker }));
        }
        break;
      case 'table':
        if (!alone(from, to)) break;
        if (open) eachLine(from, to, 'cm-ms-table-source');
        else block(from, to, 'table', `table:${from}:${source}`, (view) => createElement(TableBlock, { view, from, to }), false);
        break;
      case 'mathBlock':
        if (!alone(from, to)) break;
        if (open) {
          eachLine(from, to, 'cm-ms-code-line');
          const preview = `$$\n${construct.tex}\n$$`;
          after(to, `math-preview:${construct.tex}`, () => createElement(Snippet, { text: preview }), preview);
        } else {
          out.push(Decoration.replace({ widget: new MathWidget(construct.tex, true), block: true }).range(lines.from, lines.to));
          covered.push(lines);
        }
        break;
      case 'embed':
        if (open) out.push(mark('cm-ms-wikilink').range(from, to));
        else block(from, to, 'embed', `embed:${source}`, () => createElement(Snippet, { text: source }));
        break;
      case 'rule':
        if (!alone(from, to)) break;
        if (open) out.push(syntax.range(from, to));
        else {
          out.push(Decoration.replace({ widget: new RuleWidget(), block: true }).range(lines.from, lines.to));
          covered.push(lines);
        }
        break;
      case 'code': {
        const diagram = construct.language === 'mermaid' && construct.open !== null;
        if (diagram && !open && alone(from, to)) {
          block(from, to, 'diagram', `diagram:${source}`, () => createElement(Snippet, { text: source }));
          break;
        }
        codeLines(construct, out, doc, text);
        // The language, chosen at the block's top right from every grammar Prism carries (#84).
        if (construct.open) {
          const fence = construct.open.from;
          const language = construct.language;
          out.push(
            Decoration.widget({
              widget: new BlockWidget(`language:${fence}:${language ?? ''}`, host, (view) => createElement(LanguageControl, { view, from: fence, language }), false, { inline: true }),
              side: 1,
            }).range(construct.open.to),
          );
        }
        if (diagram) {
          const preview = '```mermaid\n' + construct.code + '\n```';
          after(to, `diagram-preview:${construct.code}`, () => createElement(Snippet, { text: preview }), preview);
        }
        covered.push(lines);
        break;
      }
    }
  }

  for (const construct of constructs) {
    if (BLOCK_KINDS.has(construct.kind) || inCovered(construct.from, construct.to)) continue;
    const { from, to } = construct;
    switch (construct.kind) {
      case 'heading': {
        out.push(line(`cm-ms-heading cm-ms-h${construct.level}`).range(doc.lineAt(from).from));
        const { marker } = construct;
        if (touches(doc.lineAt(from).from, doc.lineAt(from).to)) out.push(syntax.range(marker.from, marker.to));
        else out.push(hide.range(marker.from, marker.to));
        break;
      }
      case 'mark': {
        const content = construct.open.to < construct.close.from;
        if (content) out.push(mark(`cm-ms-${construct.mark}`).range(construct.open.to, construct.close.from));
        if (touches(from, to) || !content) {
          out.push(syntax.range(construct.open.from, construct.open.to));
          out.push(syntax.range(construct.close.from, construct.close.to));
        } else {
          out.push(hide.range(construct.open.from, construct.open.to));
          out.push(hide.range(construct.close.from, construct.close.to));
        }
        break;
      }
      case 'link': {
        const attributes = { 'data-href': construct.url, title: construct.url };
        if (!construct.label) {
          out.push(mark('cm-ms-link', attributes).range(from, to));
          break;
        }
        if (construct.label.from < construct.label.to) out.push(mark('cm-ms-link', attributes).range(construct.label.from, construct.label.to));
        if (touches(from, to)) {
          out.push(syntax.range(from, construct.label.from));
          out.push(syntax.range(construct.label.to, to));
        } else {
          out.push(hide.range(from, construct.label.from));
          out.push(hide.range(construct.label.to, to));
        }
        break;
      }
      case 'wikilink': {
        const pending = host.reaches(construct.target) === 0 && !host.keeps(construct.target);
        if (construct.embed && host.keeps(construct.target) && !touches(from, to)) {
          const source = text.slice(from, to);
          out.push(
            Decoration.replace({ widget: new BlockWidget(`attachment:${source}`, host, () => createElement(Snippet, { text: source }), true, { inline: true, source }) }).range(from, to),
          );
          break;
        }
        out.push(
          mark(`cm-ms-wikilink${pending ? ' cm-ms-pending' : ''}`, { 'data-target': construct.target, title: construct.target }).range(
            construct.label.from,
            construct.label.to,
          ),
        );
        if (touches(from, to)) {
          out.push(syntax.range(from, construct.label.from));
          out.push(syntax.range(construct.label.to, to));
        } else {
          out.push(hide.range(from, construct.label.from));
          out.push(hide.range(construct.label.to, to));
        }
        break;
      }
      case 'image':
        if (!touches(from, to)) out.push(Decoration.replace({ widget: new ImageWidget(text.slice(from, to)) }).range(from, to));
        break;
      case 'inlineMath':
        if (touches(from, to)) out.push(mark('cm-ms-math-source').range(from, to));
        else out.push(Decoration.replace({ widget: new MathWidget(construct.tex, false) }).range(from, to));
        break;
      case 'quoteMarker': {
        const depth = (text.slice(from, to).match(/>/g) ?? []).length;
        out.push(line(`cm-ms-quote cm-ms-quote-${Math.min(depth, 3)}`).range(doc.lineAt(from).from));
        if (touches(doc.lineAt(from).from, doc.lineAt(from).to)) out.push(syntax.range(from, to));
        else out.push(hide.range(from, to));
        break;
      }
      case 'listMarker': {
        const markerEnd = to;
        const symbol = text.slice(from, markerEnd).trimEnd();
        const onMarker = touches(from, construct.task ? construct.task.to : markerEnd);
        // A task item shows its box and no bullet, as on the page.
        if (construct.ordered || onMarker) out.push(mark('cm-ms-list-marker').range(from, from + symbol.length));
        else if (construct.task) out.push(hide.range(from, markerEnd));
        else out.push(Decoration.replace({ widget: new BulletWidget() }).range(from, from + symbol.length));
        if (construct.task) {
          if (onMarker) out.push(syntax.range(construct.task.from, construct.task.to));
          else out.push(Decoration.replace({ widget: new TaskWidget(construct.task.checked) }).range(construct.task.from, construct.task.to));
          if (construct.task.checked) {
            const end = doc.lineAt(construct.task.to).to;
            if (end > construct.task.to + 1) out.push(mark('cm-ms-task-done').range(construct.task.to + 1, end));
          }
        }
        break;
      }
      case 'footnoteRef':
        out.push(mark('cm-ms-footnote-ref', { title: construct.label }).range(from, to));
        break;
      case 'footnoteDef':
        out.push(line('cm-ms-footnote-def').range(doc.lineAt(from).from));
        out.push(syntax.range(construct.marker.from, construct.marker.to));
        break;
      case 'comment':
        out.push(mark('cm-ms-comment').range(from, to));
        break;
      case 'blockId':
        out.push(mark('cm-ms-block-id').range(from, to));
        break;
      case 'html':
      case 'definition':
        out.push(mark('cm-ms-raw').range(from, to));
        break;
    }
  }
  return Decoration.set(out, true);
}

/** A code block's lines, as source: its frame, its fences dimmed, its tokens coloured. */
function codeLines(construct: Extract<Construct, { kind: 'code' }>, out: Range<Decoration>[], doc: EditorState['doc'], text: string): void {
  const first = doc.lineAt(construct.from).number;
  const last = doc.lineAt(construct.to > construct.from && text[construct.to - 1] === '\n' ? construct.to - 1 : construct.to).number;
  for (let at = first; at <= last; at++) {
    const classes = ['cm-ms-code-line', at === first ? 'cm-ms-code-first' : '', at === last ? 'cm-ms-code-last' : ''].filter(Boolean).join(' ');
    out.push(line(classes).range(doc.line(at).from));
  }
  if (construct.open) out.push(syntax.range(construct.open.from, construct.open.to));
  if (construct.close) out.push(syntax.range(construct.close.from, construct.close.to));
  const language = highlightLanguage(construct.language ? `language-${construct.language}` : undefined);
  if (!language || !construct.open) return;
  const start = construct.open.to + 1;
  // Tokens are coloured only where the code is the bytes as written, with no container markers.
  if (text.slice(start, start + construct.code.length) !== construct.code) return;
  let at = start;
  const walk = (node: { type: string; value?: string; children?: unknown[]; properties?: { className?: unknown } }, classes: string[]): void => {
    if (node.type === 'text') {
      const length = node.value?.length ?? 0;
      if (classes.length > 0 && length > 0) out.push(mark(classes.join(' ')).range(at, at + length));
      at += length;
      return;
    }
    const own = node.type === 'element' && Array.isArray(node.properties?.className) ? (node.properties.className as string[]) : [];
    for (const child of node.children ?? []) walk(child as typeof node, own.length > 0 ? [...new Set([...classes, ...own])] : classes);
  };
  walk(highlightTree(construct.code, language) as unknown as Parameters<typeof walk>[0], []);
}

export const decorationsField = StateField.define<DecorationSet>({
  create: build,
  update: (decorations, transaction) =>
    transaction.docChanged ||
    transaction.selection ||
    transaction.effects.some((effect) => effect.is(setFocused) || effect.is(grammarArrived)) ||
    transaction.startState.facet(editorEnvironment) !== transaction.state.facet(editorEnvironment)
      ? build(transaction.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Keeps `focusField` with the focus the page really has. The focus event is the usual way it
 * learns, but an editor focused as it is made — or made twice, as React's strict mode does — can
 * miss it; any update that finds the two apart sets the field right, after the update.
 */
const focusKeeper = ViewPlugin.fromClass(
  class {
    private pending = false;
    update(update: ViewUpdate): void {
      this.check(update.view);
    }
    constructor(view: EditorView) {
      this.check(view);
    }
    check(view: EditorView): void {
      if (this.pending || view.hasFocus === view.state.field(focusField)) return;
      this.pending = true;
      queueMicrotask(() => {
        this.pending = false;
        if (view.hasFocus !== view.state.field(focusField)) view.dispatch({ effects: setFocused.of(view.hasFocus) });
      });
    }
  },
  {
    eventHandlers: {
      // A click on an editor that already holds the focus changes no focus, and the field may be the one behind.
      mousedown(_event, view) {
        setTimeout(() => {
          if (view.hasFocus && !view.state.field(focusField)) view.dispatch({ effects: setFocused.of(true) });
        });
      },
    },
  },
);

/**
 * The arrow keys go into a drawn block rather than over it: a move up or down that would skip a
 * block's lines lands at its edge instead, and the block shows its source.
 */
function enterBlock(forward: boolean) {
  return (view: EditorView): boolean => {
    const range = view.state.selection.main;
    if (!range.empty) return false;
    const moved = view.moveVertically(range, forward);
    let target: number | null = null;
    view.state.field(decorationsField).between(Math.min(range.head, moved.head), Math.max(range.head, moved.head), (from, to, decoration) => {
      if (!decoration.spec.block || !decoration.spec.widget || from === to) return;
      if (forward && from > range.head && from <= moved.head && target === null) target = from;
      if (!forward && to < range.head && to >= moved.head) target = to;
    });
    if (target === null) return false;
    view.dispatch({ selection: EditorSelection.cursor(target), scrollIntoView: true });
    return true;
  };
}

const blockKeys = Prec.high(
  keymap.of([
    { key: 'ArrowDown', run: enterBlock(true) },
    { key: 'ArrowUp', run: enterBlock(false) },
  ]),
);

/** Follows a link with a modifier held: a wikilink through the host, an address the page follows in a new tab. */
const follow = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!(event.metaKey || event.ctrlKey)) return false;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-target], [data-href]');
    if (!target) return false;
    event.preventDefault();
    const { host } = view.state.facet(editorEnvironment);
    const name = target.dataset['target'];
    if (name !== undefined) {
      const address = host.resolve(name);
      if (address !== null) host.navigate(address);
      return true;
    }
    const address = followable(target.dataset['href'] ?? '');
    if (address) window.open(address, '_blank', 'noreferrer');
    return true;
  },
});

/**
 * Fetches the grammar of every code block that names one not registered yet, and has the page
 * drawn again once it arrives, its tokens coloured (#84).
 */
const grammarLoader = ViewPlugin.fromClass(
  class {
    private live = true;
    constructor(readonly view: EditorView) {
      this.check();
    }
    update(update: ViewUpdate): void {
      if (update.docChanged) this.check();
    }
    destroy(): void {
      this.live = false;
    }
    private check(): void {
      for (const construct of this.view.state.field(analysisField).constructs) {
        if (construct.kind !== 'code' || !construct.language) continue;
        const wanted = languageToLoad(`language-${construct.language}`);
        if (!wanted) continue;
        void loadGrammar(wanted).then((loaded) => {
          if (loaded && this.live) this.view.dispatch({ effects: grammarArrived.of(wanted) });
        });
      }
    }
  },
);

/**
 * The live page: the analysis, the decorations over it, and what the focus and a modifier-click do.
 * `metrics` are the editor's text column measured before the editor is made, which the first drawn
 * blocks estimate their height by; without them they assume `DEFAULT_METRICS` until it is measured.
 */
export function livePage(metrics?: BlockMetrics): Extension {
  return [
    analysisField,
    metricsField.init(() => metrics ?? DEFAULT_METRICS),
    metricsWatcher,
    focusField,
    decorationsField,
    EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing)),
    focusKeeper,
    grammarLoader,
    blockKeys,
    follow,
  ];
}
