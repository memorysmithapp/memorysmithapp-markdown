/**
 * Where the save of the author's edits stands (#64).
 *
 * The host saves each change it is handed. When `onChange` answers with a promise, the editor
 * follows it: saving while it is pending, saved once it resolves, not saved when it rejects. Only
 * the latest change counts: a save that settles after a later change was handed says nothing, so
 * "Saved" always means the last text the author wrote. A host that answers with nothing has no
 * status, and the editor shows none.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isThenable } from '../task-saves.js';

export type EditSave = 'idle' | 'saving' | 'saved' | 'failed';

export interface EditSaves {
  readonly state: EditSave;
  /** Hands a change to the host and follows its save. */
  readonly hand: (markdown: string) => void;
  /** Hands the latest change to the host again, after a save failed. */
  readonly retry: () => void;
}

export function useEditSaves(onChange: ((markdown: string) => unknown) | undefined): EditSaves {
  const [state, setState] = useState<EditSave>('idle');
  const latest = useRef({ onChange, count: 0, text: null as string | null, alive: true });
  latest.current.onChange = onChange;

  useEffect(() => {
    const self = latest.current;
    self.alive = true;
    return () => {
      self.alive = false;
    };
  }, []);

  const hand = useCallback((markdown: string) => {
    const self = latest.current;
    self.text = markdown;
    const count = ++self.count;
    const settle = (next: EditSave) => {
      if (self.alive && count === self.count) setState(next);
    };
    let result: unknown;
    try {
      result = self.onChange?.(markdown);
    } catch {
      settle('failed');
      return;
    }
    if (!isThenable(result)) {
      settle('idle');
      return;
    }
    settle('saving');
    result.then(
      () => settle('saved'),
      () => settle('failed'),
    );
  }, []);

  const retry = useCallback(() => {
    const text = latest.current.text;
    if (text !== null) hand(text);
  }, [hand]);

  return { state, hand, retry };
}
