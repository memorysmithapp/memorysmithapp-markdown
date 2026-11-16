#!/usr/bin/env node
// Closes the milestone of a version once the release workflow has released it and published its
// packages to npm, so that a version that is done no longer reads as one in progress (docs/SDLC.md
// §10 describes the flow). A release whose publish failed never reaches this step, and its
// milestone stays open until a run started again on its tag finishes the publish:
//
//   1. find the milestone named after the tag, vX.Y.Z; with none, say so and go on;
//   2. if it is closed already, nothing to do;
//   3. if it still holds an open issue or pull request, leave it open and name each one:
//      moving them to the next milestone is a person's decision, and the release does not fail;
//   4. otherwise close it.
//
// Writes what it did to the run summary ($GITHUB_STEP_SUMMARY) and to stderr. Fails only when
// GitHub cannot be read or written, so running the workflow again finishes the step.
//   node scripts/close-milestone.mjs <tag>

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryFromRemote } from './lib/changelog.mjs';

// milestones: [{ number, title, state }]; openItems: the open issues and pull requests of the
// milestone named `tag`, [{ number, title, pullRequest }].
export function milestonePlan({ tag, milestones, openItems = [] }) {
  const milestone = milestones.find((m) => m.title === tag);
  if (!milestone) return { action: 'none', reason: `No milestone is named ${tag}: there is none to close.` };
  if (milestone.state === 'closed') return { action: 'none', number: milestone.number, reason: `The milestone ${tag} is closed already.` };
  if (openItems.length > 0) {
    const named = openItems.map((i) => `${i.pullRequest ? 'pull request' : 'issue'} #${i.number} (${i.title})`).join(', ');
    return {
      action: 'keep',
      number: milestone.number,
      reason: `The milestone ${tag} stays open: it still holds ${named}. Close each one, or move it to the next milestone, then close ${tag} by hand.`,
    };
  }
  return { action: 'close', number: milestone.number, reason: `Closed the milestone ${tag}.` };
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

// `gh api --paginate --jq '.[] | …'` prints one JSON object per line, whatever the number of pages.
function list(path, jq) {
  return gh('api', '--paginate', path, '--jq', `.[] | ${jq}`)
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!tag) {
    console.error('usage: node scripts/close-milestone.mjs <tag>');
    process.exit(2);
  }
  const repository = process.env.GITHUB_REPOSITORY || repositoryFromRemote(git('remote', 'get-url', 'origin'));
  if (!repository) {
    console.error('cannot tell which repository this is: set GITHUB_REPOSITORY or add an origin remote on GitHub');
    process.exit(1);
  }
  const milestones = list(`repos/${repository}/milestones?state=all&per_page=100`, '{number, title, state}');
  const milestone = milestones.find((m) => m.title === tag && m.state === 'open');
  const openItems = milestone
    ? list(`repos/${repository}/issues?milestone=${milestone.number}&state=open&per_page=100`, '{number, title, pullRequest: (.pull_request != null)}')
    : [];
  const result = milestonePlan({ tag, milestones, openItems });
  if (result.action === 'close') gh('api', '--method', 'PATCH', `repos/${repository}/milestones/${result.number}`, '-f', 'state=closed', '--silent');
  console.error(result.reason);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Milestone\n\n${result.reason}\n`);
}
