/**
 * A wikilink inside transcluded content is a link.
 *
 * `Transclusion` once rendered its content straight, while every other run of
 * the note resolved the wikilinks first, so a `[[link]]` inside an embedded
 * note reached the page with its brackets. The sharpest case is the one the
 * one-level rule creates itself: an embed found inside embedded content is
 * demoted to a wikilink — and that embed is drawn as **a link** to its
 * target. Raw text is not a link.
 *
 * This is the composition `Transclusion` performs, at the level of the text;
 * `embeds.test.tsx` draws it.
 */

import { describe, expect, it } from 'vitest';
import { demoteEmbeds } from '../src/transclusion.js';
import { resolveWikilinks } from '../src/markdown.js';

const CABERNET = '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/notes/01j8x2k9qz3m4n5p6r7s8t9v0w';

/** A notebook where one note exists and the other does not. */
const resolve = (name: string): string | null => (name === 'Cabernet Sauvignon' ? CABERNET : null);

const render = (body: string): string => resolveWikilinks(demoteEmbeds(body), resolve);

describe('an embed inside embedded content becomes a link, not text', () => {
  it('resolves the demoted block embed that was reported raw', () => {
    const out = render('![[Cabernet Sauvignon#^brix-engana]]');

    expect(out).not.toContain('[[');
    expect(out).toContain(CABERNET);
  });

  it('resolves a demoted whole-note embed', () => {
    expect(render('![[Cabernet Sauvignon]]')).toContain(CABERNET);
  });

  it('keeps the visible text of the target', () => {
    expect(render('![[Cabernet Sauvignon]]')).toContain('Cabernet Sauvignon');
  });
});

describe('a plain wikilink inside transcluded content behaves as it does outside', () => {
  it('resolves one whose target exists', () => {
    const out = render('Ver [[Cabernet Sauvignon]] para a estrutura.');

    expect(out).not.toContain('[[');
    expect(out).toContain(CABERNET);
  });

  it('marks one whose target does not exist as pending, and never as raw text', () => {
    // Visibly pending is the specification's rule, and it does not stop being the
    // rule because the note is being read inside another one.
    const out = render('Ver [[Correlação IPT e safra fria]].');

    expect(out).not.toContain('[[');
    expect(out).toContain('pending:');
  });

  it('keeps the alias form showing what the author wrote', () => {
    expect(render('Ver [[Cabernet Sauvignon|a casta]].')).toContain('a casta');
  });
});
