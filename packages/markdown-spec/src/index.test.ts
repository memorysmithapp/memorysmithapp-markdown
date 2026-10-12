import { describe, expect, it } from 'vitest';
import * as entry from './index';

describe('the package entry', () => {
  it('loads', () => {
    expect(entry).toBeTypeOf('object');
  });
});
