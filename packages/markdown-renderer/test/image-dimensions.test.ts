/**
 * The dimensions an image carries in its alt text (§3.14). The crossing with
 * the attachment a notebook keeps, the other half of the pipe, is tested with
 * the wikilinks.
 */

import { describe, expect, it } from 'vitest';
import { readDimensions, readImageAlt, sizedAttributes, writeDimensions } from '../src/image-dimensions.js';

describe('the pipe in an alt text separates the description from the dimensions', () => {
  it('reads width and height, and keeps the description', () => {
    expect(readImageAlt('Engelbart|100x145')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: 145,
      percent: null,
    });
  });

  it('reads a width on its own, which keeps the aspect ratio', () => {
    expect(readImageAlt('Engelbart|100')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: null,
      percent: null,
    });
  });

  it('leaves a value that is not a dimension inside the description', () => {
    // Deleting what an author wrote into an accessibility label is the worse
    // of the two failures, so `large` stays and nothing is applied.
    expect(readImageAlt('Engelbart|large')).toEqual({
      description: 'Engelbart|large',
      width: null,
      height: null,
      percent: null,
    });
    expect(readImageAlt('A curve|100x')).toEqual({
      description: 'A curve|100x',
      width: null,
      height: null,
      percent: null,
    });
  });

  it('never drops the description, which is what a reader hears', () => {
    expect(readImageAlt('Engelbart').description).toBe('Engelbart');
    expect(readImageAlt('|100').description).toBe('');
  });

  it('reads the same dimension after the pipe of an embed', () => {
    expect(readDimensions('100x145')).toEqual({ width: 100, height: 145, percent: null });
    expect(readDimensions(' 120 ')).toEqual({ width: 120, height: null, percent: null });
    expect(readDimensions('grande')).toBeNull();
  });
});

describe('a width as a share of the page (#108)', () => {
  it('reads 1% to 100% as a width, with no height', () => {
    expect(readImageAlt('Curva|50%')).toEqual({ description: 'Curva', width: null, height: null, percent: 50 });
    expect(readDimensions('100%')).toEqual({ width: null, height: null, percent: 100 });
    expect(readDimensions('1%')).toEqual({ width: null, height: null, percent: 1 });
  });

  it('leaves any other percentage, a height in percent and a mixed pair in the description', () => {
    for (const value of ['0%', '150%', '33.3%', '50 %', '50%x180', '300x50%', '%', '050%x']) {
      expect(readImageAlt(`Curva|${value}`), value).toEqual({ description: `Curva|${value}`, width: null, height: null, percent: null });
    }
  });

  it('is written back as it is read, and drawn as a maximum width', () => {
    expect(writeDimensions({ width: null, height: null, percent: 50 })).toBe('50%');
    expect(writeDimensions({ width: 300, height: 180, percent: null })).toBe('300x180');
    expect(writeDimensions({ width: 300, height: null, percent: null })).toBe('300');
    expect(sizedAttributes({ width: null, height: null, percent: 50 })).toEqual({ style: { maxWidth: '50%' } });
    expect(sizedAttributes({ width: 300, height: null, percent: null })).toEqual({ width: 300 });
  });
});

describe('a Markdown image at a share of the page (#108)', () => {
  it('is drawn at most at that share, and the rest stays the description', async () => {
    const { html } = await import('./render.js');
    expect(html('![Curva|50%](https://example.org/curva.png)')).toContain('<img src="https://example.org/curva.png" alt="Curva" title="Curva" style="max-width:50%"/>');
    expect(html('![Curva|50%x180](https://example.org/curva.png)')).toContain('alt="Curva|50%x180"');
  });
});
