// What the release workflow decides on a push to `main`. Run from the root: `pnpm test`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan } from './release.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.1.0] - 2026-10-12

### Added

- The first version.

[unreleased]: https://github.com/o/r/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/o/r/releases/tag/v0.1.0
`;

const HEAD = 'a'.repeat(40);
const REPO = 'o/r';

test('releases a version whose section exists and whose tag does not', () => {
  const result = plan({ version: '0.1.0', changelog: CHANGELOG, repository: REPO, tagCommit: null, headCommit: HEAD });
  assert.equal(result.action, 'release');
  assert.equal(result.tag, 'v0.1.0');
  assert.equal(result.notes, '### Added\n\n- The first version.');
});

test('does nothing when the tag already names this commit', () => {
  assert.equal(plan({ version: '0.1.0', changelog: CHANGELOG, repository: REPO, tagCommit: HEAD, headCommit: HEAD }).action, 'tagged');
});

test('fails when the tag names another commit', () => {
  const result = plan({ version: '0.1.0', changelog: CHANGELOG, repository: REPO, tagCommit: 'b'.repeat(40), headCommit: HEAD });
  assert.equal(result.action, 'fail');
  assert.match(result.reason, /a version names one commit/);
});

test('does nothing when the version has no released section', () => {
  const unreleased = CHANGELOG.replace('## [0.1.0] - 2026-10-12', '## [0.0.9] - 2026-10-01');
  assert.equal(plan({ version: '0.1.0', changelog: unreleased, repository: REPO, tagCommit: null, headCommit: HEAD }).action, 'skip');
});

test('fails on a version that is not SemVer', () => {
  assert.equal(plan({ version: 'one', changelog: CHANGELOG, repository: REPO, tagCommit: null, headCommit: HEAD }).action, 'fail');
});

test('does nothing in a repository whose changelog links to another one', () => {
  const result = plan({ version: '0.1.0', changelog: CHANGELOG, repository: 'memorysmithapp/created-from-template', tagCommit: null, headCommit: HEAD });
  assert.equal(result.action, 'skip');
  assert.match(result.reason, /links to o\/r, not to memorysmithapp\/created-from-template/);
});

test('does nothing, rather than fail, when a copied changelog meets a tag of its own version', () => {
  assert.equal(plan({ version: '0.1.0', changelog: CHANGELOG, repository: 'o/other', tagCommit: 'b'.repeat(40), headCommit: HEAD }).action, 'skip');
});

test('compares the repository without regard to case', () => {
  assert.equal(plan({ version: '0.1.0', changelog: CHANGELOG, repository: 'O/R', tagCommit: null, headCommit: HEAD }).action, 'release');
});
