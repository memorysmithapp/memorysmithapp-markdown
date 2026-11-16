// What the release workflow does to the milestone of a version it released and published. Run from the root: `pnpm test`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { milestonePlan } from './close-milestone.mjs';

const MILESTONES = [
  { number: 1, title: 'v0.1.0', state: 'closed' },
  { number: 2, title: 'v0.2.0', state: 'open' },
  { number: 3, title: 'v0.3.0', state: 'open' },
];

test('closes the milestone of the version when it holds no open issue', () => {
  const result = milestonePlan({ tag: 'v0.2.0', milestones: MILESTONES, openItems: [] });
  assert.equal(result.action, 'close');
  assert.equal(result.number, 2);
  assert.match(result.reason, /Closed the milestone v0\.2\.0/);
});

test('leaves the milestone open, naming each open issue and pull request it holds', () => {
  const openItems = [
    { number: 12, title: 'Left behind', pullRequest: false },
    { number: 13, title: 'Still in review', pullRequest: true },
  ];
  const result = milestonePlan({ tag: 'v0.2.0', milestones: MILESTONES, openItems });
  assert.equal(result.action, 'keep');
  assert.match(result.reason, /stays open/);
  assert.match(result.reason, /issue #12 \(Left behind\)/);
  assert.match(result.reason, /pull request #13 \(Still in review\)/);
});

test('goes on when no milestone has the name of the version', () => {
  const result = milestonePlan({ tag: 'v0.9.0', milestones: MILESTONES });
  assert.equal(result.action, 'none');
  assert.match(result.reason, /No milestone is named v0\.9\.0/);
});

test('does nothing to a milestone closed already, as on a run started again', () => {
  const result = milestonePlan({ tag: 'v0.1.0', milestones: MILESTONES });
  assert.equal(result.action, 'none');
  assert.match(result.reason, /closed already/);
});

test('matches the whole name, not a prefix', () => {
  assert.equal(milestonePlan({ tag: 'v0.2', milestones: MILESTONES }).action, 'none');
});
