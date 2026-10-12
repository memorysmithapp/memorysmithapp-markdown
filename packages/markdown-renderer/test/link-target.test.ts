/**
 * The target the reading surface reads out of a wikilink, held to the cases of
 * the specification an extractor runs, read from `@memorysmithapp/markdown-spec`.
 *
 * The specification resolves a link against the **name** of a note: a
 * wikilink target is literal, nothing in it is decoded, no extension is
 * removed and no path segment is discarded (§5.2). So what has to agree with
 * an extractor is not a computation — it is a reading, and this is where the
 * reading surface is held to the same cases.
 */

import { describe, expect, it } from 'vitest';
import { cases as CONFORMANCE_CASES, type ConformanceCase } from '@memorysmithapp/markdown-spec';
import { resolveWikilinks } from '../src/markdown.js';

/** The wikilink cases: the Markdown form is the backend's to tolerate. */
const wikilinkCases = CONFORMANCE_CASES.filter(
  (each) => (each.links?.length ?? 0) > 0 && /\[\[/.test(each.markdown),
);

/** What the reading surface asks the resolver for, in order. */
function targetsAskedFor(markdown: string): string[] {
  const asked: string[] = [];
  resolveWikilinks(markdown, (name) => {
    asked.push(name);
    return null;
  });
  return asked;
}

describe('the reading surface reads the target the specification states', () => {
  it.each(wikilinkCases)('$id', (each: ConformanceCase) => {
    const expected = (each.links ?? []).map((link) => link.name);
    for (const asked of targetsAskedFor(each.markdown)) {
      expect(expected, `${asked} is not a target this case declares`).toContain(asked);
    }
  });

  /**
   * Code is the one place the rewrite can lose a link as well as invent one: a
   * span showing three backticks read as a fence hid every link up to the next
   * one. So these cases are held both ways — every target it asks for is
   * declared, and every declared target is asked for.
   */
  it.each(CONFORMANCE_CASES.filter((each) => each.notation === 'link-in-code'))(
    '$id finds the code the extractor finds',
    (each: ConformanceCase) => {
      const expected = (each.links ?? []).map((link) => link.name);
      expect([...new Set(targetsAskedFor(each.markdown))].sort()).toEqual([...expected].sort());
    },
  );

  it('asks for the name literally, without folding anything', () => {
    expect(targetsAskedFor('Ver [[Lei 14.133]].')).toEqual(['Lei 14.133']);
    expect(targetsAskedFor('Ver [[Reunião 03/09/2026]].')).toEqual(['Reunião 03/09/2026']);
    expect(targetsAskedFor('Ver [[Lei 14.133.md]].')).toEqual(['Lei 14.133.md']);
    expect(targetsAskedFor('Ver [[Índice#Castas]].')).toEqual(['Índice']);
    expect(targetsAskedFor('Ver [[Lei 14.133|a nova lei]].')).toEqual(['Lei 14.133']);
  });

  it('normalises to NFC and folds nothing else, so case is exact', () => {
    const decomposed = 'Ver [[Ação]].'.normalize('NFD');
    expect(targetsAskedFor(decomposed)).toEqual(['Ação'.normalize('NFC')]);
    expect(targetsAskedFor('Ver [[lei 14.133]].')).toEqual(['lei 14.133']);
  });

  it('reads the escaped pipe of a table cell as the end of the target', () => {
    expect(targetsAskedFor('| Onde | [[Lei 14.133\\|art. 75]] |')).toEqual(['Lei 14.133']);
  });
});
