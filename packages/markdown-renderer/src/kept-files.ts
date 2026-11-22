/**
 * What the host says of several kept files at once (#175): `fileOf` for each name, an answer given
 * at once kept at once and a promise kept once it settles, so a contents can tell an image from
 * another file — which only a file's media type says (§5.8) — and name it by its description.
 */

import { useEffect, useMemo, useState } from 'react';
import type { KeptFile, ResolvedHost } from './host.js';

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Each name's file: the file, `null` for none or a host that cannot say, and `undefined` while the
 * host's answer is on its way.
 */
export function useKeptFiles(host: ResolvedHost, names: readonly string[]): ReadonlyMap<string, KeptFile | null | undefined> {
  const key = names.join('\u0000');
  const answers = useMemo(() => new Map(names.map((name) => [name, host.fileOf ? host.fileOf(name) : null] as const)), [host.fileOf, key]);
  const [settled, setSettled] = useState<{ answers: unknown; files: Map<string, KeptFile | null> }>({ answers: null, files: new Map() });
  useEffect(() => {
    let live = true;
    const files = new Map<string, KeptFile | null>();
    const pending = [...answers].filter(([, answer]) => isThenable(answer));
    if (pending.length === 0) return;
    for (const [name, answer] of pending) {
      (answer as PromiseLike<KeptFile | null>).then(
        (file) => {
          files.set(name, file);
          if (live) setSettled({ answers, files: new Map(files) });
        },
        () => {
          files.set(name, null);
          if (live) setSettled({ answers, files: new Map(files) });
        },
      );
    }
    return () => {
      live = false;
    };
  }, [answers]);
  return useMemo(() => {
    const out = new Map<string, KeptFile | null | undefined>();
    for (const [name, answer] of answers) {
      if (!isThenable(answer)) out.set(name, (answer as KeptFile | null) ?? null);
      else out.set(name, settled.answers === answers && settled.files.has(name) ? settled.files.get(name)! : undefined);
    }
    return out;
  }, [answers, settled]);
}
