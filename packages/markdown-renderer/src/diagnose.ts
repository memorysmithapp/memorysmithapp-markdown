/**
 * The notices of a note (§7.13): where what is drawn will not be what was most likely typed.
 *
 * There is no invalid note (§6.4), so nothing here accepts or refuses: it reads a note the way the
 * reading surface reads it — the same frontmatter cut, its comments taken out (`hideComments`), the
 * same parser and the same remark plugins (`reading.ts`) — and reports, by a stable code, the places where the page will differ from the
 * text, or where the note lacks something the specification reserves a place for. A notice never
 * blocks a save and never changes a byte.
 *
 * It runs with no DOM and no React, so a host can call it on a server, from a tool that writes a
 * note, or beside an editor. KaTeX checks a formula as `rehype-katex` would typeset it, and Mermaid
 * reads a diagram as the page would draw it, loaded only when a note carries one.
 */

import katex from 'katex';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { NoteHost } from './host.js';
import { bodyStart, codeRegions, hideComments, insideCode, toUnixNewlines, type HiddenComments } from './markdown.js';
import { readProperties } from './properties.js';
import { readingPlugins } from './reading.js';

/** The codes of §7.13, which `spec.json` declares as `notices`. */
export type NoticeCode =
  | 'fence-unclosed'
  | 'math-unclosed'
  | 'formula-invalid'
  | 'diagram-invalid'
  | 'frontmatter-unclosed'
  | 'name-missing'
  | 'name-unusable'
  | 'reserved-not-a-list'
  | 'aliases-missing'
  | 'tags-missing'
  | 'heading-first-level'
  | 'heading-skipped-level'
  | 'footnote-undefined'
  | 'footnote-unreferenced'
  | 'raw-html'
  | 'strikethrough-single-tilde'
  | 'link-pending'
  | 'embed-pending';

/** `notice`: the page will differ from what was typed. `hint`: nothing is drawn wrong. */
export type NoticeSeverity = 'notice' | 'hint';

/** One place in a note, by a code of §7.13. Lines and columns count from 1 over the whole note. */
export interface Notice {
  readonly code: NoticeCode;
  readonly severity: NoticeSeverity;
  /** The section of the specification that decides what happens there. */
  readonly section: string;
  /** What a reader gets, in English; a host words it in its own language from `code`. */
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/**
 * What the notebook answers, as `NoteBody` asks it. With neither `resolve` nor `reaches`, nothing
 * is known about the notebook and no link is reported as pending.
 */
export interface DiagnoseOptions extends Pick<NoteHost, 'resolve' | 'reaches' | 'keeps'> {
  /** Whether to read each `mermaid` block with Mermaid, which is loaded for it. Defaults to true. */
  readonly diagrams?: boolean;
}

/** The table of §7.13, as `spec.json` carries it: a test holds the two equal. */
export const NOTICES: Readonly<Record<NoticeCode, { readonly severity: NoticeSeverity; readonly section: string; readonly message: string }>> = {
  'fence-unclosed': { severity: 'notice', section: '3.7', message: 'This fence is never closed: it runs to the end of its block, and everything after it is code.' },
  'math-unclosed': { severity: 'notice', section: '7.8', message: 'This $$ block is never closed: it runs to the end of its block, and everything after it is a formula.' },
  'formula-invalid': { severity: 'notice', section: '7.8', message: 'This formula cannot be typeset, and is shown as its source.' },
  'diagram-invalid': { severity: 'notice', section: '7.2', message: 'This diagram cannot be read, and is shown as its source or its error.' },
  'frontmatter-unclosed': { severity: 'notice', section: '6.1', message: 'This frontmatter is never closed by a ---: the note has no properties, and its lines are body text.' },
  'name-missing': { severity: 'notice', section: '6.5', message: 'The note has no name: a link reaches it only through an alias.' },
  'name-unusable': { severity: 'notice', section: '6.5', message: 'This name is not a single text value, or carries one of #, [, ] and |, so the note is unnamed.' },
  'reserved-not-a-list': { severity: 'notice', section: '6.4', message: 'This value is not a list, so it is an ordinary attribute.' },
  'aliases-missing': { severity: 'hint', section: '6.4', message: 'The note has no aliases: only its name catches a link.' },
  'tags-missing': { severity: 'hint', section: '6.4', message: 'The note has no tags: it has no subjects to be filtered by.' },
  'heading-first-level': { severity: 'notice', section: '3.3', message: 'The first heading of the body is not level one.' },
  'heading-skipped-level': { severity: 'notice', section: '3.3', message: 'This heading skips a level below the heading before it.' },
  'footnote-undefined': { severity: 'notice', section: '7.12', message: 'This footnote has no definition, and is drawn as its characters.' },
  'footnote-unreferenced': { severity: 'notice', section: '7.12', message: 'Nothing references this footnote, so it is not drawn.' },
  'raw-html': { severity: 'notice', section: '7.9', message: 'Raw HTML is drawn as text, tags and all.' },
  'strikethrough-single-tilde': { severity: 'notice', section: '4.3', message: 'One tilde strikes nothing: the tildes stay on the page. Strikethrough is ~~two~~.' },
  'link-pending': { severity: 'hint', section: '7.4', message: 'No note answers this link yet, so it is drawn as pending.' },
  'embed-pending': { severity: 'hint', section: '7.3', message: 'No note and no kept file answers this embed, so it is drawn as a pending link.' },
};

interface Point {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

interface Node {
  type: string;
  value?: string;
  depth?: number;
  lang?: string | null;
  identifier?: string;
  children?: Node[];
  position?: { start: Point; end: Point };
}

/** A footnote reference left as text, which is one with no definition (§7.12). */
const UNDEFINED_REFERENCE = /\[\^[^\]\s]+\]/g;
/** A run between single tildes, which GFM as read here leaves as characters (§4.3). */
const SINGLE_TILDE = /(?<![~\\])~(?!~)(?=\S)[^~\n]*?\S~(?!~)/g;
/** A wikilink, with the bang of an embed: the shape `resolveWikilinks` reads. */
const WIKILINK = /(!)?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
/** A closing fence or `$$`, once the markers of its container are taken off. */
const CONTAINER_PREFIX = /^[ \t>]*/;
const KEY = /^([A-Za-z0-9_-]+)\s*:/;

/**
 * The notices of a note, in the order of the note. `markdown` is the note as a host keeps it,
 * frontmatter included; the positions are into it.
 */
export async function diagnose(markdown: string, options: DiagnoseOptions = {}): Promise<Notice[]> {
  const text = toUnixNewlines(markdown);
  const lineStarts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') lineStarts.push(index + 1);
  const pointOf = (offset: number): { line: number; column: number } => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
  };

  const found: { at: number; notice: Notice }[] = [];
  const report = (code: NoticeCode, start: number, end: number = start, detail?: string): void => {
    const from = pointOf(start);
    const to = pointOf(end);
    const { severity, section, message } = NOTICES[code];
    found.push({
      at: start,
      notice: {
        code,
        severity,
        section,
        message: detail ? `${message} (${detail})` : message,
        line: from.line,
        column: from.column,
        endLine: to.line,
        endColumn: to.column,
      },
    });
  };

  const split = bodyStart(text);
  frontmatter(text, split, report);

  // A comment is never drawn, so nothing it holds raises a notice; positions are mapped back over it.
  const hidden = hideComments(text.slice(split));
  const body = hidden.text;
  const processor = unified().use(remarkParse).use(readingPlugins(() => undefined));
  const parsed = processor.parse(body) as Node;
  // The text as the parser found it, before a plugin cut a run of it and dropped its position.
  const read = structuredClone(parsed);
  const tree = processor.runSync(parsed, body) as Node;
  const span = (node: Node): [number, number] | null => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    return start === undefined || end === undefined ? null : [split + hidden.original(start), split + hidden.original(end, true)];
  };

  const diagrams: { source: string; at: [number, number] }[] = [];
  const referenced = new Set<string>();
  const definitions: Node[] = [];
  walk(tree, (node) => {
    const at = span(node);
    if (!at) return;
    const source = text.slice(at[0], at[1]);
    if (node.type === 'code' && /^\s*(`{3,}|~{3,})/.test(source)) {
      if (!closes(source, /^(`{3,}|~{3,})/)) report('fence-unclosed', at[0], at[1]);
      else if (node.lang === 'mermaid') diagrams.push({ source: node.value ?? '', at });
    } else if (node.type === 'math') {
      if (!closes(source, /^(\${2,})/)) report('math-unclosed', at[0], at[1]);
      else if (!typesets(node.value ?? '', true)) report('formula-invalid', at[0], at[1]);
    } else if (node.type === 'inlineMath') {
      if (!typesets(node.value ?? '', false)) report('formula-invalid', at[0], at[1]);
    } else if (node.type === 'html') {
      report('raw-html', at[0], at[1]);
    } else if (node.type === 'footnoteReference') {
      referenced.add(String(node.identifier ?? '').toUpperCase());
    } else if (node.type === 'footnoteDefinition') {
      definitions.push(node);
    }
  });
  for (const definition of definitions) {
    const at = span(definition);
    if (at && !referenced.has(String(definition.identifier ?? '').toUpperCase())) {
      report('footnote-unreferenced', at[0], at[1]);
    }
  }

  outline(tree, span, report);

  // What stays characters on the page is found in the text the parser read.
  walk(read, (node) => {
    if (node.type !== 'text') return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const source = body.slice(start, end);
    for (const [pattern, code] of [
      [UNDEFINED_REFERENCE, 'footnote-undefined'],
      [SINGLE_TILDE, 'strikethrough-single-tilde'],
    ] as const) {
      for (const match of source.matchAll(pattern)) {
        const from = start + match.index;
        report(code, split + hidden.original(from), split + hidden.original(from + match[0].length, true));
      }
    }
  });

  pending(hidden, split, options, report);

  if (diagrams.length > 0 && options.diagrams !== false) {
    const mermaid = (await import('mermaid')).default;
    for (const diagram of diagrams) {
      try {
        await mermaid.parse(diagram.source);
      } catch (error) {
        if (unreadable(error)) report('diagram-invalid', diagram.at[0], diagram.at[1]);
      }
    }
  }

  return found.sort((a, b) => a.at - b.at).map(({ notice }) => notice);
}

type Report = (code: NoticeCode, start: number, end?: number, detail?: string) => void;

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * Whether a fenced block or a `$$` block was closed: its last line, once its container's markers
 * are off, is a run of the opening character at least as long as the opening one, and nothing else.
 */
function closes(source: string, opening: RegExp): boolean {
  const lines = source.split('\n');
  const run = opening.exec((lines[0] ?? '').replace(CONTAINER_PREFIX, ''))?.[1] ?? '';
  if (lines.length < 2 || run.length === 0) return false;
  const last = (lines[lines.length - 1] ?? '').replace(CONTAINER_PREFIX, '').trimEnd();
  const closing = new RegExp(`^\\${run[0]}{${run.length},}$`);
  return closing.test(last);
}

/**
 * Whether Mermaid refused a diagram for what it says, rather than for where it runs. Its parsers
 * answer with a parse error, and an unknown diagram type with its own error; with no DOM, reading a
 * label of some diagrams fails on the sanitiser instead, and that failure is no notice: a diagram
 * Mermaid could not finish reading here may well be drawn on the page.
 */
function unreadable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const failure = error as { hash?: unknown; name?: unknown; constructor?: { name?: unknown } };
  return (
    typeof failure.hash === 'object' ||
    failure.name === 'UnknownDiagramError' ||
    failure.constructor?.name === 'MermaidParseError'
  );
}

/** Whether KaTeX typesets a formula, as `rehype-katex` would. */
function typesets(formula: string, display: boolean): boolean {
  try {
    katex.renderToString(formula, { displayMode: display, throwOnError: true, strict: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** The reserved keys of the frontmatter (§6.4, §6.5), and a block that never closes (§6.1). */
function frontmatter(text: string, split: number, report: Report): void {
  const opened = text.startsWith('---');
  if (opened && text.indexOf('\n---', 3) === -1) report('frontmatter-unclosed', 0, text.indexOf('\n') === -1 ? 3 : text.indexOf('\n'));

  // Where each key was written, to place a notice on it.
  const keys = new Map<string, number>();
  if (opened && split > 0) {
    let at = text.indexOf('\n') + 1;
    for (const line of text.slice(at, split).split('\n')) {
      const key = KEY.exec(line)?.[1];
      if (key && !keys.has(key)) keys.set(key, at);
      at += line.length + 1;
    }
  }
  const lineEnd = (at: number): number => {
    const end = text.indexOf('\n', at);
    return end === -1 ? text.length : end;
  };

  const properties = readProperties(text);
  const name = keys.get('name');
  if (name === undefined) report('name-missing', 0);
  else if (properties.name === null) report('name-unusable', name, lineEnd(name));

  for (const [key, code] of [
    ['aliases', 'aliases-missing'],
    ['tags', 'tags-missing'],
  ] as const) {
    const at = keys.get(key);
    const entry = properties.entries.find((candidate) => candidate.key === key);
    if (at === undefined || !entry) report(code, 0);
    else if (entry.shape === 'empty') report(code, at, lineEnd(at));
    else if (entry.shape !== 'list') report('reserved-not-a-list', at, lineEnd(at), key);
  }
}

/** The outline of the body (§3.3): the headings at its top level, outside code. */
function outline(tree: Node, span: (node: Node) => [number, number] | null, report: Report): void {
  let previous: number | null = null;
  for (const node of tree.children ?? []) {
    if (node.type !== 'heading' || node.depth === undefined) continue;
    const at = span(node);
    if (at) {
      if (previous === null && node.depth > 1) report('heading-first-level', at[0], at[1]);
      else if (previous !== null && node.depth > previous + 1) report('heading-skipped-level', at[0], at[1]);
    }
    previous = node.depth;
  }
}

/**
 * The wikilinks and embeds no note answers, when the host says which notes exist: a link reaches
 * a note, and an embed a note or a kept file (§5.2, §5.8). Read on the body outside code, as
 * `resolveWikilinks` reads it.
 */
function pending(hidden: HiddenComments, split: number, options: DiagnoseOptions, report: Report): void {
  const body = hidden.text;
  const { resolve, reaches, keeps = () => false } = options;
  if (!resolve && !reaches) return;
  const answered = (name: string): boolean =>
    reaches ? reaches(name.normalize('NFC')) > 0 : resolve!(name.normalize('NFC')) !== null;
  const code = codeRegions(body);
  for (const match of body.matchAll(WIKILINK)) {
    if (insideCode(code, match.index)) continue;
    const name = (match[2] ?? '').split('#')[0]?.trim().replace(/\\$/, '').trim() ?? '';
    // `[[#Section]]` is a link within the note itself.
    if (!name) continue;
    const embed = match[1] !== undefined;
    if (answered(name) || (embed && keeps(name))) continue;
    const end = match.index + match[0].length;
    report(embed ? 'embed-pending' : 'link-pending', split + hidden.original(match.index), split + hidden.original(end, true), name);
  }
}
