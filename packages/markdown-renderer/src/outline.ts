/**
 * The outline of a note and the ids of its headings (`SPEC.md` §3.3, §7.17, #173), apart from
 * React: what a `contents` block lists, and what a link to `#section` lands on.
 *
 * Every heading is given the GitHub slug of its text, unique in the note, a repeat taking `-1`,
 * `-2`: the note's own headings carry it as their id, prefixed so it never meets an id of the
 * host's page, and every heading carries it as `data-heading`, which is what a link written inside
 * an embed finds there, where no id is given. The outline is the headings at the top level of the
 * note, outside quotes, callouts, lists and code: the ones `heading-first-level` examines.
 *
 * The note is drawn in runs an embed cuts, each parsed on its own; the slugs are counted across
 * them here, once, over the same text and the same plugins the runs are drawn with, and each run
 * is handed its own, in the order it meets its headings.
 */

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { CLOBBER_PREFIX } from './footnotes.js';
import { readingPlugins } from './reading.js';
import { isContentsBlock } from './contents.js';
import type { StyleNumbering } from './note-style.js';
import { keptImageName } from './kept-image.js';
import { isTableBlock, readTableBlock } from './table-block.js';

/** A node of the tree as much as is read here. */
export interface OutlineNode {
  type: string;
  readonly depth?: number;
  readonly value?: string;
  readonly position?: { readonly start?: { readonly line?: number } };
  readonly lang?: string | null;
  readonly meta?: string | null;
  readonly url?: string;
  readonly alt?: string | null;
  readonly title?: string | null;
  children?: OutlineNode[];
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
}

/** One heading of the outline: where a contents entry leads, and what it says. */
export interface OutlineHeading {
  /** The id the heading carries on the page. */
  readonly id: string;
  readonly slug: string;
  readonly level: number;
  /** The heading's inlines, as drawn: links are their text, footnote references are gone. */
  readonly content: readonly OutlineNode[];
  /** Its number, as the style numbers it (#174), or `null`. */
  readonly number: string | null;
  /** The run it is in, and its line there, from 1. */
  readonly run: number;
  readonly line: number;
}

/** What a note's runs carry: each run's slugs and contents blocks, and the note's outline. */
export interface NoteOutline {
  readonly runs: readonly OutlineRun[];
  readonly headings: readonly OutlineHeading[];
  /** The source of each `contents` block of the note, in order. */
  readonly blocks: readonly string[];
  /** Each image alone in its paragraph, in order: what may be a figure once its file is known (#175). */
  readonly figureCandidates: readonly FigureCandidate[];
  /** Each table of the note, in order (#175). */
  readonly tables: readonly TableItem[];
  /** Each reference to a kept file, in order (#175). */
  readonly kept: readonly KeptReference[];
}

export interface OutlineRun {
  /** The slug of every heading of the run, in the order a walk of its tree meets them. */
  readonly slugs: readonly string[];
  /** The number of each of those headings, `null` for one the style does not number (#174). */
  readonly numbers?: readonly (string | null)[];
  /** The ordinal of its first `contents` block among the note's. */
  readonly firstBlock: number;
  /** What each image alone in its paragraph is (#175): a figure's number, or `null`. */
  readonly figures?: readonly (number | null)[];
  /** The number of each table of the run, in the order of the walk (#175). */
  readonly tables?: readonly number[];
  /** The id of each reference to a kept file, on the first one of its name only (#175). */
  readonly attachments?: readonly (string | null)[];
  /** Whether a `table` block is a table, as the plan counted the tables. */
  readonly tableBlocks?: boolean;
}

/** An image alone in its paragraph (#175): remote, or a file the notebook keeps. */
export interface FigureCandidate {
  readonly run: number;
  readonly kept: boolean;
  /** The kept file's name, or the last segment of a remote image's address. */
  readonly name: string;
  /** The title written after its destination, `![…](x "title")`, or `null`. */
  readonly title: string | null;
  /** Whether it is written as an image, `![…](…)`, or as an embed, `![[…]]`. */
  readonly form: 'image' | 'embed';
}

/** A table of the note (#175): a Markdown table and its `Table:` caption, or a `table` block. */
export interface TableItem {
  readonly run: number;
  readonly kind: 'markdown' | 'block';
  /** A Markdown table's caption inlines, keyword left out, or `null`. */
  readonly caption: readonly OutlineNode[] | null;
  /** A block's `title`, else the table it names, or `null`. */
  readonly title: string | null;
}

/** A reference to a file the notebook keeps (#175): an embed or an image whose destination names no host. */
export interface KeptReference {
  readonly run: number;
  readonly name: string;
  readonly title: string | null;
}

/** The keyword of a Markdown table's caption (#175): `Table:`, Pandoc's, case folded. */
const CAPTION = /^table:[ \t]*/i;

/** The kept file an attachment link names, as `resolveWikilinks` writes it: `attachment:name|size`. */
export function attachmentName(url: string): string | null {
  if (!url.startsWith('attachment:')) return null;
  let address: string;
  try {
    address = decodeURIComponent(url.slice('attachment:'.length));
  } catch {
    address = url.slice('attachment:'.length);
  }
  const at = address.lastIndexOf('|');
  return (at === -1 ? address : address.slice(0, at)).normalize('NFC');
}

/** The kept file or remote image a node references, or `null`. */
export function referenceOf(node: OutlineNode): { kept: boolean; name: string; title: string | null; form: 'image' | 'embed' } | null {
  if (node.type === 'link' && node.url) {
    const name = attachmentName(node.url);
    return name === null ? null : { kept: true, name, title: null, form: 'embed' };
  }
  if (node.type === 'image' && node.url) {
    const name = keptImageName(node.url);
    if (name !== null) return { kept: true, name, title: node.title ?? null, form: 'image' };
    const last = node.url.split(/[?#]/, 1)[0]!.split('/').filter(Boolean).pop() ?? node.url;
    let decoded = last;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      // An escape that is not one is left as written.
    }
    return { kept: false, name: decoded, title: node.title ?? null, form: 'image' };
  }
  return null;
}

/** The one image or file a paragraph holds and nothing else, which makes it a figure's candidate (#175). */
export function aloneIn(paragraph: OutlineNode): OutlineNode | null {
  if (paragraph.type !== 'paragraph') return null;
  const meaningful = (paragraph.children ?? []).filter((child) => !(child.type === 'text' && (child.value ?? '').trim() === ''));
  const only = meaningful.length === 1 ? meaningful[0]! : null;
  return only && referenceOf(only) ? only : null;
}

/** Whether a node is a table the note draws: a Markdown table, or a `table` block where tables are reached. */
export function isTableNode(node: OutlineNode, blocks: boolean): boolean {
  return node.type === 'table' || (blocks && node.type === 'code' && isTableBlock(node.lang, node.meta));
}

/** The paragraph right after a table that captions it (`Table: …`), or `null`. */
export function captionAfter(node: OutlineNode, parent: OutlineNode | null): OutlineNode | null {
  if (node.type !== 'table' || !parent?.children) return null;
  const next = parent.children[parent.children.indexOf(node) + 1];
  const first = next?.type === 'paragraph' ? next.children?.[0] : undefined;
  return first?.type === 'text' && CAPTION.test(first.value ?? '') ? next! : null;
}

/** A caption's inlines without its keyword. */
export function captionContent(paragraph: OutlineNode): OutlineNode[] {
  const [first, ...rest] = paragraph.children ?? [];
  if (!first) return [];
  const value = (first.value ?? '').replace(CAPTION, '');
  return value === '' ? rest : [{ ...first, value }, ...rest];
}

/** The id a heading of the note carries on the page. */
export function headingId(slug: string): string {
  return `${CLOBBER_PREFIX}${slug}`;
}

/**
 * GitHub's slug of a heading's text: lower case, letters with their marks, digits, `-` and `_`
 * kept, every space a `-`, anything else dropped.
 */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

/** Hands out slugs, a repeat taking `-1`, `-2`, as GitHub's slugger does. */
export class Slugger {
  private readonly seen = new Map<string, number>();
  slug(text: string): string {
    const base = slugOf(text);
    let slug = base;
    while (this.seen.has(slug)) {
      const count = this.seen.get(base)! + 1;
      this.seen.set(base, count);
      slug = `${base}-${count}`;
    }
    this.seen.set(slug, 0);
    return slug;
  }
}

/** The text of a node, as a heading's slug reads it. */
export function textOf(node: OutlineNode): string {
  if (node.type === 'footnoteReference') return '';
  if (typeof node.value === 'string' && node.type !== 'html') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** Visits every node of a tree, parents before their children, as remark does. */
export function walkTree(node: OutlineNode, visit: (node: OutlineNode, parent: OutlineNode | null) => void, parent: OutlineNode | null = null): void {
  visit(node, parent);
  for (const child of node.children ?? []) walkTree(child, visit, node);
}

/** A heading's inlines as an entry draws them: a link is its text, a footnote reference is gone. */
function entryContent(nodes: readonly OutlineNode[]): OutlineNode[] {
  return nodes.flatMap((node): OutlineNode[] => {
    if (node.type === 'footnoteReference') return [];
    if (node.type === 'link' || node.type === 'linkReference') return entryContent(node.children ?? []);
    if (node.children) return [{ ...node, children: entryContent(node.children) }];
    return [node];
  });
}

const processor = unified().use(remarkParse).use(readingPlugins(() => undefined));

/** A run's tree, as the page parses and transforms it. */
export function parseRun(text: string): OutlineNode {
  return processor.runSync(processor.parse(text), text) as unknown as OutlineNode;
}

/**
 * The numbers of the headings of an outline (#174): `decimal` ones counted 1, 1.1, 1.2 from the
 * highest level they reach; one the style leaves at `none` takes no number and advances no counter.
 */
export function numberHeadings(headings: readonly { readonly level: number; readonly numbering: StyleNumbering }[]): (string | null)[] {
  const numbered = headings.filter((heading) => heading.numbering === 'decimal');
  if (numbered.length === 0) return headings.map(() => null);
  const top = Math.min(...numbered.map((heading) => heading.level));
  const counters: number[] = [];
  return headings.map(({ level, numbering }) => {
    if (numbering !== 'decimal') return null;
    const depth = level - top;
    counters.length = depth + 1;
    counters[depth] = (counters[depth] ?? 0) + 1;
    return Array.from({ length: depth + 1 }, (_, index) => counters[index] ?? 0).join('.');
  });
}

/**
 * The outline of a note drawn in these runs, the text of each as it is drawn. `numberingAt` says
 * how the heading at a line of a run is numbered, as the style that reaches it says (#174).
 */
export function planOutline(
  runs: readonly string[],
  numberingAt: (run: number, line: number) => StyleNumbering = () => 'none',
  /** Whether a `table` block is drawn as a table, which it is where the host reaches tables. */
  tableBlocks = false,
): NoteOutline {
  const slugger = new Slugger();
  const found: Omit<OutlineHeading, 'number'>[] = [];
  const at: { run: number; index: number }[] = [];
  const blocks: string[] = [];
  const figureCandidates: FigureCandidate[] = [];
  const tables: TableItem[] = [];
  const kept: KeptReference[] = [];
  const planned = runs.map((text, run) => {
    const tree = parseRun(text);
    const slugs: string[] = [];
    const firstBlock = blocks.length;
    walkTree(tree, (node, parent) => {
      if (node.type === 'code' && isContentsBlock(node.lang, node.meta)) blocks.push(node.value ?? '');
      const alone = aloneIn(node);
      if (alone) figureCandidates.push({ run, ...referenceOf(alone)! });
      if (isTableNode(node, tableBlocks)) {
        if (node.type === 'code') {
          const block = readTableBlock(node.value ?? '');
          tables.push({ run, kind: 'block', caption: null, title: block.title ?? block.table });
        } else {
          const caption = captionAfter(node, parent);
          tables.push({ run, kind: 'markdown', caption: caption ? entryContent(captionContent(caption)) : null, title: null });
        }
      }
      const reference = referenceOf(node);
      if (reference?.kept) kept.push({ run, name: reference.name, title: reference.title });
      if (node.type !== 'heading') return;
      const slug = slugger.slug(textOf(node));
      slugs.push(slug);
      if (parent === tree && node.depth !== undefined) {
        found.push({ id: headingId(slug), slug, level: node.depth, content: entryContent(node.children ?? []), run, line: node.position?.start?.line ?? 1 });
        at.push({ run, index: slugs.length - 1 });
      }
    });
    return { slugs, firstBlock };
  });
  const numbers = numberHeadings(found.map((heading) => ({ level: heading.level, numbering: numberingAt(heading.run, heading.line) })));
  const perRun = planned.map((run) => run.slugs.map((): string | null => null));
  numbers.forEach((number, index) => {
    perRun[at[index]!.run]![at[index]!.index] = number;
  });
  return {
    runs: planned.map((run, index) => ({ ...run, numbers: perRun[index]! })),
    headings: found.map((heading, index) => ({ ...heading, number: numbers[index] ?? null })),
    blocks,
    figureCandidates,
    tables,
    kept,
  };
}

/** What a kept file is, as far as a figure is concerned: an image, something else, or not known yet. */
export type FileKind = 'image' | 'other' | 'pending';

export interface FigureItem {
  readonly id: string;
  readonly number: number;
  readonly kept: boolean;
  readonly name: string;
  readonly title: string | null;
}

export interface TableEntry {
  readonly id: string;
  readonly number: number;
  readonly kind: 'markdown' | 'block';
  readonly caption: readonly OutlineNode[] | null;
  readonly title: string | null;
}

export interface AttachmentItem {
  readonly id: string;
  readonly name: string;
  readonly title: string | null;
}

/** A note's figures, tables and attachments, numbered, and what each run marks of them (#175). */
export interface NoteItems {
  readonly figures: readonly FigureItem[];
  readonly tables: readonly TableEntry[];
  readonly attachments: readonly AttachmentItem[];
  readonly runs: readonly { readonly figures: readonly (number | null)[]; readonly tables: readonly number[]; readonly attachments: readonly (string | null)[] }[];
  /** Whether a candidate's file is not known yet, so the figures may still change. */
  readonly pending: boolean;
}

export const figureId = (number: number): string => `contents-figure-${number}`;
export const tableId = (number: number): string => `contents-table-${number}`;
export const attachmentId = (number: number): string => `contents-attachment-${number}`;

/**
 * Numbers a note's figures, tables and attachments (#175). An image alone in its paragraph is a
 * figure when it is remote, or when the file it names is an image, which only its media type says
 * (§5.8); an attachment is listed once, at the first reference to its name.
 */
export function planItems(outline: NoteOutline, kindOf: (name: string, form: 'image' | 'embed') => FileKind, keeps: (name: string) => boolean = () => true): NoteItems {
  const runs = outline.runs.map(() => ({ figures: [] as (number | null)[], tables: [] as number[], attachments: [] as (string | null)[] }));
  const figures: FigureItem[] = [];
  let pending = false;
  for (const candidate of outline.figureCandidates) {
    const kind = !candidate.kept ? 'image' : keeps(candidate.name) ? kindOf(candidate.name, candidate.form) : 'other';
    if (kind === 'pending') pending = true;
    if (kind !== 'image') {
      runs[candidate.run]!.figures.push(null);
      continue;
    }
    const number = figures.length + 1;
    figures.push({ id: figureId(number), number, ...candidate });
    runs[candidate.run]!.figures.push(number);
  }
  const tables = outline.tables.map((table, index): TableEntry => {
    runs[table.run]!.tables.push(index + 1);
    return { id: tableId(index + 1), number: index + 1, kind: table.kind, caption: table.caption, title: table.title };
  });
  const attachments: AttachmentItem[] = [];
  const seen = new Set<string>();
  for (const reference of outline.kept) {
    if (seen.has(reference.name) || !keeps(reference.name)) {
      runs[reference.run]!.attachments.push(null);
      continue;
    }
    seen.add(reference.name);
    const id = attachmentId(attachments.length + 1);
    attachments.push({ id, name: reference.name, title: reference.title });
    runs[reference.run]!.attachments.push(id);
  }
  return { figures, tables, attachments, runs, pending };
}

/**
 * The remark plugin that gives the headings of a run their ids and numbers its `contents` blocks.
 * Handed the run's slugs, it gives each heading its id and its slug; with none it counts its own,
 * for a note drawn in one run, and with `ids: false` — inside an embed — gives the slug alone.
 */
export function remarkOutline(
  options: {
    slugs?: readonly string[] | null;
    numbers?: readonly (string | null)[] | null;
    ids?: boolean;
    firstBlock?: number;
    /** Each image alone in its paragraph: its figure's number, or `null` (#175). */
    figures?: readonly (number | null)[] | null;
    /** Each table's number (#175). */
    tables?: readonly number[] | null;
    /** Each kept file's reference: the id of its first, or `null` (#175). */
    attachments?: readonly (string | null)[] | null;
    /** Whether a `table` block is a table, as the plan counted them. */
    tableBlocks?: boolean;
  } = {},
) {
  return (tree: OutlineNode): void => {
    const own = options.slugs ? null : new Slugger();
    let heading = 0;
    let block = options.firstBlock ?? 0;
    let figure = 0;
    let table = 0;
    let reference = 0;
    const mark = (node: OutlineNode, properties: Record<string, unknown>): void => {
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...properties } };
    };
    walkTree(tree, (node, parent) => {
      if (node.type === 'code' && isContentsBlock(node.lang, node.meta)) {
        mark(node, { dataContents: block++ });
        return;
      }
      // An image alone in its paragraph that is a figure carries its id, and its caption's place (#175).
      if (aloneIn(node)) {
        const number = options.figures?.[figure++] ?? null;
        if (number !== null) {
          mark(node, { id: figureId(number), className: ['figure'] });
          node.children!.push({ type: 'msCaption', data: { hName: 'ms-caption', hProperties: { dataKind: 'figure', dataNumber: number } }, children: [] });
        }
      }
      if (isTableNode(node, options.tableBlocks ?? false)) {
        const number = options.tables?.[table++];
        if (node.type === 'code') {
          if (number !== undefined) mark(node, { dataTable: number });
          return;
        }
        if (number !== undefined) mark(node, { id: tableId(number) });
        // Its caption, `Table: …`, is drawn without the keyword, and where none is written the place
        // for its number (#175).
        const caption = captionAfter(node, parent);
        const properties = { dataKind: 'table', ...(number !== undefined ? { dataNumber: number } : {}) };
        if (caption) {
          caption.children = captionContent(caption);
          caption.type = 'msCaption';
          caption.data = { ...caption.data, hName: 'ms-caption', hProperties: properties };
        } else if (number !== undefined && parent?.children) {
          parent.children.splice(parent.children.indexOf(node) + 1, 0, { type: 'msCaption', data: { hName: 'ms-caption', hProperties: properties }, children: [] });
        }
        return;
      }
      if (referenceOf(node)?.kept) {
        const id = options.attachments?.[reference++] ?? null;
        // The first reference to a file is where its entry leads (#175).
        if (id !== null && parent?.children) {
          const index = parent.children.indexOf(node);
          parent.children[index] = { type: 'msAnchor', data: { hName: 'span', hProperties: { id, className: ['attachment-anchor'] } }, children: [node] };
        }
        return;
      }
      if (node.type !== 'heading') return;
      const slug = own ? own.slug(textOf(node)) : options.slugs?.[heading];
      const number = own ? null : (options.numbers?.[heading] ?? null);
      heading++;
      if (slug === undefined) return;
      const properties: Record<string, unknown> = { dataHeading: slug };
      if (number !== null) properties['dataNumber'] = number;
      if (options.ids !== false) properties['id'] = headingId(slug);
      mark(node, properties);
    });
  };
}
