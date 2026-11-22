/**
 * A `properties` block written from the editor's form (`SPEC.md` §7.18, #172): its settings as the
 * block's lines, and the block the cursor is in. No React and no DOM.
 */

import { CONTENTS_MEDIA } from '../contents.js';
import { readPropertiesBlock, type PropertiesLayer, type PropertiesSettings } from '../properties-block.js';
import { analyze } from './analyze.js';
import type { TextChange } from './table.js';

/** A `properties` block of the note, by offsets, with the lines between its fences. */
export interface PropertiesBlockSpan {
  readonly from: number;
  readonly to: number;
  readonly content: { readonly from: number; readonly to: number } | null;
  readonly settings: PropertiesSettings;
}

/** Every `properties` block of the note, in order. */
export function propertiesBlocks(text: string): PropertiesBlockSpan[] {
  return analyze(text).constructs.flatMap((construct) => {
    if (construct.kind !== 'code' || construct.language !== 'properties' || !construct.open) return [];
    if (!/^\s*(`{3,}|~{3,})\s*properties\s*$/.test(text.slice(construct.open.from, construct.open.to))) return [];
    const from = construct.open.to + 1;
    const content = construct.close ? { from: Math.min(from, construct.close.from), to: construct.close.from } : null;
    return [{ from: construct.from, to: construct.to, content, settings: readPropertiesBlock(construct.code).settings }];
  });
}

/** The `properties` block that holds an offset, its fences included, or `null`. */
export function propertiesBlockAt(text: string, at: number): PropertiesBlockSpan | null {
  return propertiesBlocks(text).find((block) => block.from <= at && at <= block.to) ?? null;
}

function layerLines(layer: PropertiesLayer, indent: string): string[] {
  const lines: string[] = [];
  if (layer.keys && layer.keys.length > 0) lines.push(`${indent}keys: ${layer.keys.join(', ')}`);
  if (layer.title) lines.push(`${indent}title: ${layer.title}`);
  if (layer.fold) lines.push(`${indent}fold: ${layer.fold}`);
  if (layer.place) lines.push(`${indent}place: ${layer.place}`);
  return lines;
}

/** The lines a block writes for its settings: only what they set, the root first, then the media. */
export function propertiesText(settings: PropertiesSettings): string {
  const lines = layerLines(settings, '');
  for (const medium of CONTENTS_MEDIA) {
    const layer = settings[medium];
    if (layer === 'none') lines.push(`${medium}: none`);
    else if (layer) {
      const inner = layerLines(layer, '  ');
      if (inner.length > 0) lines.push(`${medium}:`, ...inner);
    }
  }
  return lines.map((line) => `${line}\n`).join('');
}

/** Rewrites the lines of a block to `settings`, its fences kept. */
export function setProperties(block: PropertiesBlockSpan, settings: PropertiesSettings): TextChange[] {
  if (!block.content) return [];
  return [{ from: block.content.from, to: block.content.to, insert: propertiesText(settings) }];
}

/** A new block of these settings, as the editor inserts it on a line of its own. */
export function newPropertiesBlock(settings: PropertiesSettings): string {
  return `\`\`\`properties\n${propertiesText(settings)}\`\`\``;
}
