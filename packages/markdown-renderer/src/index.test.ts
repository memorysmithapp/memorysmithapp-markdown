import { describe, expect, it } from 'vitest';
import * as entry from './index';

describe('the package entry', () => {
  it('loads in a DOM', () => {
    expect(entry).toBeTypeOf('object');
    expect(typeof document).toBe('object');
  });
});
