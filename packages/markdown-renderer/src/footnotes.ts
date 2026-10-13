/**
 * Footnotes across the runs of a note (§7.12).
 *
 * `NoteBody` draws the text between two embeds as runs of their own, each
 * through its own parser, and a footnote is resolved inside one parse: GFM
 * reads `[^label]` as a reference only when the same document defines
 * `label`. A reference above an embed and its definition below it therefore
 * never met, and the reference reached the page as its characters. MemorySmith's
 * reading page does the same; this renderer does not carry it.
 *
 * The runs stay runs — they are what keeps the task ordinals and the layout
 * of every other note as MemorySmith draws them — and the note is drawn as one
 * document would draw it:
 *
 * - every run is handed the definitions written in the OTHER runs, appended
 *   after its own text, so its references parse; appending after the text
 *   moves no offset the task boxes are counted from;
 * - each run's own footnotes section is dropped, and each reference is
 *   renumbered in the order of the note, with the id one document would give
 *   its n-th use of a label;
 * - one section is drawn at the end of the note, after its last embed too,
 *   from every reference of the note in order and every definition, so its
 *   numbers and its ways back are the ones a single document would have.
 *
 * Only a definition written at the top level of a run travels. A note with
 * one inside a quote or a list, with no embed, or with no definition, is
 * planned as nothing and drawn exactly as before.
 */

import remarkParse from 'remark-parse';
import { unified, type PluggableList } from 'unified';

/** The prefix remark-rehype gives every footnote id, set explicitly where `Markdown` draws. */
export const CLOBBER_PREFIX = 'user-content-';

interface Node {
  type: string;
  identifier?: string;
  label?: string;
  children?: Node[];
  position?: { start?: { offset?: number }; end?: { offset?: number } };
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** One reference as the note numbers it: its footnote's number, and which use of the label it is. */
export interface FootnoteRef {
  readonly number: number;
  readonly occurrence: number;
}

export interface FootnotePlan {
  /** For each run, in order: the text its parser reads, and its references in the order it draws them. */
  readonly runs: readonly { readonly text: string; readonly refs: readonly FootnoteRef[] }[];
  /** The text the one footnotes section of the note is drawn from. */
  readonly section: string;
}

/** What one document would key a label by: remark-rehype's own normalisation. */
const keyOf = (node: Node): string => String(node.identifier ?? '').toUpperCase();

/**
 * How the runs of a note draw their footnotes, or null when nothing has to
 * change: a note no embed cuts, or one with no footnote to carry. `cut` says
 * whether an embed cut it — a note of one run followed by an embed is cut
 * too, because its notes belong below the embed, at the end of the note.
 *
 * `plugins` are the remark plugins of `Markdown`, so a reference the reading
 * surface would not draw — inside a comment, say — is not counted either.
 */
export function planFootnotes(runs: readonly string[], cut: boolean, plugins: PluggableList): FootnotePlan | null {
  if (!cut || !runs.some((run) => run.includes('[^'))) return null;
  const processor = unified().use(remarkParse).use(plugins);
  const read = (text: string): Node => processor.runSync(processor.parse(text), text) as Node;

  // The definitions, the first of each label winning, as in one document.
  const definitions = new Map<string, { source: string; run: number }>();
  let nested = false;
  runs.forEach((run, index) => {
    const tree = processor.parse(run) as Node;
    const below = (node: Node): boolean =>
      (node.children ?? []).some((child) => child.type === 'footnoteDefinition' || below(child));
    nested ||= (tree.children ?? []).some(below);
    for (const child of tree.children ?? []) {
      const start = child.position?.start?.offset;
      const end = child.position?.end?.offset;
      if (child.type !== 'footnoteDefinition' || start === undefined || end === undefined) continue;
      if (!definitions.has(keyOf(child))) definitions.set(keyOf(child), { source: run.slice(start, end), run: index });
    }
  });
  // A definition inside a quote or a list cannot be lifted into the section
  // without its markers, so a note that has one is drawn as before.
  if (definitions.size === 0 || nested) return null;

  const order: string[] = [];
  const uses = new Map<string, number>();
  const labels: string[] = [];
  const planned = runs.map((run, index) => {
    const others = [...definitions.values()].filter((definition) => definition.run !== index);
    const text = others.length === 0 ? run : `${run}\n\n${others.map((definition) => definition.source).join('\n\n')}\n`;
    const refs: FootnoteRef[] = [];
    const walk = (node: Node): void => {
      // A reference inside a definition is drawn in the section, after every
      // reference of the body, which is where the section pass meets it.
      if (node.type === 'footnoteDefinition') return;
      if (node.type === 'footnoteReference') {
        const key = keyOf(node);
        if (!order.includes(key)) order.push(key);
        const occurrence = (uses.get(key) ?? 0) + 1;
        uses.set(key, occurrence);
        labels.push(node.label ?? node.identifier ?? '');
        refs.push({ number: order.indexOf(key) + 1, occurrence });
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(read(text));
    return { text, refs };
  });
  if (order.length === 0) return null;

  const section = `${labels.map((label) => `[^${label}]`).join(' ')}\n\n${[...definitions.values()]
    .map((definition) => definition.source)
    .join('\n\n')}\n`;
  return { runs: planned, section };
}

function isElement(node: HastNode, tagName: string): boolean {
  return node.type === 'element' && node.tagName === tagName;
}

const isSection = (node: HastNode): boolean => isElement(node, 'section') && node.properties?.dataFootnotes !== undefined;

/**
 * The rehype side of a run: its own section dropped, and each reference given
 * the number and the id the note gives it.
 */
export function rehypeFootnoteRun(options: { refs: readonly FootnoteRef[] }) {
  return (tree: HastNode): void => {
    tree.children = (tree.children ?? []).filter((child) => !isSection(child));
    let index = 0;
    const walk = (node: HastNode): void => {
      if (isElement(node, 'a') && node.properties?.dataFootnoteRef !== undefined) {
        const ref = options.refs[index++];
        const href = String(node.properties.href ?? '');
        if (ref && href.startsWith(`#${CLOBBER_PREFIX}fn-`)) {
          const safe = href.slice(`#${CLOBBER_PREFIX}fn-`.length);
          node.properties.id = `${CLOBBER_PREFIX}fnref-${safe}${ref.occurrence > 1 ? `-${ref.occurrence}` : ''}`;
          node.children = [{ type: 'text', value: String(ref.number) }];
        }
        return;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}

/** The rehype side of the section pass: the section and nothing else. */
export function rehypeFootnoteSection() {
  return (tree: HastNode): void => {
    tree.children = (tree.children ?? []).filter(isSection);
  };
}
