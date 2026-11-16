/**
 * What an embed reaches (`SPEC.md` §5.2, §5.8): a note of that name, else an attachment of that
 * name, else nothing — on the reading page, inside an embedded note, in the editor and in the
 * notices.
 */

import { cases } from '@memorysmithapp/markdown-spec';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { diagnose } from '../src/diagnose.js';
import { NoteEditor } from '../src/edit/index.js';
import { drawing, drawnNote, embedReach, embedTarget } from '../src/embed-target.js';
import { resolveHost } from '../src/host.js';
import { conformanceHost, documents, notebook } from './notebook.js';
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

describe('a note that embeds its own name (#147)', () => {
  const FOTO = '---\nname: foto.jpg\n---\n\n![[foto.jpg]]\n';
  const OTHER = '---\nname: foto.jpg\n---\n\nAnother note named foto.jpg.\n';
  /** The notebook drawing its first note, by the address the host gives it. */
  const drawingFirst = (notes: string[], files: string[]) => {
    const host = documents(notes, files);
    return { ...host, noteAddress: host.notes[0]!.address };
  };
  const files = (container: HTMLElement) => container.querySelectorAll('[class^="attachment"]');

  it('draws the file of that name, which nothing else answers', async () => {
    mounted = await draw(FOTO, drawingFirst([FOTO], ['foto.jpg']));
    await settle();
    expect(files(mounted.container)).toHaveLength(1);
    expect(mounted.container.querySelector('figure.embed, .embed-pending')).toBeNull();
  });

  it('is pending when the notebook keeps no file of that name', async () => {
    mounted = await draw(FOTO, drawingFirst([FOTO], []));
    await settle();
    expect(mounted.container.querySelector('.embed-pending')?.textContent).toBe('foto.jpg');
  });

  it('transcludes another note of that name before the file, loaded by its address', async () => {
    const host = drawingFirst([FOTO, OTHER], ['foto.jpg']);
    const asked: string[] = [];
    mounted = await draw(FOTO, { ...host, loadNoteAt: (address) => (asked.push(address), host.loadNoteAt!(address)) });
    await settle();
    expect(mounted.container.querySelector('figure.embed .embed-body')?.textContent).toContain('Another note named foto.jpg.');
    expect(asked).toEqual(['/notes/1']);
    expect(files(mounted.container)).toHaveLength(0);
  });

  it('is pending, as an ambiguous embed is, under a host that cannot load by address', async () => {
    const { loadNoteAt: _, ...host } = drawingFirst([FOTO, OTHER], ['foto.jpg']);
    mounted = await draw(FOTO, host);
    await settle();
    expect(mounted.container.querySelector('.embed-pending')?.textContent).toBe('foto.jpg');
  });

  it('excludes nothing when the host gives no address: a draft is not a note it counts', async () => {
    const { noteAddress: _, ...host } = drawingFirst([OTHER], ['foto.jpg']);
    mounted = await draw(FOTO, host);
    await settle();
    expect(mounted.container.querySelector('figure.embed .embed-body')?.textContent).toContain('Another note named foto.jpg.');
  });

  it('draws the file of its own alias, once the host says nothing else carries it', async () => {
    const OBRA = '---\nname: Foto da obra\naliases: [obra.jpg]\n---\n\n![[obra.jpg|120]]\n';
    mounted = await draw(OBRA, drawingFirst([OBRA], ['obra.jpg']));
    await settle();
    expect(files(mounted.container)).toHaveLength(1);
    expect(mounted.container.querySelector('figure.embed, .embed-pending')).toBeNull();
  });

  it('keeps a link to a section of its own note a link', async () => {
    const SECTION = '---\nname: x\n---\n\nSee [[x#Below]].\n\n## Below\n';
    mounted = await draw(SECTION, drawingFirst([SECTION], []));
    expect(mounted.container.querySelector('a.wikilink')?.textContent).toContain('x#Below');
    expect(mounted.container.querySelector('.wikilink-pending')).toBeNull();
  });

  it('is read as the embedded note reads it, inside its content', async () => {
    // A embeds the note foto.jpg, whose own `![[foto.jpg]]` is, for it, the file of that name.
    const A = '---\nname: A\n---\n\n![[foto.jpg]]\n';
    const host = documents([A, FOTO], ['foto.jpg']);
    mounted = await draw(A, { ...host, noteAddress: host.notes[0]!.address });
    await settle();
    const body = mounted.container.querySelector('figure.embed .embed-body')!;
    expect(files(body as HTMLElement)).toHaveLength(1);
    expect(body.querySelector('a.wikilink, .wikilink-pending')).toBeNull();
  });

  it('draws the file in the editor too', async () => {
    mounted = await mount(<NoteEditor markdown={FOTO} {...drawingFirst([FOTO], ['foto.jpg'])} />);
    await settle();
    expect(files(mounted.container.querySelector('.cm-content')!)).toHaveLength(1);
    expect(mounted.container.querySelector('.cm-content figure.embed')).toBeNull();
  });
});

describe('the conformance suite', () => {
  const KIND = { note: 'note', choice: 'note', file: 'attachment', pending: 'pending' } as const;
  const EMBED = /!\[\[([^\]|#]+)/g;
  const embedding = cases.flatMap((testCase) => {
    if (!testCase.notebook) return [];
    const embedded = new Set([...testCase.markdown.matchAll(EMBED)].map((match) => match[1]!.trim()));
    const outcomes = testCase.resolution.filter((outcome) => embedded.has(outcome.target));
    return outcomes.length > 0 ? [{ testCase, outcomes }] : [];
  });

  it('has embeds to resolve', () => {
    expect(embedding.length).toBeGreaterThan(0);
  });

  for (const { testCase, outcomes } of embedding) {
    it(testCase.id, async () => {
      const given = conformanceHost(testCase.markdown, testCase.notebook);
      const host = drawing(resolveHost(given), drawnNote(given.noteAddress, testCase.markdown));
      for (const outcome of outcomes) {
        const { kind } = await embedTarget(host, outcome.target);
        expect({ target: outcome.target, kind: KIND[kind] }).toEqual({ target: outcome.target, kind: outcome.kind });
      }
    });
  }
});
