// What the release workflow publishes to npm. Run from the root: `pnpm test`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planPublish } from './publish.mjs';

const PACKAGES = [
  { dir: 'packages/a', name: '@memorysmithapp/a', version: '0.2.0' },
  { dir: 'packages/b', name: '@memorysmithapp/b', version: '0.2.0' },
];
const nowhere = () => false;

test('publishes every package on a release', () => {
  const result = planPublish({ action: 'release', tag: 'v0.2.0', packages: PACKAGES, published: nowhere });
  assert.equal(result.action, 'publish');
  assert.deepEqual(result.publish.map((pkg) => pkg.name), ['@memorysmithapp/a', '@memorysmithapp/b']);
});

test('publishes nothing on a push that is not a release', () => {
  const result = planPublish({ action: 'skip', tag: 'v0.2.0', packages: PACKAGES, published: nowhere });
  assert.equal(result.action, 'skip');
  assert.deepEqual(result.publish, []);
});

test('publishes only the version of the tag', () => {
  const behind = [PACKAGES[0], { ...PACKAGES[1], version: '0.1.9' }];
  const result = planPublish({ action: 'release', tag: 'v0.2.0', packages: behind, published: nowhere });
  assert.equal(result.action, 'fail');
  assert.match(result.reason, /@memorysmithapp\/b is at 0\.1\.9, not at 0\.2\.0/);
});

test('fails on a release whose version already exists on npm', () => {
  const result = planPublish({ action: 'release', tag: 'v0.2.0', packages: PACKAGES, published: (name) => name === '@memorysmithapp/b' });
  assert.equal(result.action, 'fail');
  assert.match(result.reason, /@memorysmithapp\/b@0\.2\.0 already exists on npm/);
});

test('finishes a release that failed halfway, run again on its tag', () => {
  const result = planPublish({ action: 'tagged', tag: 'v0.2.0', packages: PACKAGES, published: (name) => name === '@memorysmithapp/a' });
  assert.equal(result.action, 'publish');
  assert.deepEqual(result.publish.map((pkg) => pkg.name), ['@memorysmithapp/b']);
});

test('does nothing when a release run again finds every package published', () => {
  assert.equal(planPublish({ action: 'tagged', tag: 'v0.2.0', packages: PACKAGES, published: () => true }).action, 'skip');
});

test("leaves a package npm has never seen for the owner's first publish, and does not fail", () => {
  const result = planPublish({ action: 'release', tag: 'v0.2.0', packages: PACKAGES, published: nowhere, exists: (name) => name === '@memorysmithapp/a' });
  assert.equal(result.action, 'publish');
  assert.deepEqual(result.publish.map((pkg) => pkg.name), ['@memorysmithapp/a']);
  assert.deepEqual(result.first, ['@memorysmithapp/b']);
  assert.match(result.reason, /the first publish is the owner's/);
  assert.equal(planPublish({ action: 'release', tag: 'v0.2.0', packages: PACKAGES, published: nowhere, exists: () => false }).action, 'skip');
});

test('asks npm about the version of the tag, and nothing else', () => {
  const asked = [];
  planPublish({ action: 'release', tag: 'v0.2.0', packages: PACKAGES, published: (name, version) => (asked.push(`${name}@${version}`), false) });
  assert.deepEqual(asked, ['@memorysmithapp/a@0.2.0', '@memorysmithapp/b@0.2.0']);
});

test('a package ships its built modules and the files named for it, and nothing else', async () => {
  const { builtModules, checkPack, caseCollisions } = await import('./pack-check.mjs');
  assert.deepEqual(builtModules(['index.ts', 'Note.tsx', 'note.test.tsx', 'json.d.ts']), ['dist/index.d.ts', 'dist/index.js', 'dist/Note.d.ts', 'dist/Note.js']);
  const expected = ['README.md', 'dist/index.js', 'package.json'];
  assert.deepEqual(checkPack('p', [...expected], expected), []);
  assert.match(checkPack('p', [...expected, 'test/a.test.ts'], expected)[0], /test\/a\.test\.ts is packed and is not meant to ship/);
  assert.match(checkPack('p', ['dist/index.js', 'package.json'], expected)[0], /README\.md is meant to ship and is not packed/);
  assert.deepEqual(caseCollisions('p', ['dist/Markdown.js', 'dist/source.js', 'dist/Markdown.d.ts']), []);
  const collided = caseCollisions('p', ['dist/Markdown.js', 'dist/markdown.js', 'dist/Markdown.d.ts', 'dist/markdown.d.ts']);
  assert.match(collided[0], /dist\/Markdown\.js and dist\/markdown\.js differ only in case/);
  assert.match(collided[1], /dist\/Markdown\.d\.ts and dist\/markdown\.d\.ts differ only in case/);
});
