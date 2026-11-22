/**
 * The `properties` block (`SPEC.md` §7.18, #172): how a note's properties are drawn — which keys,
 * under which title, folded or open, and where — read and resolved, with no React and no DOM.
 *
 * It shares the `contents` block's grammar and its host settings' shape (`contents.ts`): options at
 * the root apply to every medium, `screen` and `print` groups override them for theirs or draw
 * nothing there with `none`, and the host's settings, `NoteHost.properties`, are the defaults of
 * whatever a block leaves unset, `place` excepted. A note with no block draws its properties at the
 * top, as it always did, unless the host's settings say otherwise.
 */

import { CONTENTS_MEDIA, type ContentsMedium, type ContentsPlace } from './contents.js';

/** The options of one layer of a `properties` block. */
export interface PropertiesLayer {
  /** The keys drawn, in this order; the rest are not drawn. Absent, every key, the reserved first. */
  readonly keys?: readonly string[];
  /** The title of the drawing; absent, the theme's. */
  readonly title?: string;
  /** Whether the drawing starts folded; absent, the theme's. */
  readonly fold?: 'open' | 'closed';
  /** Where it is drawn when not where its block is written, or, for the host, where at all. */
  readonly place?: ContentsPlace;
}

/** The settings of a `properties` block, as a block writes them and as a host gives them. */
export type PropertiesSettings = PropertiesLayer & {
  readonly screen?: PropertiesLayer | 'none';
  readonly print?: PropertiesLayer | 'none';
};

/** The codes a `properties` block raises (§7.13). */
export type PropertiesNoticeCode = 'properties-key-unknown' | 'properties-value-invalid';

export interface PropertiesProblem {
  readonly code: PropertiesNoticeCode;
  readonly line: number;
}

/** Whether a fenced block is a `properties` block: its info string is `properties` and nothing else. */
export function isPropertiesBlock(lang: string | null | undefined, meta: string | null | undefined): boolean {
  return lang === 'properties' && (meta ?? '').trim() === '';
}

const OPTIONS = ['keys', 'title', 'fold', 'place'] as const;
type Option = (typeof OPTIONS)[number];
const isOption = (key: string): key is Option => (OPTIONS as readonly string[]).includes(key);
const isMedium = (key: string): key is ContentsMedium => (CONTENTS_MEDIA as readonly string[]).includes(key);

/** A list of keys as written: `a, b`, or `[a, b]`, each trimmed and unquoted. */
function keysOf(value: string): string[] {
  const inner = value.trim().replace(/^\[(.*)\]$/, '$1');
  return inner
    .split(',')
    .map((key) => key.trim().replace(/^(['"])(.*)\1$/, '$2').trim())
    .filter((key) => key !== '');
}

/** Reads one option's value; `undefined` for a value its key cannot take. */
function optionOf(key: Option, value: string): unknown {
  if (key === 'keys') return keysOf(value);
  if (key === 'title') return value;
  const folded = value.toLowerCase();
  if (key === 'fold') return folded === 'open' || folded === 'closed' ? folded : undefined;
  return folded === 'start' || folded === 'end' ? folded : undefined;
}

/**
 * Reads the lines of a `properties` block into its settings, and what is wrong with them. A
 * mistake sets nothing and the rest is read.
 */
export function readPropertiesBlock(source: string): { settings: PropertiesSettings; problems: PropertiesProblem[] } {
  const settings: Record<string, unknown> = {};
  const problems: PropertiesProblem[] = [];
  let medium: { keyIndent: number; childIndent: number | null; target: Record<string, unknown> } | null = null;
  let rootIndent: number | null = null;
  source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      const line = index + 1;
      if (raw.trim() === '') return;
      const problem = (code: PropertiesNoticeCode): void => {
        problems.push({ code, line });
      };
      const indentText = /^[ \t]*/.exec(raw)![0];
      if (indentText.includes('\t')) return problem('properties-key-unknown');
      const indent = indentText.length;
      if (medium && indent <= medium.keyIndent) medium = null;
      let target = settings;
      if (medium) {
        if (medium.childIndent === null) medium.childIndent = indent;
        else if (indent !== medium.childIndent) return problem('properties-key-unknown');
        target = medium.target;
      } else if (rootIndent === null) rootIndent = indent;
      else if (indent !== rootIndent) return problem('properties-key-unknown');
      const match = /^([^:]+):(.*)$/.exec(raw.trim());
      if (!match) return problem('properties-key-unknown');
      const key = match[1]!.trim().toLowerCase();
      const value = match[2]!.trim();
      if (Object.hasOwn(target, key)) return problem('properties-key-unknown');
      if (isOption(key)) {
        if (value === '') {
          target[key] = undefined;
          return;
        }
        const read = optionOf(key, value);
        if (read === undefined) problem('properties-value-invalid');
        else target[key] = read;
        return;
      }
      if (isMedium(key) && target === settings) {
        if (value.toLowerCase() === 'none') {
          settings[key] = 'none';
          return;
        }
        if (value !== '') return problem('properties-value-invalid');
        const layer: Record<string, unknown> = {};
        settings[key] = layer;
        medium = { keyIndent: indent, childIndent: null, target: layer };
        return;
      }
      problem('properties-key-unknown');
    });
  return { settings: cleanProperties(settings) ?? {}, problems };
}

/** Settings with only what they can mean: a host's, read from YAML or JSON, or a block's. */
export function cleanProperties(given: unknown, medium = false): PropertiesSettings | null {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) return null;
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(given)) {
    const key = rawKey.toLowerCase();
    if (key === 'keys') {
      const keys = Array.isArray(value) ? value.map(String).map((each) => each.trim()).filter(Boolean) : typeof value === 'string' ? keysOf(value) : [];
      if (keys.length > 0) out['keys'] = keys;
    } else if (key === 'title' && typeof value === 'string' && value.trim() !== '') out['title'] = value.trim();
    else if ((key === 'fold' || key === 'place') && typeof value === 'string') {
      const read = optionOf(key, value);
      if (read !== undefined) out[key] = read;
    } else if (isMedium(key) && !medium) {
      if (String(value).toLowerCase() === 'none') out[key] = 'none';
      else if (value === null || value === undefined || value === '') out[key] = {};
      else {
        const layer = cleanProperties(value, true);
        if (layer) out[key] = layer;
      }
    }
  }
  return out as PropertiesSettings;
}

/** What a note's properties draw in one medium, and where: `null` is where its block is written. */
export interface PropertiesPlan {
  readonly keys: readonly string[] | null;
  readonly title: string | null;
  readonly fold: 'open' | 'closed' | null;
  readonly place: ContentsPlace | null;
}

function optionAt<K extends Exclude<Option, 'place'>>(layers: readonly (PropertiesLayer | 'none' | undefined)[], key: K): PropertiesLayer[K] | undefined {
  for (const layer of layers) {
    if (!layer || layer === 'none') continue;
    if (layer[key] !== undefined) return layer[key];
  }
  return undefined;
}

function plan(layers: readonly (PropertiesLayer | 'none' | undefined)[], place: ContentsPlace | null): PropertiesPlan {
  return { keys: optionAt(layers, 'keys') ?? null, title: optionAt(layers, 'title') ?? null, fold: optionAt(layers, 'fold') ?? null, place };
}

/**
 * What a note's block draws in a medium, over the host's settings: `null` where the block says
 * `none`. Each option is the nearest that sets it; `place` is the block's own, never the host's.
 */
export function resolvePropertiesBlock(block: PropertiesSettings, host: PropertiesSettings | null, medium: ContentsMedium): PropertiesPlan | null {
  const noteMedium = block[medium];
  if (noteMedium === 'none') return null;
  const layers = [noteMedium, block, host?.[medium], host ?? undefined];
  return plan(layers, noteMedium?.place ?? block.place ?? null);
}

/**
 * What a note with no block draws in a medium: its properties at the start, as always, unless the
 * host's settings say where, which keys, or `none`.
 */
export function resolvePropertiesHost(host: PropertiesSettings | null, medium: ContentsMedium): PropertiesPlan | null {
  const hostMedium = host?.[medium];
  if (hostMedium === 'none') return null;
  return plan([hostMedium, host ?? undefined], hostMedium?.place ?? host?.place ?? 'start');
}
