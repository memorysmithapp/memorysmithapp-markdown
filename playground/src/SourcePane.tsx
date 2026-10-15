// The bytes the editor would save, beside the note in edit mode (#50): every line of the note as
// it stands, the ones that differ from the note as the notebook keeps it marked, and the control
// that gives the original back.

import { useMemo } from 'react';

/** Which lines of `current` are not lines of `original`, by the longest common subsequence of lines. */
export function changedLines(original: string, current: string): Set<number> {
  const a = original.split('\n');
  const b = current.split('\n');
  // The table of common lengths, row by row from the end; notes are small enough for it.
  const lengths: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i]![j] = a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      kept.add(j);
      i++;
      j++;
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) i++;
    else j++;
  }
  return new Set(b.map((_, index) => index).filter((index) => !kept.has(index)));
}

export function SourcePane({ original, current, onRestore }: { original: string; current: string; onRestore: () => void }) {
  const changed = useMemo(() => changedLines(original, current), [original, current]);
  // Lines taken out: the lines of the original that no line of the note keeps.
  const removed = useMemo(() => original.split('\n').length - (current.split('\n').length - changed.size) - changed.size, [original, current, changed]);
  const same = original === current;
  return (
    <aside className="source-pane" aria-label="The Markdown the editor would save">
      <header>
        <strong>Markdown</strong>
        <span className="source-status" data-same={same}>
          {same ? 'identical to the original' : `${changed.size} line${changed.size === 1 ? '' : 's'} new or changed${removed > 0 ? `, ${removed} removed` : ''}`}
        </span>
        <button type="button" disabled={same} onClick={onRestore}>
          Restore the original
        </button>
      </header>
      <ol>
        {current.split('\n').map((line, index) => (
          <li key={index} className={changed.has(index) ? 'changed' : undefined}>
            <code>{line.length > 0 ? line.replace(/\r$/, '␍') : '​'}</code>
          </li>
        ))}
      </ol>
    </aside>
  );
}
