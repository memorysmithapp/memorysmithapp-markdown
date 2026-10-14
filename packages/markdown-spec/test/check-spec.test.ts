// The checker refuses each way the document, the data and the suite can drift apart. Each test
// runs it against a copy of this package carrying one deliberate defect.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const PACKAGE = resolve(__dirname, '..');
const CHECKER = join(PACKAGE, 'tools', 'check-spec.mjs');
const copies: string[] = [];

function copy(): string {
  const root = mkdtempSync(join(tmpdir(), 'markdown-spec-'));
  copies.push(root);
  for (const path of ['SPEC.md', 'spec.json', 'package.json', 'schema', 'tests']) {
    cpSync(join(PACKAGE, path), join(root, path), { recursive: true });
  }
  return root;
}

function editJson(root: string, path: string, edit: (value: any) => void): void {
  const value = JSON.parse(readFileSync(join(root, path), 'utf8'));
  edit(value);
  writeFileSync(join(root, path), JSON.stringify(value, null, 2));
}

function check(root: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync(process.execPath, [CHECKER, root], { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stdout: string; stderr: string };
    return { ok: false, output: `${failure.stdout}${failure.stderr}` };
  }
}

afterEach(() => {
  for (const root of copies.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-spec', () => {
  it('passes on the package as it is', () => {
    const result = check(copy());
    expect(result.output).toMatch(/The specification is consistent/);
    expect(result.ok).toBe(true);
  });

  it('fails when SPEC.md is missing, instead of skipping it', () => {
    const root = copy();
    rmSync(join(root, 'SPEC.md'));
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/SPEC\.md: is missing/);
  });

  it('fails on a notation an indexer decides that has no case', () => {
    const root = copy();
    editJson(root, 'spec.json', (spec) => {
      spec.notations.push({ id: 'uncovered-form', reader: 'links', syntax: 'x', example: 'x', effect: 'x' });
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/has no case for "uncovered-form"/);
  });

  it('accepts a reading-surface notation with no case, which the renderer proves', () => {
    const root = copy();
    editJson(root, 'spec.json', (spec) => {
      spec.notations.push({ id: 'drawn-form', reader: 'reading-surface', syntax: 'x', example: 'x', effect: 'x' });
    });
    expect(check(root).ok).toBe(true);
  });

  it('fails on a case naming a notation that does not exist', () => {
    const root = copy();
    editJson(root, 'tests/conformance.json', (suite) => {
      suite.cases[0].notation = 'no-such-notation';
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/exercises "no-such-notation", which spec.json does not declare/);
  });

  it('fails when the url does not name the version of the package', () => {
    const root = copy();
    editJson(root, 'package.json', (manifest) => {
      manifest.version = '9.9.9';
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/does not name SPEC\.md at the tag of the version 9\.9\.9/);
  });

  it('fails when the url points at main instead of a tag', () => {
    const root = copy();
    editJson(root, 'spec.json', (spec) => {
      spec.url = 'https://github.com/memorysmithapp/memorysmithapp-markdown/blob/main/packages/markdown-spec/SPEC.md';
    });
    expect(check(root).ok).toBe(false);
  });

  it('fails on a notice no case raises', () => {
    const root = copy();
    editJson(root, 'tests/conformance.json', (suite) => {
      suite.cases = suite.cases.filter((testCase: { notices?: { code: string }[] }) =>
        !(testCase.notices ?? []).some((notice) => notice.code === 'raw-html'),
      );
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/has no case raising the notice "raw-html"/);
  });

  it('fails on a case raising a notice spec.json does not declare', () => {
    const root = copy();
    editJson(root, 'tests/conformance.json', (suite) => {
      suite.cases.push({ id: 'notice/invented', notation: 'raw-html', markdown: 'x', notices: [{ code: 'no-such-notice', line: 1 }] });
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/raises the notice "no-such-notice", which spec.json does not declare/);
  });

  it('fails when the table of notices in SPEC.md and spec.json disagree', () => {
    const root = copy();
    editJson(root, 'spec.json', (spec) => {
      spec.notices.find((notice: { code: string }) => notice.code === 'tags-missing').severity = 'notice';
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/lists the notice "tags-missing" as hint under § 6\.4, and spec.json as notice under § 6\.4/);
  });

  it('fails when SPEC.md lists a notice spec.json does not declare', () => {
    const root = copy();
    const path = join(root, 'SPEC.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('| `raw-html` |', '| `raw-html` | notice | §7.9 | x |\n| `html-raw` |'));
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/does not declare the notice "html-raw" that SPEC\.md lists/);
  });

  it('refuses a schema keyword it does not implement', () => {
    const root = copy();
    editJson(root, 'schema/spec.schema.json', (schema) => {
      schema.maxProperties = 99;
    });
    const result = check(root);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/uses the keyword "maxProperties"/);
  });
});
