/**
 * The samples the playground keeps (#77): one of each type MemorySmith accepts, each on disk under
 * the name `fixtures/files.json` gives it, with a description.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIXTURES = resolve(__dirname, '..', 'fixtures');
const listed: { name: string; mimeType: string; description: string }[] = JSON.parse(readFileSync(join(FIXTURES, 'files.json'), 'utf8'));

describe('the sample files', () => {
  it('are one of each of the sixteen types MemorySmith accepts', () => {
    expect(new Set(listed.map((each) => each.mimeType)).size).toBe(16);
    expect(listed).toHaveLength(16);
  });

  it('are on disk under the names the manifest gives, and nothing else is', () => {
    for (const { name } of listed) expect(existsSync(join(FIXTURES, 'files', name))).toBe(true);
    expect(readdirSync(join(FIXTURES, 'files')).sort()).toEqual(listed.map((each) => each.name).sort());
  });

  it('each say what they are', () => {
    for (const { description } of listed) expect(description.length).toBeGreaterThan(0);
  });
});
