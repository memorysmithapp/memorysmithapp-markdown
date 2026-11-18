/**
 * The tables of a printed note as appendices at its end (#165, memorysmithapp/memorysmithapp#494).
 *
 * When the host prints with `tablesAsAppendices`, each table of the note — a Markdown table, and a
 * `table` block where the host reaches the tables — gives its place to a reference to its appendix,
 * and the appendices follow the note, in the order the tables appear, numbered in one sequence
 * across both kinds. A Markdown table has no name, so it is also counted among the Markdown tables,
 * which is what its title says in place of a name.
 *
 * The note is drawn in runs, each parsed on its own (`NoteBody`), so the plan is made once over every
 * run, as the footnotes' is, and each run is told the number its first table takes. The run finds
 * its tables again with the same predicate, in the same order, while it is drawn, and puts the
 * reference in their place; the appendix draws the table again from its own Markdown, which prints
 * as a table of its kind prints. The note's own tables only: an embedded note draws its tables in
 * place, as it draws everything else.
 */

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { isTableBlock, readTableBlock } from './table-block.js';

/** A table printed as an appendix, as the host's words receive it. */
export interface TableAppendix {
  /** Its place among the appendices of the note, from 1. */
  readonly number: number;
  /** The table a `table` block names, or `null` for a Markdown table. */
  readonly table: string | null;
  /** Its place among the note's Markdown tables, from 1, or `null` for a `table` block. */
  readonly markdownTable: number | null;
}

/** An appendix and the Markdown that draws its table. */
export interface PlannedAppendix extends TableAppendix {
  readonly source: string;
}

export interface AppendixPlan {
  /** The number the first table of each run takes, in the order of the runs. */
  readonly first: readonly number[];
  readonly appendices: readonly PlannedAppendix[];
}

interface Node {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  url?: string;
  children?: Node[];
  position?: { start: { offset?: number; column: number }; end: { offset?: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** Whether a node is a table the note draws: a Markdown table, or a `table` block where tables are reached. */
function isAppendixTable(node: Node, blocks: boolean): boolean {
  return node.type === 'table' || (blocks && node.type === 'code' && isTableBlock(node.lang, node.meta));
}

/** Each table of a tree, in the order they are read, never one inside another's place. */
function tablesOf(tree: Node, blocks: boolean): { node: Node; parent: Node; index: number }[] {
  const found: { node: Node; parent: Node; index: number }[] = [];
  const walk = (parent: Node): void => {
    (parent.children ?? []).forEach((node, index) => {
      if (isAppendixTable(node, blocks)) found.push({ node, parent, index });
      else walk(node);
    });
  };
  walk(tree);
  return found;
}

const parser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false });

/**
 * The appendices of a note drawn in `runs`: each table found in each run, numbered across them.
 * `blocks` is whether a `table` block is drawn as a table, which it is where the host reaches tables.
 */
export function planAppendices(runs: readonly string[], blocks: boolean): AppendixPlan {
  const first: number[] = [];
  const appendices: PlannedAppendix[] = [];
  let markdownTables = 0;
  for (const text of runs) {
    first.push(appendices.length + 1);
    for (const { node } of tablesOf(parser.parse(text) as Node, blocks)) {
      const number = appendices.length + 1;
      if (node.type === 'code') {
        appendices.push({ number, table: readTableBlock(node.value ?? '').table, markdownTable: null, source: fenced(node.value ?? '') });
      } else {
        markdownTables += 1;
        appendices.push({ number, table: null, markdownTable: markdownTables, source: sliceOf(text, node) });
      }
    }
  }
  return { first, appendices };
}

/** A `table` block's lines in a fence of their own, longer than any run of backticks they hold. */
function fenced(value: string): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}table\n${value}\n${fence}\n`;
}

/**
 * A Markdown table's lines, out of the quote, callout or list item that holds it: each line after
 * the first loses the prefix of its container, which is as wide as the table's first column is far
 * from the margin.
 */
function sliceOf(text: string, node: Node): string {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? text.length;
  const indent = (node.position?.start.column ?? 1) - 1;
  const lines = text.slice(start, end).split('\n');
  return `${lines.map((line, index) => (index === 0 || !/^[ \t>]*$/.test(line.slice(0, indent)) ? line : line.slice(indent))).join('\n')}\n`;
}

/** The id of an appendix, which its reference points at and a host's `target-counter()` reads. */
export const appendixId = (number: number): string => `table-appendix-${number}`;

/**
 * Puts a reference to its appendix in place of each table of a run: the paragraph `table-reference`,
 * holding a link to the appendix in the host's words.
 */
export function remarkTableReferences(options: {
  readonly first: number;
  readonly blocks: boolean;
  readonly appendices: readonly TableAppendix[];
  readonly words: (appendix: TableAppendix) => string;
}) {
  return (tree: unknown): void => {
    tablesOf(tree as Node, options.blocks).forEach(({ parent, index }, offset) => {
      const appendix = options.appendices[options.first - 1 + offset];
      if (!appendix || !parent.children) return;
      parent.children[index] = {
        type: 'paragraph',
        data: { hName: 'p', hProperties: { className: ['table-reference'] } },
        children: [{ type: 'link', url: `#${appendixId(appendix.number)}`, children: [{ type: 'text', value: options.words(appendix) }] }],
      };
    });
  };
}
