/**
 * What the playground saved, kept in this browser so it survives a reload (#78): each note's text as
 * the last save left it, and each file attached, with its attributes and its bytes in base64. A
 * browser keeps a few megabytes; past them, nothing more is kept and the playground says so.
 */

import type { StoredFile } from './files.js';

export interface Kept {
  /** A note's text by `<slug>/<path>`. */
  readonly notes: Readonly<Record<string, string>>;
  /** The files attached, by notebook and then by name. */
  readonly files: Readonly<Record<string, Readonly<Record<string, StoredFile>>>>;
}

const KEY = 'memorysmithapp-markdown/playground';
const NOTHING: Kept = { notes: {}, files: {} };

export function readKept(): Kept {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return NOTHING;
    const read = JSON.parse(text) as Partial<Kept>;
    return { notes: read.notes ?? {}, files: read.files ?? {} };
  } catch {
    return NOTHING;
  }
}

/** Keeps what was saved; answers `false` when the browser would not keep it all. */
export function writeKept(kept: Kept): boolean {
  try {
    if (Object.keys(kept.notes).length === 0 && Object.keys(kept.files).length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

export function forgetKept(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // A browser that keeps nothing has nothing to forget.
  }
}
