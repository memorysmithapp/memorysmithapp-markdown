/**
 * A `contents` block written from the editor's form (`SPEC.md` §7.17, #173): its settings as the
 * block's lines, the block the cursor is in, and the changes that write it. No React and no DOM.
 */

import { CONTENTS_LISTS, CONTENTS_MEDIA, readContents, type ContentsLayer, type ContentsListOptions, type ContentsSettings } from '../contents.js';
import { analyze } from './analyze.js';
import type { TextChange } from './table.js';

/** A `contents` block of the note, by offsets: the whole fence, and the lines between its fences. */
export interface ContentsBlockSpan {
  readonly from: number;
  readonly to: number;
  /** The lines between the fences, empty for an empty block; `null` for a fence never closed. */
  readonly content: { readonly from: number; readonly to: number } | null;
  readonly settings: ContentsSettings;
}

/** Every `contents` block of the note, in order. */
export function contentsBlocks(text: string): ContentsBlockSpan[] {
  return analyze(text).constructs.flatMap((construct) => {
    if (construct.kind !== 'code' || construct.language !== 'contents' || !construct.open) return [];
    const fence = text.slice(construct.open.from, construct.open.to);
    if (!/^\s*(`{3,}|~{3,})\s*contents\s*$/.test(fence)) return [];
    const from = construct.open.to + 1;
    const content = construct.close ? { from: Math.min(from, construct.close.from), to: construct.close.from } : null;
    return [{ from: construct.from, to: construct.to, content, settings: readContents(construct.code).settings }];
  });
}

/** The `contents` block that holds an offset, its fences included, or `null`. */
export function contentsBlockAt(text: string, at: number): ContentsBlockSpan | null {
  return contentsBlocks(text).find((block) => block.from <= at && at <= block.to) ?? null;
}

function listLines(options: ContentsListOptions | null | undefined, indent: string): string[] {
  const lines: string[] = [];
  if (options?.title) lines.push(`${indent}title: ${options.title}`);
  if (options?.depth !== undefined) lines.push(`${indent}depth: ${options.depth}`);
  return lines;
}

/** The lines of one layer: each list that sets something, and `place`. */
function layerLines(layer: ContentsLayer, indent: string, all: boolean): string[] {
  const lines: string[] = [];
  for (const kind of CONTENTS_LISTS) {
    if (!(kind in layer)) continue;
    const options = listLines(layer[kind], `${indent}  `);
    // A list with nothing to say is written only where it chooses the lists, beside others.
    if (options.length > 0 || all || kind !== 'headings') lines.push(`${indent}${kind}:`, ...options);
  }
  if (layer.place) lines.push(`${indent}place: ${layer.place}`);
  return lines;
}

/**
 * The lines a block writes for its settings: only what they set, the root first, then `screen`
 * and `print`. Settings that set nothing are an empty block, which is the classic contents.
 */
export function contentsText(settings: ContentsSettings): string {
  const lists = (layer: ContentsLayer) => CONTENTS_LISTS.filter((kind) => kind in layer).length;
  const lines = layerLines(settings, '', lists(settings) > 1);
  for (const medium of CONTENTS_MEDIA) {
    const layer = settings[medium];
    if (layer === 'none') lines.push(`${medium}: none`);
    else if (layer) {
      // A medium that names its lists names each, the headings alone included.
      const inner = layerLines(layer, '  ', true);
      if (inner.length > 0) lines.push(`${medium}:`, ...inner);
    }
  }
  return lines.map((line) => `${line}\n`).join('');
}

/** Rewrites the lines of a block to `settings`, its fences kept. */
export function setContents(block: ContentsBlockSpan, settings: ContentsSettings): TextChange[] {
  if (!block.content) return [];
  return [{ from: block.content.from, to: block.content.to, insert: contentsText(settings) }];
}

/** A new block of these settings, as the editor inserts it on a line of its own. */
export function newContentsBlock(settings: ContentsSettings): string {
  return `\`\`\`contents\n${contentsText(settings)}\`\`\``;
}
