// What a browser has and jsdom does not, for the tests of the renderer.

if (typeof globalThis.CSS === 'undefined' || typeof globalThis.CSS.escape !== 'function') {
  // The serialisation of CSSOM, enough for the identifiers a note produces.
  const escape = (value: string): string =>
    value.replace(/[^a-zA-Z0-9_ -￿-]/g, (character) => `\\${character}`).replace(/^(\d)/, '\\3$1 ');
  (globalThis as { CSS?: unknown }).CSS = { ...(globalThis.CSS ?? {}), escape };
}
