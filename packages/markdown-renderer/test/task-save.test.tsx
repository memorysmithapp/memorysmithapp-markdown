/**
 * The save of a tick, as the reader sees it (RN-RENDER-009, #47): a host that answers with a
 * promise gets the item locked under "Updating…" until it settles, the box back and "Not saved"
 * when it fails, and its calls one at a time; a host that answers with nothing keeps today's page.
 */

import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteBody, toggleTaskAt } from '../src/index.js';
import { FAILED_NOTICE_MS } from '../src/task-saves.js';
import { mount, type Mounted } from './render.js';

const NOTE = '# Tasks\n\n- [ ] First\n- [x] Second\n- [ ] Third\n';

interface Deferred {
  readonly ordinal: number;
  resolve(): void;
  reject(): void;
}

/** A host that keeps the note in state and saves each tick when the test says so. */
function SlowHost({ calls, pt = false }: { calls: Deferred[]; pt?: boolean }) {
  const [markdown, setMarkdown] = useState(NOTE);
  return (
    <NoteBody
      markdown={markdown}
      writable
      strings={pt ? { updating: 'Atualizando…', notSaved: 'Não salvo', saved: 'Salvo' } : undefined}
      onToggleTask={(ordinal) =>
        new Promise<void>((resolve, reject) => {
          calls.push({
            ordinal,
            resolve: () => {
              setMarkdown((current) => toggleTaskAt(current, ordinal) ?? current);
              resolve();
            },
            reject: () => reject(new Error('offline')),
          });
        })
      }
    />
  );
}

const items = (note: Mounted) => [...note.container.querySelectorAll<HTMLLIElement>('li.task-item')];
const box = (item: HTMLLIElement | undefined) => item?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
const status = (note: Mounted) => note.container.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? null;

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

describe('a tick the host saves with a promise', () => {
  it('locks the item under "Updating…", showing the state being written, until the save resolves', async () => {
    const calls: Deferred[] = [];
    mounted = await mount(<SlowHost calls={calls} />);
    await act(async () => box(items(mounted!)[0])?.click());

    // The items are drawn anew on every render, so each is read after the click.
    const first = items(mounted)[0];
    expect(calls.map((call) => call.ordinal)).toEqual([0]);
    expect(first?.dataset['save']).toBe('pending');
    expect(first?.getAttribute('aria-busy')).toBe('true');
    expect(first?.querySelector('.task-lock')?.textContent).toBe('Updating…');
    expect(box(first)?.checked).toBe(true);
    expect(box(first)?.disabled).toBe(true);
    expect(status(mounted)).toBe('Updating…');

    await act(async () => calls[0]?.resolve());

    const after = items(mounted)[0];
    expect(after?.dataset['save']).toBeUndefined();
    expect(after?.querySelector('.task-lock')).toBeNull();
    expect(box(after)?.checked).toBe(true);
    expect(box(after)?.disabled).toBe(false);
    expect(status(mounted)).toBe('Saved');
  });

  it('returns the box to its source and says "Not saved" for a moment when the save fails', async () => {
    vi.useFakeTimers();
    const calls: Deferred[] = [];
    mounted = await mount(<SlowHost calls={calls} />);

    await act(async () => box(items(mounted!)[1])?.click());
    expect(box(items(mounted)[1])?.checked).toBe(false);

    await act(async () => calls[0]?.reject());

    const second = items(mounted)[1];
    expect(second?.dataset['save']).toBe('failed');
    expect(second?.querySelector('.task-lock')).toBeNull();
    expect(second?.querySelector('.task-notice')?.textContent).toBe('Not saved');
    expect(box(second)?.checked).toBe(true);
    expect(box(second)?.disabled).toBe(false);
    expect(status(mounted)).toBe('Not saved');

    await act(async () => vi.advanceTimersByTime(FAILED_NOTICE_MS));
    expect(items(mounted)[1]?.querySelector('.task-notice')).toBeNull();
    expect(items(mounted)[1]?.dataset['save']).toBeUndefined();
  });

  it('asks the host one save at a time, each tick with the ordinal of its own box', async () => {
    const calls: Deferred[] = [];
    mounted = await mount(<SlowHost calls={calls} />);

    await act(async () => box(items(mounted!)[0])?.click());
    await act(async () => box(items(mounted!)[2])?.click());

    // Both items are locked, and only the first save reached the host.
    expect(items(mounted).map((item) => item.dataset['save'])).toEqual(['pending', undefined, 'pending']);
    expect(calls.map((call) => call.ordinal)).toEqual([0]);

    await act(async () => calls[0]?.resolve());
    expect(calls.map((call) => call.ordinal)).toEqual([0, 2]);
    expect(items(mounted)[2]?.dataset['save']).toBe('pending');

    await act(async () => calls[1]?.resolve());
    expect(items(mounted).map((item) => box(item)?.checked)).toEqual([true, true, true]);
    expect(items(mounted).every((item) => item.dataset['save'] === undefined)).toBe(true);
  });

  it('says its words in the reader\'s language', async () => {
    const calls: Deferred[] = [];
    mounted = await mount(<SlowHost calls={calls} pt />);
    await act(async () => box(items(mounted!)[0])?.click());
    expect(items(mounted)[0]?.querySelector('.task-lock')?.textContent).toBe('Atualizando…');
    await act(async () => calls[0]?.reject());
    expect(items(mounted)[0]?.querySelector('.task-notice')?.textContent).toBe('Não salvo');
  });
});

describe('a tick the host answers with nothing', () => {
  it('draws no lock, as before', async () => {
    const toggled: number[] = [];
    mounted = await mount(<NoteBody markdown={NOTE} writable onToggleTask={(ordinal) => void toggled.push(ordinal)} />);

    await act(async () => box(items(mounted!)[2])?.click());
    await act(async () => box(items(mounted!)[0])?.click());

    expect(toggled).toEqual([2, 0]);
    expect(mounted.container.querySelector('[data-save]')).toBeNull();
    expect(status(mounted)).toBe('');
  });
});
