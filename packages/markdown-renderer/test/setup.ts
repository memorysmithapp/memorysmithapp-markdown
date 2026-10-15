// What a browser has and jsdom does not, for the tests of the renderer.

if (typeof globalThis.CSS === 'undefined' || typeof globalThis.CSS.escape !== 'function') {
  // The serialisation of CSSOM, enough for the identifiers a note produces.
  const escape = (value: string): string =>
    value.replace(/[^a-zA-Z0-9_ -￿-]/g, (character) => `\\${character}`).replace(/^(\d)/, '\\3$1 ');
  (globalThis as { CSS?: unknown }).CSS = { ...(globalThis.CSS ?? {}), escape };
}

// CodeMirror measures text through ranges and elements, which jsdom does not lay out: every
// measurement answers zero, which is enough for an editor no test looks at.
if (typeof Range !== 'undefined' && typeof Range.prototype.getClientRects !== 'function') {
  const none = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getClientRects = none;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}
