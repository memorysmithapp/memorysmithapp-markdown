/**
 * An image whose destination names no host is a file the notebook keeps (`SPEC.md` §5.8, #104):
 * `![Curva|300](../assets/curva-2026.png)` is the kept file `curva-2026.png`, drawn at 300 pixels,
 * and never a request to a path under the page. It is the form a vault exported from a desktop
 * editor writes, so every imported note with pictures has it.
 *
 * The page once handed such a destination to `<img>` as it was, and the browser asked for it
 * relative to the page: a 404, and nothing drawn, while `![[curva-2026.png]]` beside it drew the file.
 */

/** Anything of the shape `word:`, which is what makes an address absolute (§5.2, step 1). */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The name of the kept file an image's destination names, or `null` when it names a host or has a
 * scheme — the remote image of §3.14 and §7.10, or an address the page refuses.
 *
 * The name is the last segment of the path, `/` and `\` both separating, after the query and the
 * fragment are dropped, percent-decoded — an escape that is not one stays as written — and in NFC.
 * Nothing else is folded: the comparison is case-exact, and no extension is removed, because an
 * attachment's extension is part of its name. The destination may arrive as the author wrote it or
 * as the parser normalised it, with its spaces and backslashes encoded; both name the same file.
 */
export function keptImageName(destination: string): string | null {
  const trimmed = destination.trim();
  if (trimmed === '' || HAS_SCHEME.test(trimmed) || trimmed.startsWith('//')) return null;
  const path = trimmed.split(/[?#]/, 1)[0] ?? '';
  // A backslash the parser encoded separates segments as one written does.
  const segments = path.replace(/%5c/gi, '\\').split(/[/\\]/);
  return decodeLeniently(segments[segments.length - 1] ?? '').normalize('NFC');
}

/** Percent-decodes every escape that is one, and leaves the rest as written (§5.2, step 5). */
function decodeLeniently(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    // A run of escapes that is not UTF-8, or a `%` that opens nothing: each run is decoded on its own.
    return text.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}
