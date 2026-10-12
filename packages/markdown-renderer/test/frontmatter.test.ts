/**
 * The frontmatter a host shows as properties, read the way MemorySmith reads
 * it: a value is a list by the form the author wrote, never by the number of
 * values that form happens to hold.
 */

import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from '../src/markdown.js';

const doc = (frontmatter: string): string => `---\n${frontmatter}\n---\n\nBody.\n`;

describe('a frontmatter value is classified by the form it was written in', () => {
  it('reads an inline list of one item as a list', () => {
    const { frontmatter, lists } = splitFrontmatter(doc('tags: [contracts]'));
    expect(lists.has('tags')).toBe(true);
    expect(frontmatter['tags']).toBe('contracts');
  });

  it('reads a dash list of one item as a list', () => {
    const { lists } = splitFrontmatter(doc('tags:\n  - contracts'));
    expect(lists.has('tags')).toBe(true);
  });

  it('keeps a scalar out of the lists, so it is not drawn as chips', () => {
    const { lists } = splitFrontmatter(doc('tags: contracts'));
    expect(lists.has('tags')).toBe(false);
  });

  it('does not change what an attribute is when a second value arrives', () => {
    const one = splitFrontmatter(doc('tags: [contracts]'));
    const two = splitFrontmatter(doc('tags: [contracts, budget]'));
    expect(one.lists.has('tags')).toBe(two.lists.has('tags'));
    expect(two.frontmatter['tags']).toBe('contracts, budget');
  });

  it('strips one layer of quotes, and returns the body after the block', () => {
    const { frontmatter, body } = splitFrontmatter(doc('name: "Lei 14.133"\nwhen: 2026-09-06'));
    expect(frontmatter['name']).toBe('Lei 14.133');
    expect(frontmatter['when']).toBe('2026-09-06');
    expect(body).toBe('\nBody.\n');
  });

  it('reads a note with no frontmatter as all body', () => {
    expect(splitFrontmatter('# Title\n')).toEqual({ frontmatter: {}, lists: new Set(), body: '# Title\n' });
  });
});
