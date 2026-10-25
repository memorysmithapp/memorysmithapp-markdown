/**
 * Where each construct of a note sits in its bytes, for the editor to draw (ADR-006).
 *
 * The editor's model is the note's text, and the page is drawn over it: every construct the
 * reading surface draws is found here as ranges of that text — what it covers, which characters
 * are its notation and which are its content — so the editor can hide the notation, style the
 * content, or draw a block in place, and never rewrite a byte it did not touch.
 *
 * The text is read by the reading surface's own parser (`remark-parse` with GFM and math, at the
 * options of `readingPlugins`), and the notation that parser leaves as text — callouts, wikilinks,
 * marked text, comments, block identifiers — by the same patterns the reading surface uses. No
 * React and no DOM: the analysis is a pure function of the text, and tested as one.
 */

import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified, type Processor } from 'unified';
import { codeRegions, commentRegions, insideCode } from '../source.js';
import { CALLOUT_MARKER } from '../remark-callouts.js';
import { breaksDollarRule } from '../remark-ring.js';
import { hasParameterReference, parameterReferences } from '../parameters.js';

/** A range of the text: `from` included, `to` excluded. */
export interface Span {
  readonly from: number;
  readonly to: number;
}

export type InlineMark = 'em' | 'strong' | 'strike' | 'highlight' | 'code';

/** A construct of the note, found in its text. */
export type Construct =
  | { readonly kind: 'frontmatter'; readonly from: number; readonly to: number }
  | { readonly kind: 'heading'; readonly from: number; readonly to: number; readonly level: number; readonly marker: Span }
  | {
      readonly kind: 'mark';
      readonly mark: InlineMark;
      readonly from: number;
      readonly to: number;
      readonly open: Span;
      readonly close: Span;
    }
  | {
      readonly kind: 'link';
      readonly from: number;
      readonly to: number;
      /** The label; `null` for an address written bare, which has no notation to hide. */
      readonly label: Span | null;
      readonly url: string;
    }
  | {
      readonly kind: 'wikilink';
      readonly from: number;
      readonly to: number;
      readonly target: string;
      /** What the page shows: the alias, or the target. */
      readonly label: Span;
      readonly embed: boolean;
      /** Its target writes a parameter (§7.14): it leads nowhere until a notebook is created from the model. */
      readonly parameter: boolean;
    }
  | { readonly kind: 'parameter'; readonly from: number; readonly to: number; readonly name: string }
  | { readonly kind: 'image'; readonly from: number; readonly to: number }
  | { readonly kind: 'inlineMath'; readonly from: number; readonly to: number; readonly tex: string }
  | { readonly kind: 'mathBlock'; readonly from: number; readonly to: number; readonly tex: string }
  | {
      readonly kind: 'code';
      readonly from: number;
      readonly to: number;
      readonly language: string | null;
      /** The fence lines; `null` for an indented block. */
      readonly open: Span | null;
      readonly close: Span | null;
      readonly code: string;
    }
  | {
      readonly kind: 'callout';
      readonly from: number;
      readonly to: number;
      readonly type: string;
      readonly fold: '+' | '-' | null;
      /** `[!type]` and its fold marker, in the first line. */
      readonly marker: Span;
    }
  | { readonly kind: 'quoteMarker'; readonly from: number; readonly to: number }
  | { readonly kind: 'table'; readonly from: number; readonly to: number }
  | {
      readonly kind: 'listMarker';
      readonly from: number;
      readonly to: number;
      readonly ordered: boolean;
      /** The task box after the marker, `[ ]` or `[x]`. */
      readonly task: (Span & { readonly checked: boolean }) | null;
    }
  | { readonly kind: 'rule'; readonly from: number; readonly to: number }
  | { readonly kind: 'embed'; readonly from: number; readonly to: number; readonly target: string; readonly anchor: string | null }
  | { readonly kind: 'footnoteRef'; readonly from: number; readonly to: number; readonly label: string }
  | { readonly kind: 'footnoteDef'; readonly from: number; readonly to: number; readonly label: string; readonly marker: Span }
  | { readonly kind: 'comment'; readonly from: number; readonly to: number }
  | { readonly kind: 'blockId'; readonly from: number; readonly to: number; readonly id: string }
  | { readonly kind: 'html'; readonly from: number; readonly to: number }
  | { readonly kind: 'definition'; readonly from: number; readonly to: number };

export type ConstructKind = Construct['kind'];

/** The constructs of a note, in the order of their `from`. */
export interface Analysis {
  readonly constructs: readonly Construct[];
  /** Where the body starts: after the frontmatter, or 0. */
  readonly bodyFrom: number;
}

interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  url?: string;
  lang?: string | null;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  label?: string;
  identifier?: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
}

let parser: Processor | null = null;
function parse(text: string): MdNode {
  // The micromark extensions of `readingPlugins`, at its options; the transforms that rewrite the
  // tree are not run, because they drop the positions this reads.
  parser ??= unified().use(remarkParse).use(remarkGfm, { singleTilde: false }).use(remarkMath) as unknown as Processor;
  return parser.parse(text) as unknown as MdNode;
}

const FRONTMATTER_CLOSE = /\n---[ \t]*(?:\n|$)/;
/** Same as the reading surface's: `[[target#anchor|alias]]`, with an optional bang. */
const WIKILINK = /(!)?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
const HIGHLIGHT = /==([^=\n]+)==/g;
const BLOCK_ID = /[ \t]\^([A-Za-z0-9-]+)[ \t]*$/;
const LIST_MARKER = /^([-*+]|\d{1,9}[.)])([ \t]+|$)(\[([ xX])\](?=[ \t]|$))?/;
const QUOTE_MARKERS = /^(?:[ \t]{0,3}>[ \t]?)+/;
const EMBED_LINE = /^!\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|[^\]]*?)?\]\]$/;

/** The frontmatter block, from its first `---` to the end of its closing line, or `null`. */
export function frontmatterSpan(text: string): Span | null {
  if (!text.startsWith('---\n')) return null;
  const close = FRONTMATTER_CLOSE.exec(text.slice(3));
  if (!close) return null;
  return { from: 0, to: 3 + close.index + close[0].length };
}

const offsets = (node: MdNode): Span | null => {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  return from === undefined || to === undefined ? null : { from, to };
};

/** The constructs of a note's text. Offsets are into `text` as given. */
export function analyze(text: string): Analysis {
  const found: Construct[] = [];
  const front = frontmatterSpan(text);
  const bodyFrom = front?.to ?? 0;
  if (front) found.push({ kind: 'frontmatter', ...front });

  // The body is parsed alone, padded so that every offset is an offset of the note.
  const tree = parse('\n'.repeat(bodyFrom) + text.slice(bodyFrom));

  const comments = commentRegions(text).filter(([from]) => from >= bodyFrom);
  for (const [from, to] of comments) found.push({ kind: 'comment', from, to });
  const inComment = (at: number): boolean => comments.some(([from, to]) => at >= from && at < to);

  const code = codeRegions(text);
  // Wikilinks first: what a wikilink covers is drawn as one link, and nothing inside it is read again.
  const wikilinks: Span[] = [];
  for (const match of text.slice(bodyFrom).matchAll(WIKILINK)) {
    const from = bodyFrom + (match.index ?? 0);
    const to = from + match[0].length;
    if (insideCode(code, from) || inComment(from)) continue;
    const embed = match[1] === '!';
    const target = match[2] ?? '';
    const head = from + (embed ? 3 : 2);
    const label =
      match[3] !== undefined
        ? { from: to - 2 - match[3].length, to: to - 2 }
        : { from: head, to: head + target.length };
    wikilinks.push({ from, to });
    // In a table cell the pipe before an alias is escaped, and the backslash is not part of the target.
    const name = target.split('#')[0]!.replace(/\\$/, '').trim();
    found.push({ kind: 'wikilink', from, to, target: name, label, embed, parameter: hasParameterReference(name) });
  }
  const inWikilink = (span: Span): boolean => wikilinks.some((link) => span.from < link.to && span.to > link.from);

  const visit = (node: MdNode, inCallout: boolean): void => {
    const span = offsets(node);
    const children = node.children ?? [];
    if (span && !inComment(span.from)) {
      switch (node.type) {
        case 'text': {
          // A parameter is written in text, and only there (§7.14): code, math, raw HTML and a
          // destination are not text nodes, and an autolink's text is its address.
          for (const reference of parameterReferences(text.slice(span.from, span.to))) {
            const from = span.from + reference.from;
            if (!inComment(from)) found.push({ kind: 'parameter', from, to: span.from + reference.to, name: reference.name });
          }
          break;
        }
        case 'heading': {
          const line = text.slice(span.from, span.to);
          const marker = /^#{1,6}(?:[ \t]+|$)/.exec(line);
          if (marker) {
            found.push({
              kind: 'heading',
              ...span,
              level: node.depth ?? 1,
              marker: { from: span.from, to: span.from + marker[0].length },
            });
          }
          break;
        }
        case 'emphasis':
        case 'strong':
        case 'delete': {
          const first = children[0] && offsets(children[0]);
          const last = children[children.length - 1] && offsets(children[children.length - 1]!);
          if (first && last && !inWikilink(span)) {
            found.push({
              kind: 'mark',
              mark: node.type === 'emphasis' ? 'em' : node.type === 'strong' ? 'strong' : 'strike',
              ...span,
              open: { from: span.from, to: first.from },
              close: { from: last.to, to: span.to },
            });
          }
          break;
        }
        case 'inlineCode': {
          const raw = text.slice(span.from, span.to);
          const ticks = /^`+/.exec(raw)?.[0].length ?? 1;
          found.push({
            kind: 'mark',
            mark: 'code',
            ...span,
            open: { from: span.from, to: span.from + ticks },
            close: { from: span.to - ticks, to: span.to },
          });
          break;
        }
        case 'link': {
          const raw = text.slice(span.from, span.to);
          // An autolink is its address, which writes no parameter.
          if (!raw.startsWith('[')) {
            if (!inWikilink(span)) found.push({ kind: 'link', ...span, label: null, url: node.url ?? '' });
            return;
          }
          if (inWikilink(span)) break;
          const first = children[0] && offsets(children[0]);
          const last = children[children.length - 1] && offsets(children[children.length - 1]!);
          const label = raw.startsWith('[') && first && last ? { from: first.from, to: last.to } : null;
          found.push({ kind: 'link', ...span, label, url: node.url ?? '' });
          break;
        }
        case 'image':
          if (!inWikilink(span)) found.push({ kind: 'image', ...span });
          break;
        case 'inlineMath':
          if (!breaksDollarRule(text, span.from, span.to)) {
            found.push({ kind: 'inlineMath', ...span, tex: node.value ?? '' });
          }
          break;
        case 'math':
          found.push({ kind: 'mathBlock', ...span, tex: node.value ?? '' });
          break;
        case 'code': {
          const lines = text.slice(span.from, span.to).split('\n');
          const head = lines[0] ?? '';
          const fence = /^([ \t]*(?:>[ \t]?)*[ \t]*)(`{3,}|~{3,})/.exec(head);
          const tail = lines[lines.length - 1] ?? '';
          const closes = fence !== null && lines.length > 1 && new RegExp(`^[ \\t>]*\\${fence[2]![0]}{${fence[2]!.length},}[ \\t]*$`).test(tail);
          found.push({
            kind: 'code',
            ...span,
            language: node.lang ?? null,
            open: fence ? { from: span.from, to: span.from + head.length } : null,
            close: closes ? { from: span.to - tail.length, to: span.to } : null,
            code: node.value ?? '',
          });
          return;
        }
        case 'blockquote': {
          const first = text.slice(span.from, text.indexOf('\n', span.from) === -1 ? span.to : text.indexOf('\n', span.from));
          const quote = QUOTE_MARKERS.exec(first);
          const callout = quote ? CALLOUT_MARKER.exec(first.slice(quote[0].length)) : null;
          if (callout && quote && !inCallout) {
            const markerFrom = span.from + quote[0].length;
            const markerText = /^\[![^\]]+\][+-]?/.exec(first.slice(quote[0].length))?.[0] ?? '';
            found.push({
              kind: 'callout',
              ...span,
              type: (callout[1] ?? 'note').toLowerCase(),
              fold: callout[2] === '+' || callout[2] === '-' ? callout[2] : null,
              marker: { from: markerFrom, to: markerFrom + markerText.length },
            });
            for (const child of children) visit(child, true);
            return;
          }
          if (!inCallout) {
            // Each line's markers, which the page hides while the line is not being edited.
            let at = span.from;
            while (at < span.to) {
              const end = text.indexOf('\n', at);
              const lineEnd = end === -1 || end > span.to ? span.to : end;
              const marker = QUOTE_MARKERS.exec(text.slice(at, lineEnd));
              if (marker) found.push({ kind: 'quoteMarker', from: at, to: at + marker[0].length });
              at = lineEnd + 1;
            }
          }
          break;
        }
        case 'table':
          found.push({ kind: 'table', ...span });
          return;
        case 'listItem': {
          const marker = LIST_MARKER.exec(text.slice(span.from, span.to));
          if (marker) {
            const markerTo = span.from + marker[1]!.length + (marker[2]?.length ?? 0);
            const task =
              marker[3] !== undefined && node.checked !== null && node.checked !== undefined
                ? { from: markerTo, to: markerTo + 3, checked: node.checked }
                : null;
            found.push({ kind: 'listMarker', from: span.from, to: markerTo, ordered: /\d/.test(marker[1]!), task });
          }
          break;
        }
        case 'thematicBreak':
          found.push({ kind: 'rule', ...span });
          return;
        case 'paragraph': {
          const raw = text.slice(span.from, span.to);
          const embed = EMBED_LINE.exec(raw.trim());
          // An embed of a parameter transcludes nothing (§7.14): it is drawn as a wikilink is.
          if (embed && !hasParameterReference(embed[1]!) && !raw.includes('\n') && !inCallout && span.from === text.lastIndexOf('\n', span.from - 1) + 1) {
            found.push({ kind: 'embed', ...span, target: embed[1]!.trim(), anchor: embed[2]?.trim() ?? null });
            return;
          }
          // Marked text and a block identifier are characters to the parser, found here on the
          // paragraph's own lines and never inside code.
          for (const match of raw.matchAll(HIGHLIGHT)) {
            const from = span.from + (match.index ?? 0);
            const to = from + match[0].length;
            if (insideCode(code, from) || inWikilink({ from, to })) continue;
            found.push({ kind: 'mark', mark: 'highlight', from, to, open: { from, to: from + 2 }, close: { from: to - 2, to } });
          }
          const lastLineFrom = span.from + raw.lastIndexOf('\n') + 1;
          const id = BLOCK_ID.exec(text.slice(lastLineFrom, span.to));
          if (id) {
            const from = lastLineFrom + (id.index ?? 0) + 1;
            found.push({ kind: 'blockId', from, to: from + 1 + id[1]!.length, id: id[1]! });
          }
          break;
        }
        case 'footnoteReference':
          found.push({ kind: 'footnoteRef', ...span, label: node.label ?? node.identifier ?? '' });
          break;
        case 'footnoteDefinition': {
          const marker = /^\[\^[^\]]+\]:[ \t]?/.exec(text.slice(span.from, span.to));
          if (marker) {
            found.push({
              kind: 'footnoteDef',
              ...span,
              label: node.label ?? node.identifier ?? '',
              marker: { from: span.from, to: span.from + marker[0].length },
            });
          }
          break;
        }
        case 'html':
          found.push({ kind: 'html', ...span });
          return;
        case 'definition':
          found.push({ kind: 'definition', ...span });
          return;
      }
    }
    for (const child of children) visit(child, inCallout);
  };
  visit(tree, false);

  found.sort((a, b) => a.from - b.from || b.to - a.to);
  return { constructs: found, bodyFrom };
}
