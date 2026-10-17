/**
 * Where the save of the author's edits stands (#64, #86).
 *
 * The host saves each change it is handed. When `onChange` answers with a promise, the editor
 * follows it: saving while it is pending, saved once it resolves, not saved when it rejects. Only
 * the latest change counts: a save that settles after a later change was handed says nothing, so
 * "Saved" always means the last text the author wrote. A host that answers with nothing has no
 * status, and the editor shows none.
 *
 * A host may also say why (#86): a save that resolves with a `SaveOutcome` succeeded with
 * something the author must decide, the alert; one rejected with a `SaveRefusal` was refused for
 * a reason the host explains, the error. Either carries the actions the author chooses from, and
 * an action the author runs is followed like a save.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isThenable } from '../task-saves.js';

/** One choice the host offers the author: its word, and what choosing it does. */
export interface SaveAction {
  /** The button's word, in the reader's language: the host words it. */
  readonly label: string;
  /** Runs the choice; a promise answered is followed like a save, and may end in another notice. */
  readonly run: () => Promise<void | SaveOutcome> | void;
}

/** What the host has to say about a save, and the choices it gives the author. */
export interface SaveNotice {
  /** The dialog's title, and the status button's tooltip. */
  readonly title: string;
  /** The explanation in the dialog. */
  readonly message: string;
  readonly actions: readonly SaveAction[];
}

/** A save that succeeded with something the author must decide: what `onChange`'s promise resolves with. */
export type SaveOutcome = SaveNotice;

/** A save the host refused, with its reason and its choices: what `onChange`'s promise rejects with. */
export type SaveRefusal = SaveNotice;

export type EditSave = 'idle' | 'saving' | 'saved' | 'alert' | 'failed';

export interface EditSaves {
  readonly state: EditSave;
  /** What the host said of the save: present in `alert`, and in `failed` when it gave a reason. */
  readonly notice: SaveNotice | null;
  /** Hands a change to the host and follows its save. */
  readonly hand: (markdown: string) => void;
  /** Hands the latest change to the host again, after a save failed. */
  readonly retry: () => void;
  /** Runs one of the notice's actions and follows it like a save. */
  readonly run: (action: SaveAction) => void;
  /**
   * Whether an action the author chose is still running (#119): the note stays held until it
   * settles, and a moment after, so the text the host gives back is in before the author writes.
   */
  readonly running: boolean;
}

/** Whether a value is a notice a host gave: a title, a message and its actions. */
export function isSaveNotice(value: unknown): value is SaveNotice {
  if (typeof value !== 'object' || value === null) return false;
  const notice = value as Partial<SaveNotice>;
  return (
    typeof notice.title === 'string' &&
    typeof notice.message === 'string' &&
    Array.isArray(notice.actions) &&
    notice.actions.every((action: unknown) => typeof action === 'object' && action !== null && typeof (action as SaveAction).label === 'string' && typeof (action as SaveAction).run === 'function')
  );
}

export function useEditSaves(onChange: ((markdown: string) => unknown) | undefined): EditSaves {
  const [status, setStatus] = useState<{ state: EditSave; notice: SaveNotice | null }>({ state: 'idle', notice: null });
  const [running, setRunning] = useState(false);
  const latest = useRef({ onChange, count: 0, text: null as string | null, alive: true });
  latest.current.onChange = onChange;

  useEffect(() => {
    const self = latest.current;
    self.alive = true;
    return () => {
      self.alive = false;
    };
  }, []);

  /**
   * Follows what the host answered, a change's save or an action; `done` is the state of an answer
   * that is not a promise, and `settled` is told once it is over.
   */
  const follow = useCallback((answer: () => unknown, done: EditSave, settled?: () => void) => {
    const self = latest.current;
    const count = ++self.count;
    const settle = (state: EditSave, notice: SaveNotice | null = null) => {
      if (self.alive && count === self.count) setStatus({ state, notice });
      if (state !== 'saving') settled?.();
    };
    let result: unknown;
    try {
      result = answer();
    } catch (reason) {
      settle('failed', isSaveNotice(reason) ? reason : null);
      return;
    }
    if (!isThenable(result)) {
      settle(done);
      return;
    }
    settle('saving');
    result.then(
      (value) => (isSaveNotice(value) ? settle('alert', value) : settle('saved')),
      (reason) => settle('failed', isSaveNotice(reason) ? reason : null),
    );
  }, []);

  const hand = useCallback(
    (markdown: string) => {
      latest.current.text = markdown;
      follow(() => latest.current.onChange?.(markdown), 'idle');
    },
    [follow],
  );

  const retry = useCallback(() => {
    const text = latest.current.text;
    if (text !== null) hand(text);
  }, [hand]);

  // An action that answers nothing has done what it does: the author decided, and nothing is left to say.
  // The note is held from the choice until the action settles, and for a turn of the event loop after
  // it, so a text the host gives back as it settles is drawn before a key reaches it (#119).
  const run = useCallback(
    (action: SaveAction) => {
      const self = latest.current;
      setRunning(true);
      follow(() => action.run(), 'saved', () => setTimeout(() => self.alive && setRunning(false)));
    },
    [follow],
  );

  return { state: status.state, notice: status.notice, hand, retry, run, running };
}
