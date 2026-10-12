/**
 * The address of an attachment, across the parser.
 *
 * `resolveWikilinks` writes `attachment:<name>|<dimension>` and the anchor of the surface
 * reads it back, and between the two stands **react-markdown**, which
 * percent-encodes a destination. That seam is what the unit case of the
 * resolver cannot see: it asserted the string that goes in, the anchor asserts
 * the props that come out, and the encoding in the middle belonged to neither.
 *
 * It shipped a regression exactly there — the separator arrived as `%7C`, the
 * split found no pipe, and the whole string went looking for a file called
 * `picture.svg|120`, which no notebook keeps. Every embed that asked for a
 * size disappeared from the page and was reported as a file that is not there.
 *
 * A file the notebook does NOT keep is what these cases use on purpose: it is
 * the one branch that renders without asking the host to draw anything, and the
 * name it prints is exactly what the address decoded to.
 */

import { describe, expect, it } from 'vitest';
import { html } from './render.js';

/** The surface with no host: the notebook keeps nothing, which is the branch these cases need. */
const render = (markdown: string): string => html(markdown);

/** What the missing-file span printed, which is the name the address decoded to. */
function nameShown(html: string): string {
  const found = /class="attachment-missing"[^>]*>([^<]*)</.exec(html);
  return found?.[1] ?? '';
}

describe('the dimension survives the parser, and the name arrives whole', () => {
  it('takes the dimension off the address and leaves the name', () => {
    expect(nameShown(render('[x](attachment:engelbart.jpg|120)'))).toBe('engelbart.jpg');
    expect(nameShown(render('[x](attachment:engelbart.jpg|100x145)'))).toBe('engelbart.jpg');
  });

  it('keeps a name that has no dimension after it exactly as it is', () => {
    expect(nameShown(render('[x](attachment:engelbart.jpg)'))).toBe('engelbart.jpg');
  });

  it('decodes a name the parser had to encode, spaces and accents included', () => {
    const encoded = encodeURIComponent('esquema de blocos');
    expect(nameShown(render(`[x](attachment:${encoded}|80)`))).toBe('esquema de blocos');
    expect(nameShown(render(`[x](attachment:${encodeURIComponent('diagrama é isso')})`))).toBe(
      'diagrama é isso',
    );
  });

  it('leaves a value that is not a dimension inside the name, applying nothing', () => {
    // `100x` is not a dimension, so there is nothing to take off: what remains
    // is a name, and the notebook keeps nothing under it.
    expect(nameShown(render('[x](attachment:engelbart.jpg|grande)'))).toBe('engelbart.jpg|grande');
  });
});
