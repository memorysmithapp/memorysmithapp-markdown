/**
 * The property the delegated list exists for: an entry the specification adds
 * that is neither asserted nor delegated fails the build. The conformance test
 * is run, as its own process, against a copy of the specification's data with
 * one fake `reading-surface` entry added, and it has to fail on that entry.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spec } from '@memorysmithapp/markdown-spec';
import { describe, expect, it } from 'vitest';
import { DELEGATED_TO_THE_BASE_PARSER, unclassified } from '../src/delegated.js';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('an entry nobody classified', () => {
  it('is reported by unclassified', () => {
    const notations = [...spec.notations, { id: 'a-form-added-later', reader: 'reading-surface' }];
    expect(unclassified(notations, new Set(['callout']), DELEGATED_TO_THE_BASE_PARSER)).toContain('a-form-added-later');
  });

  it('fails the conformance suite', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'spec-fixture-'));
    try {
      const fixture = join(scratch, 'spec.json');
      writeFileSync(
        fixture,
        JSON.stringify({
          ...spec,
          notations: [
            ...spec.notations,
            { id: 'a-form-added-later', reader: 'reading-surface', syntax: '@@x@@', example: '@@x@@', effect: 'Something new.' },
          ],
        }),
      );
      const run = spawnSync(
        process.execPath,
        [join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--project', 'markdown-renderer', 'test/reading-surface-conformance.test.tsx'],
        { cwd: ROOT, env: { ...process.env, MARKDOWN_SPEC_FIXTURE: fixture }, encoding: 'utf8' },
      );
      const output = `${run.stdout}${run.stderr}`;
      expect(run.status, output).not.toBe(0);
      expect(output).toContain('no reading-surface expectation written for "a-form-added-later"');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);
});
