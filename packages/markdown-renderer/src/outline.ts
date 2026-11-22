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

/** A node of the tree as much as is read here. */
export interface OutlineNode {
  readonly type: string;
  readonly depth?: number;
  readonly value?: string;
  readonly position?: { readonly start?: { readonly line?: number } };
  readonly lang?: string | null;
  readonly meta?: string | null;
  readonly url?: string;
  readonly alt?: string | null;
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
}

export interface OutlineRun {
  /** The slug of every heading of the run, in the order a walk of its tree meets them. */
  readonly slugs: readonly string[];
  /** The number of each of those headings, `null` for one the style does not number (#174). */
  readonly numbers?: readonly (string | null)[];
  /** The ordinal of its first `contents` block among the note's. */
  readonly firstBlock: number;
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
export function planOutline(runs: readonly string[], numberingAt: (run: number, line: number) => StyleNumbering = () => 'none'): NoteOutline {
  const slugger = new Slugger();
  const found: Omit<OutlineHeading, 'number'>[] = [];
  const at: { run: number; index: number }[] = [];
  const blocks: string[] = [];
  const planned = runs.map((text, run) => {
    const tree = parseRun(text);
    const slugs: string[] = [];
    const firstBlock = blocks.length;
    walkTree(tree, (node, parent) => {
      if (node.type === 'code' && isContentsBlock(node.lang, node.meta)) blocks.push(node.value ?? '');
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
  };
}

/**
 * The remark plugin that gives the headings of a run their ids and numbers its `contents` blocks.
 * Handed the run's slugs, it gives each heading its id and its slug; with none it counts its own,
 * for a note drawn in one run, and with `ids: false` — inside an embed — gives the slug alone.
 */
export function remarkOutline(options: { slugs?: readonly string[] | null; numbers?: readonly (string | null)[] | null; ids?: boolean; firstBlock?: number } = {}) {
  return (tree: OutlineNode): void => {
    const own = options.slugs ? null : new Slugger();
    let heading = 0;
    let block = options.firstBlock ?? 0;
    walkTree(tree, (node) => {
      if (node.type === 'code' && isContentsBlock(node.lang, node.meta)) {
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, dataContents: block++ } };
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
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...properties } };
    });
  };
}
