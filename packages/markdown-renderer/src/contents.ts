/**
 * The `contents` block (`SPEC.md` §7.17, #173): a table of contents the note declares, read and
 * resolved, with no React and no DOM, so `diagnose` reads it on a server as the page does.
 *
 * A block holds settings in YAML's shape — a key alone on its line opens a group, the `key: value`
 * lines indented below it belong to it — so the host's settings, `NoteHost.contents`, are the same
 * structure a YAML parser gives, and one resolution reads both: the note's medium group, its root,
 * the host's medium group, its root, the default. `place` is the one value not inherited: a note's
 * block with none is drawn where it is written.
 */

/** The lists a contents block draws, each a group of its settings. */
export const CONTENTS_LISTS = ['headings'] as const;
export type ContentsList = (typeof CONTENTS_LISTS)[number];

/** The media a contents block tells apart. */
export const CONTENTS_MEDIA = ['screen', 'print'] as const;
export type ContentsMedium = (typeof CONTENTS_MEDIA)[number];

/** Where a contents is drawn when it is not where its block is written. */
export type ContentsPlace = 'start' | 'end';

/** The options of one list. */
export interface ContentsListOptions {
  /** The title above the list; absent, the host's word for the kind. */
  readonly title?: string;
  /** How many heading levels are listed, from 1 to 6. Only `headings` takes it. */
  readonly depth?: number;
}

/** The settings of one medium, or of the root: the lists, in their order, and where. */
export type ContentsLayer = { readonly [kind in ContentsList]?: ContentsListOptions | null } & {
  readonly place?: ContentsPlace;
};

/**
 * The settings of a contents, as a block writes them and as a host gives them: the lists at the
 * root apply to every medium, and `screen` and `print` override them for theirs, or draw nothing
 * there with `none`.
 */
export type ContentsSettings = ContentsLayer & {
  readonly screen?: ContentsLayer | 'none';
  readonly print?: ContentsLayer | 'none';
};

/** The codes a `contents` block raises (§7.13). */
export type ContentsNoticeCode = 'contents-key-unknown' | 'contents-value-invalid';

/** One mistake of a block: its code and the line of the block it is on, 1 being the line after the fence. */
export interface ContentsProblem {
  readonly code: ContentsNoticeCode;
  readonly line: number;
}

/** The default depth of the headings list. */
export const CONTENTS_DEPTH = 3;

/** Whether a fenced block is a `contents` block: its info string is `contents` and nothing else. */
export function isContentsBlock(lang: string | null | undefined, meta: string | null | undefined): boolean {
  return lang === 'contents' && (meta ?? '').trim() === '';
}

type Mutable<T> = { -readonly [key in keyof T]: T[key] };

interface Group {
  readonly kind: 'root' | 'medium' | 'list';
  /** The indent of the line that opened it; the root's is below any. */
  readonly keyIndent: number;
  /** The indent of its lines, set by the first of them. */
  childIndent: number | null;
  /** What it sets, which the reading fills in. */
  readonly target: Record<string, unknown>;
  /** The list it is, for its options. */
  readonly list?: ContentsList;
}

const isList = (key: string): key is ContentsList => (CONTENTS_LISTS as readonly string[]).includes(key);
const isMedium = (key: string): key is ContentsMedium => (CONTENTS_MEDIA as readonly string[]).includes(key);

/**
 * Reads the lines of a `contents` block into its settings, and what is wrong with them. A mistake
 * sets nothing and the rest is read: a block always draws, with its defaults where it said nothing
 * that could be read.
 */
export function readContents(source: string): { settings: ContentsSettings; problems: ContentsProblem[] } {
  const settings: Record<string, unknown> = {};
  const problems: ContentsProblem[] = [];
  const stack: Group[] = [{ kind: 'root', keyIndent: -1, childIndent: null, target: settings }];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '') return;
    const problem = (code: ContentsNoticeCode): void => {
      problems.push({ code, line });
    };
    const indentText = /^[ \t]*/.exec(raw)![0];
    if (indentText.includes('\t')) return problem('contents-key-unknown');
    const indent = indentText.length;
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.keyIndent) stack.pop();
    const group = stack[stack.length - 1]!;
    if (group.childIndent === null) group.childIndent = indent;
    else if (indent !== group.childIndent) return problem('contents-key-unknown');
    const match = /^([^:]+):(.*)$/.exec(raw.trim());
    if (!match) return problem('contents-key-unknown');
    const key = match[1]!.trim().toLowerCase();
    const value = match[2]!.trim();
    if (Object.hasOwn(group.target, key)) return problem('contents-key-unknown');

    if (group.kind === 'list') {
      if (key === 'title') {
        if (value !== '') group.target['title'] = value;
        else group.target['title'] = undefined;
        return;
      }
      if (key === 'depth' && group.list === 'headings') {
        const depth = /^[1-6]$/.test(value) ? Number(value) : null;
        if (value === '') group.target['depth'] = undefined;
        else if (depth === null) problem('contents-value-invalid');
        else group.target['depth'] = depth;
        return;
      }
      return problem('contents-key-unknown');
    }
    if (key === 'place') {
      const place = value.toLowerCase();
      if (place === 'start' || place === 'end') group.target['place'] = place;
      else if (value === '') group.target['place'] = undefined;
      else problem('contents-value-invalid');
      return;
    }
    if (isList(key)) {
      if (value !== '') return problem('contents-value-invalid');
      const options: Record<string, unknown> = {};
      group.target[key] = options;
      stack.push({ kind: 'list', keyIndent: indent, childIndent: null, target: options, list: key });
      return;
    }
    if (isMedium(key) && group.kind === 'root') {
      if (value.toLowerCase() === 'none') {
        group.target[key] = 'none';
        return;
      }
      if (value !== '') return problem('contents-value-invalid');
      const layer: Record<string, unknown> = {};
      group.target[key] = layer;
      stack.push({ kind: 'medium', keyIndent: indent, childIndent: null, target: layer });
      return;
    }
    problem('contents-key-unknown');
  });
  return { settings: clean(settings) ?? {}, problems };
}

/**
 * Settings with only what they can mean: a host's, read from YAML or JSON, or a block's. An empty
 * group (`headings:`) is a list with its defaults, and anything else is left out.
 */
export function cleanContents(given: unknown): ContentsSettings | null {
  return clean(given);
}

function clean(given: unknown, medium = false): ContentsSettings | null {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) return null;
  const out: Mutable<Record<string, unknown>> = {};
  for (const [rawKey, value] of Object.entries(given)) {
    const key = rawKey.toLowerCase();
    if (isList(key)) {
      if (value === null || value === undefined || value === '') out[key] = {};
      else if (typeof value === 'object' && !Array.isArray(value)) out[key] = cleanList(key, value as Record<string, unknown>);
    } else if (key === 'place') {
      const place = String(value ?? '').toLowerCase();
      if (place === 'start' || place === 'end') out['place'] = place;
    } else if (isMedium(key) && !medium) {
      if (String(value).toLowerCase() === 'none') out[key] = 'none';
      else if (value === null || value === undefined || value === '') out[key] = {};
      else {
        const layer = clean(value, true);
        if (layer) out[key] = layer;
      }
    }
  }
  return out as ContentsSettings;
}

function cleanList(kind: ContentsList, given: Record<string, unknown>): ContentsListOptions {
  const out: Mutable<ContentsListOptions> = {};
  for (const [rawKey, value] of Object.entries(given)) {
    const key = rawKey.toLowerCase();
    if (key === 'title' && typeof value === 'string' && value.trim() !== '') out.title = value.trim();
    if (key === 'depth' && kind === 'headings') {
      const depth = Number(value);
      if (Number.isInteger(depth) && depth >= 1 && depth <= 6) out.depth = depth;
    }
  }
  return out;
}

/** One list a contents draws, with its options resolved. */
export interface ContentsListPlan {
  readonly kind: ContentsList;
  /** The title written, or `null` for the host's word. */
  readonly title: string | null;
  readonly depth: number;
}

/** What a contents draws in one medium, and where: `null` is where its block is written. */
export interface ContentsPlan {
  readonly lists: readonly ContentsListPlan[];
  readonly place: ContentsPlace | null;
}

const layerOf = (settings: ContentsSettings | null | undefined, medium: ContentsMedium): ContentsLayer | 'none' | undefined =>
  settings ? settings[medium] : undefined;

/** The lists a layer names, in the order it writes them. */
function listsOf(layer: ContentsLayer | 'none' | null | undefined): ContentsList[] {
  if (!layer || layer === 'none') return [];
  return Object.keys(layer).filter(isList);
}

function optionOf<K extends keyof ContentsListOptions>(layers: readonly (ContentsLayer | 'none' | null | undefined)[], kind: ContentsList, key: K): ContentsListOptions[K] | undefined {
  for (const layer of layers) {
    if (!layer || layer === 'none') continue;
    const value = layer[kind]?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function plan(lists: readonly ContentsList[], layers: readonly (ContentsLayer | 'none' | null | undefined)[], place: ContentsPlace | null): ContentsPlan {
  return {
    lists: lists.map((kind) => ({ kind, title: optionOf(layers, kind, 'title') ?? null, depth: optionOf(layers, kind, 'depth') ?? CONTENTS_DEPTH })),
    place,
  };
}

/**
 * What a note's block draws in a medium, over the host's settings: `null` when the block says
 * `none` there. The lists are the first of the note's medium, the note's root, the host's medium
 * and the host's root that names any, else the headings; each option the nearest that sets it.
 * `place` is the block's own, never the host's.
 */
export function resolveBlock(block: ContentsSettings, host: ContentsSettings | null, medium: ContentsMedium): ContentsPlan | null {
  const noteMedium = layerOf(block, medium);
  if (noteMedium === 'none') return null;
  const hostMedium = layerOf(host, medium);
  const layers = [noteMedium, block, hostMedium, host];
  const lists = layers.map(listsOf).find((each) => each.length > 0) ?? ['headings'];
  const place = noteMedium?.place ?? block.place ?? null;
  return plan(lists, layers, place);
}

/**
 * What the host's settings draw in a medium for a note that holds no block: `null` unless the
 * host's medium group is there, or its root names a list. It is drawn where its `place` says, at
 * the start when it says nothing.
 */
export function resolveHost(host: ContentsSettings | null, medium: ContentsMedium): ContentsPlan | null {
  if (!host) return null;
  const hostMedium = layerOf(host, medium);
  if (hostMedium === 'none') return null;
  if (hostMedium === undefined && listsOf(host).length === 0) return null;
  const layers = [hostMedium, host];
  const lists = layers.map(listsOf).find((each) => each.length > 0) ?? ['headings'];
  const place = (hostMedium ? hostMedium.place : undefined) ?? host.place ?? 'start';
  return plan(lists, layers, place);
}

/** Whether two plans draw the same lists, so one drawing serves both media. */
export function samePlan(a: ContentsPlan | null, b: ContentsPlan | null): boolean {
  return JSON.stringify(a?.lists ?? null) === JSON.stringify(b?.lists ?? null);
}
