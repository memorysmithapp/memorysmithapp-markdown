/**
 * Parameter references, `{{name}}` (§7.14, #134).
 *
 * A model of a notebook marks with a reference where a value goes, and what fills it in is the
 * implementation that creates a notebook from the model, never this package: the reading surface
 * draws a reference as it stands, unresolved, as a parameter and not as broken text. Nothing here
 * changes a byte of the note.
 *
 * A reference is exactly `{{`, a name and `}}`, the shortest match, so `{{{name}}}` is a literal
 * `{`, a reference and a literal `}`. It needs two unescaped `{`: `\{{name}}` and `{\{name}}` are
 * text, and so is a run that does not close as one. Where it is not a reference — code, math, a
 * link's destination, an autolink, raw HTML — is decided by the parser, which is why the reading
 * surface finds it in the tree (`remarkParameters`) and the editor on the tree's text
 * (`analyze.ts`); this module only knows the characters.
 */

import { decodeString } from 'micromark-util-decode-string';

/**
 * A reference: a letter or `_`, then letters, combining marks, digits, `_` and `-`, between
 * double braces. The same class of word a callout's type is (§7.1).
 */
const REFERENCE = /\{\{([\p{L}_][\p{L}\p{M}\p{N}_-]*)\}\}/gu;

/** One reference, as a range of the text it was found in. */
export interface ParameterReference {
  /** The name, normalised to NFC: two spellings of one name are one parameter. */
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

/**
 * The references a run of source text writes, in order. A `{{` preceded by an odd run of
 * backslashes is escaped, and is text.
 */
export function parameterReferences(source: string): ParameterReference[] {
  const found: ParameterReference[] = [];
  for (const match of source.matchAll(REFERENCE)) {
    const at = match.index ?? 0;
    let backslashes = 0;
    while (source[at - 1 - backslashes] === '\\') backslashes += 1;
    if (backslashes % 2 === 1) continue;
    found.push({ name: (match[1] ?? '').normalize('NFC'), from: at, to: at + match[0].length });
  }
  return found;
}

/** Whether a run of source text writes a reference: a wikilink target that does is no link (§5.2). */
export function hasParameterReference(source: string): boolean {
  return parameterReferences(source).length > 0;
}

/** A piece of text: the characters as they are drawn, or a reference. */
export type ParameterPiece = string | ParameterReference;

/**
 * A text cut at its references, for the places that draw the characters as they were typed: the
 * value of a property, the name of a note.
 */
export function splitParameters(text: string): ParameterPiece[] {
  const pieces: ParameterPiece[] = [];
  let cursor = 0;
  for (const reference of parameterReferences(text)) {
    if (reference.from > cursor) pieces.push(text.slice(cursor, reference.from));
    pieces.push(reference);
    cursor = reference.to;
  }
  if (cursor < text.length || pieces.length === 0) pieces.push(text.slice(cursor));
  return pieces;
}

interface MdastNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdastNode[];
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** The characters a container puts in front of a continuation line: a quote's `>`, an indent. */
const CONTINUATION = /^(?:[ \t]*>)*[ \t]*/;

/**
 * What the parser made of a run of source, as it made a text node's value of it: the escapes and
 * the character references decoded, each line before a soft break without its trailing spaces, and
 * each continuation line without what its container put in front of it.
 */
function decoded(source: string): string {
  const lines = source.split('\n');
  return decodeString(
    lines
      .map((line, index) => {
        const head = index === 0 ? line : line.replace(CONTINUATION, '');
        return index === lines.length - 1 ? head : head.replace(/[ \t]+$/, '');
      })
      .join('\n'),
  );
}

/**
 * The value of a text node, cut at the references its source writes, or `null` when there is none
 * or the value is not what this module reads the source as, which leaves the node as it was: a
 * reference not drawn is the safe failure, a value drawn wrong is not.
 */
function cutText(source: string, value: string): Array<string | ParameterReference> | null {
  const references = parameterReferences(source);
  if (references.length === 0) return null;
  const pieces: Array<string | ParameterReference> = [];
  let cursor = 0;
  for (const reference of references) {
    pieces.push(decoded(source.slice(cursor, reference.from)), reference);
    cursor = reference.to;
  }
  pieces.push(decoded(source.slice(cursor)));
  const drawn = pieces.map((piece) => (typeof piece === 'string' ? piece : source.slice(piece.from, piece.to))).join('');
  return drawn === value ? pieces.filter((piece) => piece !== '') : null;
}

/** The node a reference becomes: a span the stylesheet draws as a parameter, holding what was typed. */
function parameterNode(name: string, typed: string, title: string | undefined): MdastNode {
  return {
    type: 'parameter',
    data: { hName: 'span', hProperties: { className: ['parameter'], dataParameter: name, ...(title ? { title } : {}) } },
    children: [{ type: 'text', value: typed }],
  };
}

/**
 * `{{name}}` becomes a parameter, drawn unresolved (§7.14).
 *
 * It runs before every other transform of the reading surface, while each text node still has the
 * position of the characters it came from: an escape is gone from the value, and only the source
 * says a `{{` was written `\{{`. The nodes the parser does not read as text — code, math, raw
 * HTML, a destination — never reach it, and a link that is not written with brackets is an
 * autolink, whose text is its address.
 */
export interface ParameterOptions {
  /** The title of a parameter on the page, in the reader's language. */
  readonly title?: string | undefined;
}

export function remarkParameters(options: ParameterOptions = {}) {
  return (tree: MdastNode, file: { value?: unknown }): void => {
    const source = typeof file.value === 'string' ? file.value : String(file.value ?? '');
    if (!source.includes('{{')) return;
    const visit = (parent: MdastNode): void => {
      if (!parent.children) return;
      parent.children = parent.children.flatMap((child) => {
        if (child.type === 'link') {
          const from = child.position?.start?.offset;
          if (from === undefined || source[from] !== '[') return [child];
        }
        if (child.type !== 'text') {
          visit(child);
          return [child];
        }
        const from = child.position?.start?.offset;
        const to = child.position?.end?.offset;
        if (from === undefined || to === undefined || typeof child.value !== 'string') return [child];
        const typed = source.slice(from, to);
        const pieces = cutText(typed, child.value);
        if (!pieces) return [child];
        return pieces.map((piece) =>
          typeof piece === 'string' ? { type: 'text', value: piece } : parameterNode(piece.name, typed.slice(piece.from, piece.to), options.title),
        );
      });
    };
    visit(tree);
  };
}
