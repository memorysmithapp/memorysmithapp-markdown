/**
 * Every note of the two notebooks is drawn by the renderer, under the host the
 * page gives it, without an error: every embed finds its note, every link but
 * the ones the notebooks leave pending on purpose resolves, and every picture
 * it keeps is drawn.
 */

import { NoteBody } from '@memorysmithapp/markdown-renderer';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hostOf } from '../src/notebooks.js';
import { schemesOf, THEMES } from '../src/themes/index.js';
import { readNotebooks } from './notebook-files.js';

vi.mock('mermaid', () => ({
  default: {
    initialize: () => undefined,
    parse: async () => ({}),
    render: async () => ({ svg: '<svg data-diagram=""></svg>' }),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notebooks = readNotebooks();
const errors: unknown[] = [];
const original = console.error;

beforeAll(() => {
  console.error = (...args: unknown[]) => errors.push(args);
});
afterAll(() => {
  console.error = original;
});

async function draw(element: React.ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  return container;
}

describe('the two notebooks', () => {
  it('are both here, with their notes', () => {
    expect(notebooks.map((notebook) => notebook.slug)).toEqual(['continuity-engineering', 'enologia']);
    for (const notebook of notebooks) expect(notebook.notes.length).toBeGreaterThan(5);
  });
});

describe.each(notebooks.map((notebook) => [notebook.slug, notebook] as const))('%s', (_slug, notebook) => {
  it.each(notebook.notes.map((note) => [note.path, note] as const))('draws %s', async (_path, note) => {
    for (const theme of ['light', 'dark'] as const) {
      errors.length = 0;
      const container = await draw(
        <NoteBody markdown={note.markdown} {...hostOf(notebook, (name) => `/assets/${name}`)} theme={theme} writable onToggleTask={() => undefined} />,
      );
      const root = container.querySelector(':scope > .markdown');
      expect(root?.getAttribute('data-theme')).toBe(theme);
      expect(root?.textContent?.trim().length).toBeGreaterThan(0);
      // Nothing the notebook wrote reaches the page as raw notation.
      expect(root?.textContent).not.toMatch(/(^|[^`])!\[\[/);
      // Every embed found its note: none is pending, none is loading.
      expect(container.querySelector('.embed-pending'), 'an embed is pending').toBeNull();
      expect(container.querySelector('.skeleton-region'), 'an embed is still loading').toBeNull();
      expect(errors).toEqual([]);
      container.remove();
    }
  });
});

describe.each(THEMES.map((entry) => [entry.theme.name, entry] as const))('the theme %s', (name, entry) => {
  it('draws every note of both notebooks in each of its schemes, with no error', async () => {
    for (const notebook of notebooks) {
      for (const note of notebook.notes) {
        for (const scheme of schemesOf(entry)) {
          errors.length = 0;
          const container = await draw(
            <NoteBody
              markdown={note.markdown}
              {...hostOf(notebook, (file) => `/assets/${file}`)}
              theme={entry.theme}
              scheme={scheme}
              writable
              onToggleTask={() => undefined}
            />,
          );
          const root = container.querySelector(':scope > .markdown');
          expect(root?.classList.contains(`markdown-theme-${name}`), note.path).toBe(true);
          expect(root?.getAttribute('data-theme')).toBe(scheme);
          expect(root?.textContent?.trim().length).toBeGreaterThan(0);
          expect(container.querySelector('.embed-pending'), 'an embed is pending').toBeNull();
          expect(errors, `${note.path} in ${scheme}`).toEqual([]);
          container.remove();
        }
      }
    }
  });
});

describe('what the notebooks leave pending on purpose', () => {
  it('is the only pending link drawn', async () => {
    const pending: string[] = [];
    for (const notebook of notebooks) {
      for (const note of notebook.notes) {
        const container = await draw(<NoteBody markdown={note.markdown} {...hostOf(notebook, (name) => `/assets/${name}`)} />);
        pending.push(...[...container.querySelectorAll('.wikilink-pending')].map((span) => span.textContent ?? ''));
        container.remove();
      }
    }
    // `Blast radius` is an alias of `Failure domain`, which is how it lands.
    expect([...new Set(pending)].sort()).toEqual(['Correlação IPT e safra fria', 'Warehouse recovery objective']);
  });
});
