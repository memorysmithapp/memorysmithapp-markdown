import type { ResolvedHost } from './host.js';
import { CHOICE_SCHEME } from './LinkChoice.js';

/**
 * Where a wikilink goes: the note when exactly one answers it, and the choice
 * otherwise — several notes, or none, which is pending and still asks — when
 * the host can say which notes a target may lead to. With no such host, a
 * target no single note answers is pending.
 */
export function wikilinkAddress(host: ResolvedHost, name: string): string | null {
  const address = host.resolve(name);
  if (address !== null) return address;
  return host.choose ? `${CHOICE_SCHEME}${encodeURIComponent(name)}` : null;
}
