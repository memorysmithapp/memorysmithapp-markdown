/**
 * A block the editor draws is a React root of its own, outside the host's tree (#90): a host
 * function that needs the host's context throws there, and the block shows its Markdown under a
 * notice instead of being left empty.
 */

import { act, createContext, useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import type { LinkRequest } from '../../src/index.js';
import { mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

/** A router the host provides around the note, which a block's own root does not carry. */
const Router = createContext<{ basename: string } | null>(null);
function RouterLink({ href, className, children }: LinkRequest) {
  const { basename } = useContext(Router)!;
  return (
    <a href={basename + href} className={className}>
      {children}
    </a>
  );
}

const CALLOUT = '> [!note] See\n> [[Other]] for more.';
const TABLE = '| Link |\n| --- |\n| [[Other]] |';
const NOTE = `# Title\n\n${CALLOUT}\n\n${TABLE}\n\nAfter.\n`;

describe('a block whose drawing throws', () => {
  it('shows its Markdown under a notice, and the rest of the note is drawn', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    mounted = await mount(
      <Router.Provider value={{ basename: '/app' }}>
        <NoteEditor markdown={NOTE} resolve={(name) => `/notes/${name}`} renderLink={(link) => <RouterLink {...link} />} />
      </Router.Provider>,
    );
    await settle();
    const failed = [...mounted.container.querySelectorAll('.cm-ms-block-failed')];
    expect(failed.map((block) => block.querySelector('pre')?.textContent)).toEqual([CALLOUT, TABLE]);
    for (const block of failed) {
      expect(block.getAttribute('role')).toBe('note');
      expect(block.querySelector('.cm-ms-block-failed-notice')?.textContent).toBe('This block could not be drawn; its Markdown is below');
      expect(block.closest('.cm-ms-block')).not.toBeNull();
    }
    expect(mounted.container.querySelector('.cm-content')?.textContent).toContain('After.');
    expect(report).toHaveBeenCalledWith('A block of the note could not be drawn:', expect.anything(), expect.anything());
  });

  it('is drawn as before when the host function needs nothing of the host', async () => {
    mounted = await mount(<NoteEditor markdown={NOTE} resolve={(name) => `/notes/${name}`} renderLink={({ href, className, children }) => <a href={href} className={className}>{children}</a>} />);
    await settle();
    expect(mounted.container.querySelector('.cm-ms-block-failed')).toBeNull();
    expect(mounted.container.querySelectorAll('.cm-ms-block a[href="/notes/Other"]')).toHaveLength(2);
  });

  it('says its notice in the reader\'s language', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mounted = await mount(
      <NoteEditor
        markdown={`${CALLOUT}\n`}
        resolve={(name) => `/notes/${name}`}
        renderLink={(link) => <RouterLink {...link} />}
        strings={{ editor: { blockFailed: 'Bloco não desenhado' } }}
      />,
    );
    await settle();
    expect(mounted.container.querySelector('.cm-ms-block-failed-notice')?.textContent).toBe('Bloco não desenhado');
  });
});
