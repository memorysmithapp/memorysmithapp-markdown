/**
 * The saves of the task boxes a reader ticks, as the page shows them.
 *
 * A tick only exists once the host has saved it, and a reader who cannot see
 * that cannot tell which state was kept. So when the host answers a tick with
 * a promise, the item is locked under "Updating…" until it settles: resolved,
 * the lock lifts and the box is what the host's new bytes say; rejected, the
 * box returns to the state its source still holds and the item says "Not
 * saved" for a moment. A host that answers with nothing keeps today's page.
 *
 * The calls are queued: a second tick reaches the host only once the first
 * settled, so a host that applies `toggleTaskAt` to its latest bytes never
 * has two writes of the same note in flight.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Where the save of one box stands, by its ordinal in the note. */
export type TaskSave = { readonly kind: 'pending'; readonly checked: boolean } | { readonly kind: 'failed' };

/** What the host answers a tick with: the promise of its save, or anything else, which locks nothing. */
export type TaskToggleResult = unknown;

/** How long "Not saved" stays on an item, in milliseconds. */
export const FAILED_NOTICE_MS = 2500;

export interface TaskSaves {
  /** The save of the box at this ordinal, or `null` when nothing is in flight or just failed. */
  readonly stateOf: (ordinal: number) => TaskSave | null;
  /** Reports a tick; `checked` is the state the box is being set to. */
  readonly toggle: (ordinal: number, checked: boolean) => void;
  /** What the page last said about a save, for a polite live region; empty when it has nothing to say. */
  readonly announcement: 'updating' | 'saved' | 'notSaved' | '';
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

export function useTaskSaves(onToggleTask: ((ordinal: number) => TaskToggleResult) | undefined): TaskSaves {
  const [states, setStates] = useState<ReadonlyMap<number, TaskSave>>(() => new Map());
  const [announcement, setAnnouncement] = useState<TaskSaves['announcement']>('');
  // Every save still in flight, and the end of the queue: a settled promise, whatever the outcome.
  const inFlight = useRef(0);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // The latest callback, so a queued tick reaches the host's current one and not the one of its render.
  const latest = useRef(onToggleTask);
  latest.current = onToggleTask;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const put = (ordinal: number, save: TaskSave | null): void =>
    setStates((all) => {
      const next = new Map(all);
      if (save) next.set(ordinal, save);
      else next.delete(ordinal);
      return next;
    });

  const track = (ordinal: number, checked: boolean, save: Promise<unknown>): void => {
    inFlight.current += 1;
    put(ordinal, { kind: 'pending', checked });
    setAnnouncement('updating');
    tail.current = save.then(
      () => {
        inFlight.current -= 1;
        put(ordinal, null);
        setAnnouncement('saved');
      },
      () => {
        inFlight.current -= 1;
        put(ordinal, { kind: 'failed' });
        setAnnouncement('notSaved');
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          setStates((all) => {
            if (all.get(ordinal)?.kind !== 'failed') return all;
            const next = new Map(all);
            next.delete(ordinal);
            return next;
          });
        }, FAILED_NOTICE_MS);
        timers.current.add(timer);
      },
    );
  };

  const toggle = useCallback((ordinal: number, checked: boolean): void => {
    const call = (): TaskToggleResult => latest.current?.(ordinal);
    if (inFlight.current === 0) {
      // Nothing ahead of it: the host is asked now, and an answer of nothing draws no lock.
      const result = call();
      if (isThenable(result)) track(ordinal, checked, Promise.resolve(result));
      return;
    }
    // Something is in flight: the box locks at once, and the host is asked once the queue reaches it.
    track(
      ordinal,
      checked,
      tail.current.then(() => call()),
    );
    // `track` reads only refs and state setters, so the one made on the first render serves every tick.
  }, []);

  const stateOf = useCallback((ordinal: number): TaskSave | null => states.get(ordinal) ?? null, [states]);

  return { stateOf, toggle, announcement };
}
