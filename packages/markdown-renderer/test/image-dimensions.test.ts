/**
 * The dimensions an image carries in its alt text (§3.14). The crossing with
 * the attachment a notebook keeps, the other half of the pipe, is tested with
 * the wikilinks.
 */

import { describe, expect, it } from 'vitest';
import { readDimensions, readImageAlt } from '../src/image-dimensions.js';

describe('the pipe in an alt text separates the description from the dimensions', () => {
  it('reads width and height, and keeps the description', () => {
    expect(readImageAlt('Engelbart|100x145')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: 145,
    });
  });

  it('reads a width on its own, which keeps the aspect ratio', () => {
    expect(readImageAlt('Engelbart|100')).toEqual({
      description: 'Engelbart',
      width: 100,
      height: null,
    });
  });

  it('leaves a value that is not a dimension inside the description', () => {
    // Deleting what an author wrote into an accessibility label is the worse
    // of the two failures, so `large` stays and nothing is applied.
    expect(readImageAlt('Engelbart|large')).toEqual({
      description: 'Engelbart|large',
      width: null,
      height: null,
    });
    expect(readImageAlt('A curve|100x')).toEqual({
      description: 'A curve|100x',
      width: null,
      height: null,
    });
  });

  it('never drops the description, which is what a reader hears', () => {
    expect(readImageAlt('Engelbart').description).toBe('Engelbart');
    expect(readImageAlt('|100').description).toBe('');
  });

  it('reads the same dimension after the pipe of an embed', () => {
    expect(readDimensions('100x145')).toEqual({ width: 100, height: 145 });
    expect(readDimensions(' 120 ')).toEqual({ width: 120, height: null });
    expect(readDimensions('grande')).toBeNull();
  });
});
