/**
 * What an embed reaches (`SPEC.md` §5.2, §5.8): a note of that name, else an attachment of that
 * name, else nothing — on the reading page, inside an embedded note, in the editor and in the
 * notices.
 */

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { diagnose } from '../src/diagnose.js';
import { NoteEditor } from '../src/edit/index.js';
import { embedReach } from '../src/embed-target.js';
import { resolveHost } from '../src/host.js';
import { notebook } from './notebook.js';
import { draw, mount, type Mounted } from './render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
}

const X = '---\nname: x\n---\n\nThe note named x.\n';

describe('a note and a file of one name (#148)', () => {
  const host = notebook({ x: X }, ['x']);

  it('is the note, by the count of the host', () => {
    const resolved = resolveHost(host);
    expect(embedReach(resolved, 'x')).toBe('note');
    expect(embedReach(resolveHost(notebook({}, ['x'])), 'x')).toBe('file');
    expect(embedReach(resolveHost(notebook({}, [])), 'x')).toBe('pending');
    expect(embedReach(resolveHost({ reaches: () => 2, keeps: () => true }), 'x')).toBe('choice');
  });

  it('transcludes the note on the reading page, and draws no file', async () => {
    mounted = await draw('---\nname: A\n---\n\n![[x]]\n', host);
    await settle();
    const figure = mounted.container.querySelector('figure.embed');
    expect(figure?.querySelector('.embed-body')?.textContent).toContain('The note named x.');
    expect(mounted.container.querySelector('[class^="attachment"]')).toBeNull();
  });

  it('is a link to the note inside embedded content, where an embed does not expand', async () => {
    const outer = notebook({ x: X, B: '---\nname: B\n---\n\nSee ![[x]] here.\n' }, ['x']);
    mounted = await draw('![[B]]\n', outer);
    await settle();
    const body = mounted.container.querySelector('figure.embed .embed-body')!;
    expect(body.querySelector('a.wikilink')?.getAttribute('href')).toBe('/notes/x');
    expect(body.querySelector('[class^="attachment"]')).toBeNull();
  });

  it('is the note in the editor, whose block transcludes it', async () => {
    mounted = await mount(<NoteEditor markdown={'Text.\n\n![[x]]\n'} {...host} />);
    await settle();
    expect(mounted.container.querySelector('.cm-content figure.embed .embed-body')?.textContent).toContain('The note named x.');
    expect(mounted.container.querySelector('.cm-content [class^="attachment"]')).toBeNull();
  });

  it('raises no pending notice', async () => {
    const codes = (await diagnose('![[x]]\n', host)).map(({ code }) => code);
    expect(codes).not.toContain('embed-pending');
  });
});
