/**
 * Where in a block's source a click on its drawing lands (#102): the text under the pointer is
 * found in the source the block was drawn from, so the caret goes where the author clicked once
 * the source is revealed, rather than to the end of the block's first line.
 */

/** How much of the text beside the pointer is looked for when its whole line is not in the source. */
const WINDOW = 24;
/** The least of it looked for: a letter or two is found anywhere. */
const LEAST = 3;

/** The text node and offset under a point of the page, where the browser can say. */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * The offset in `source` that draws `offset` in the text node `node` of the drawing `root`, or
 * `null` when the text there is not written in the source as it is drawn — a formula's typesetting,
 * an escaped character, a note an embed draws — and the click cannot be mapped.
 */
export function sourceOffsetOf(root: HTMLElement, source: string, node: Node, offset: number): number | null {
  if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null;
  const data = node.textContent ?? '';
  const at = Math.max(0, Math.min(offset, data.length));
  // A drawn paragraph joins its lines, which the source writes each after its own marker (`> `).
  const lineStart = data.lastIndexOf('\n', at - 1) + 1;
  const lineEnd = data.indexOf('\n', at) === -1 ? data.length : data.indexOf('\n', at);
  const before = textBefore(root, node) + data.slice(0, lineStart);
  const left = data.slice(Math.max(lineStart, at - WINDOW), at);
  const right = data.slice(at, Math.min(lineEnd, at + WINDOW));
  const candidates: { text: string; caret: number }[] = [
    { text: data.slice(lineStart, lineEnd), caret: at - lineStart },
    { text: left + right, caret: left.length },
    { text: left, caret: left.length },
    { text: right, caret: 0 },
  ];
  for (const [index, { text, caret }] of candidates.entries()) {
    if (!text.trim() || (index > 0 && text.trim().length < LEAST)) continue;
    const found = nth(source, text, count(before, text));
    if (found !== -1) return found + caret;
  }
  return null;
}

/** The text drawn before `node` within `root`. */
function textBefore(root: HTMLElement, node: Node): string {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, 0);
  return range.toString();
}

function count(text: string, piece: string): number {
  let found = 0;
  for (let at = text.indexOf(piece); at !== -1; at = text.indexOf(piece, at + 1)) found++;
  return found;
}

/**
 * Where the `n`-th occurrence of `piece` (from 0) starts in `text`: the same text drawn twice is
 * mapped to the occurrence it draws, and to the last one when the drawing shows more than the source.
 */
function nth(text: string, piece: string, n: number): number {
  let last = -1;
  for (let at = text.indexOf(piece), seen = 0; at !== -1; at = text.indexOf(piece, at + 1), seen++) {
    if (seen === n) return at;
    last = at;
  }
  return last;
}
