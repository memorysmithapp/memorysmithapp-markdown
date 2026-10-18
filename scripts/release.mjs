#!/usr/bin/env node
// Decides what the release workflow does on a push to `main`, so that nobody tags by hand:
//
//   1. read the version of the root package.json;
//   2. if the links at the foot of CHANGELOG.md do not name this repository, nothing is released:
//      the changelog is a copy of another repository's, as in a repository just created from
//      memorysmithapp-template and not adopted yet;
//   3. if the tag vX.Y.Z exists on this commit, nothing is tagged; if on an earlier commit of this
//      history, nothing is released, because the version was released before this push; if on a
//      commit outside this history, fail, because a version names one commit;
//   4. if CHANGELOG.md has no released section for the version, nothing is released;
//   5. otherwise release: write the notes of that section, for the annotated tag and the Release.
//
// Prints `action=…` and `tag=…` for $GITHUB_OUTPUT; the action is `skip`, `tagged` or `release`.
//   node scripts/release.mjs <notes-file>

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSemver, linkedRepositories, namesRepository, parseChangelog, releaseNotes, repositoryFromRemote } from './lib/changelog.mjs';

export function plan({ version, changelog, repository, tagCommit, headCommit, tagIsAncestor = false }) {
  if (!isSemver(version)) return { action: 'fail', reason: `package.json: "version" is not a SemVer version (${JSON.stringify(version)})` };
  const tag = `v${version}`;
  const parsed = parseChangelog(changelog);
  if (!namesRepository(parsed, repository)) {
    const linked = [...linkedRepositories(parsed)].join(', ') || 'no repository';
    return { action: 'skip', tag, reason: `CHANGELOG.md links to ${linked}, not to ${repository}: it is not this repository's changelog yet` };
  }
  if (tagCommit) {
    if (tagCommit === headCommit) return { action: 'tagged', tag, reason: `${tag} already names this commit` };
    if (tagIsAncestor) return { action: 'skip', tag, reason: `${tag} names ${tagCommit}, released before this commit: this push is not a release` };
    return { action: 'fail', tag, reason: `${tag} already names ${tagCommit}, not ${headCommit}: a version names one commit` };
  }
  const notes = releaseNotes(parsed, version);
  if (notes === null) return { action: 'skip', tag, reason: `CHANGELOG.md has no released section [${version}]: this push is not a release` };
  return { action: 'release', tag, notes, reason: `releasing ${tag}` };
}

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const notesFile = process.argv[2];
  if (!notesFile) {
    console.error('usage: node scripts/release.mjs <notes-file>');
    process.exit(2);
  }
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY || repositoryFromRemote(git('remote', 'get-url', 'origin'));
  if (!repository) {
    console.error('cannot tell which repository this is: set GITHUB_REPOSITORY or add an origin remote on GitHub');
    process.exit(1);
  }
  const tagCommit = git('rev-parse', '--quiet', '--verify', `refs/tags/v${version}^{commit}`);
  const result = plan({
    version,
    changelog: readFileSync('CHANGELOG.md', 'utf8'),
    repository,
    tagCommit,
    headCommit: git('rev-parse', 'HEAD'),
    // `git merge-base --is-ancestor` prints nothing and exits 0 when it is, 1 when it is not.
    tagIsAncestor: tagCommit !== null && git('merge-base', '--is-ancestor', tagCommit, 'HEAD') !== null,
  });
  console.error(result.reason);
  if (result.action === 'fail') process.exit(1);
  if (result.action === 'release') writeFileSync(notesFile, `${result.notes}\n`);
  console.log(`action=${result.action}`);
  console.log(`tag=${result.tag}`);
}
