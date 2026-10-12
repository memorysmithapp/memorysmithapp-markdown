# SDLC

How a change travels in this repository, from a need to a release. It does not say what the product does or under which rule ([`PRD.md`](PRD.md)), nor how the repository is organised ([`ARCHITECTURE.md`](ARCHITECTURE.md)).

A repository that ships something deployable extends [§10](#10-release) and [§11](#11-rollback) for what it ships, and changes nothing else here without an issue of its own.

## Contents

1. [The life cycle of a change](#1-the-life-cycle-of-a-change)
2. [Issues and milestones](#2-issues-and-milestones)
3. [Branches](#3-branches)
4. [Commits](#4-commits)
5. [When an issue closes](#5-when-an-issue-closes)
6. [Pull request](#6-pull-request)
7. [A blocked merge](#7-a-blocked-merge)
8. [Tests and review](#8-tests-and-review)
9. [Versioning](#9-versioning)
10. [Release](#10-release)
11. [Rollback](#11-rollback)
12. [Done criteria](#12-done-criteria)

## 1. The life cycle of a change

| # | Stage | Where it lives | What is true at this stage |
|---|---|---|---|
| 1 | **Need** | Whoever felt it | A friction, a risk or an idea. Nothing is promised |
| 2 | **Issue** | A GitHub issue | The need is written down, as the friction and not only as a solution |
| 3 | **Triage** | Comments on the issue | One of three outcomes: accepted into a milestone, kept open without one, or closed as *not planned* with the reason |
| 4 | **Branch** | `release/vX.Y.Z`, or a single-purpose branch | Work starts, and only on an explicit go-ahead from the owner |
| 5 | **Commits** | The branch | Code, test, document and changelog move together |
| 6 | **Pull request** | GitHub | The single PR of the branch, reviewed by the owner |
| 7 | **Merge** | `main` | What is in the documents is true on `main` |
| 8 | **Release** | A tag and a GitHub Release | Written by the release workflow, never by hand |

`main` is protected: every change reaches it through a pull request, without exception, documentation, maintenance and version bumps included. Nobody pushes to `main`, and nobody uses `--admin`, *Bypass rules*, `--no-verify` or an equivalent. The only writes that reach the repository outside a pull request are the annotated tags the release workflow writes on already merged commits.

No stage is skipped out of haste, with one named exception: a **defect that blocks use** goes straight to stage 4, and the issue describing it is written along with the fix, not before it.

## 2. Issues and milestones

**Issues use GitHub's blank default.** There are no issue templates, no pull request template, and the labels are the ones GitHub ships (`bug`, `documentation`, `enhancement`, `question`, …). No label is created for what a native one already says, nor for a state: being accepted for a version is the **milestone**, and having been delivered or refused is the way the issue was **closed**.

**An issue before implementing.** When the owner asks for an opinion, or says "open the issue", the answer is to register the issue and ask; implementation starts only on an explicit go-ahead.

**A milestone per version declares its scope.** An issue in milestone `vX.Y.Z` is accepted for that cycle; one without a milestone has not been decided yet. A larger piece of work is one parent issue with **sub-issues** for its parts, in the order they are built.

**Refusal is an outcome, and it is written down:** the issue closes as *not planned*, with the reason in a comment.

**A document never describes the future. If it is in a document, it is true now.** What is not true yet lives in an issue:

| This | Goes to |
|---|---|
| A hypothesis of a need, a request, a reported friction | An issue |
| Scope under discussion, an alternative being evaluated | The issue itself, before a milestone |
| Roadmap, build order, target version | The milestone of the version, and the order of its sub-issues |
| A risk not yet addressed, an undecided question | A `question` issue, with the criterion that closes it in its body |
| Change history, release notes, revision dates | `CHANGELOG.md` and the git history |

## 3. Branches

| Prefix | Use | Example |
|---|---|---|
| `release/` | The cycle that closes a whole version | `release/v0.2.0` |
| `feat/` | A single feature | `feat/setup-labels` |
| `fix/` | A single fix | `fix/quality-anchor-slug` |
| `docs/` | Documentation and repository governance | `docs/sdlc-rollback` |
| `chore/` | Maintenance: dependencies, CI, configuration | `chore/bump-pnpm` |

`release/` carries no Conventional Commits type on purpose: a cycle holds many types at once. The commits inside it keep their types.

A cycle has **one** branch and **one** pull request at its end. No pull request is opened per issue: it would need a branch per issue and leave a merge button available with the version half done.

## 4. Commits

**Conventional Commits, imperative mood:** `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, with a scope when it helps (`docs(sdlc): …`). The body says why, and references the issue by `#N`.

**The unit of a commit is the whole behaviour change:** code, test, document and `CHANGELOG.md` in the same commit. It is what keeps documentation from being written from memory days after the decision.

**Commit and push along the branch**, never piling everything up at the end. Every commit builds and keeps the checks of [§8](#8-tests-and-review) passing.

**No version notes, revision dates or "internal document" footers** are written inside documents: they duplicate what git records and fall out of sync at once. History lives in `CHANGELOG.md` and in git.

### 4.1 When a commit touches each document

| Touches… | When the commit… |
|---|---|
| `PRD.md` | Creates, changes or removes a business rule, a term of the ubiquitous language, a journey, a quality requirement or an acceptance criterion |
| `ARCHITECTURE.md` | Changes the layout, a dependency, an integration, the mechanism of an invariant, or a decision (a new ADR, or one superseded) |
| `AGENTS.md` | Adds or removes a limit or an invariant, verifies a command, or changes where a kind of paragraph belongs |
| `README.md` | Changes the procedure to start or install, a prerequisite, a command a person types, or a capability the README mentions |
| `SDLC.md` | Changes the path to `main` or to a release |
| `CHANGELOG.md` | Changes anything a user of the repository can observe; a refactor, a test or a formatting adjustment with no observable effect does not |

A fix that **restores** what a document already describes touches no document but `CHANGELOG.md`.

On `main`, documents and code never diverge. Inside a branch they move in step: if the branch dies halfway, nothing inconsistent reached `main`; if it is merged, everything arrives together.

## 5. When an issue closes

The issue of a delivery closes **when its commit lands on the branch of the cycle**, not when the branch reaches `main`. It closes as `completed`, with a comment naming the commit. A refused issue closes as *not planned*, with the reason.

The consequence is counterintuitive and accepted: during the cycle there are closed issues whose work is not on `main` yet. What declares the scope of the version is the **milestone**; what takes everything to `main` is the single pull request of the cycle.

## 6. Pull request

A pull request references issues by `#N`, **never with `Closes #N`** or another closing keyword: each issue closed already, when its commit landed on the branch ([§5](#5-when-an-issue-closes)).

Every PR description has three sections, in this order.

### 6.1 Summary of changes

```
## Summary of changes

{what changed, grouped by issue, each group headed by its #N}
{every change that implements or alters a business rule cites its RN code}
```

### 6.2 Staging validation

```
## Staging validation

{the version staging served and the commit it was delivered from, and what was exercised on it}
{or: this repository has no staging environment, and what was exercised instead}
{or: nothing of this branch ran on staging, and the merge is the author's decision}
```

Nothing blocks the merge on this section: merging without a staging run is a decision of the author, and the section is what makes it one taken knowingly.

### 6.3 AI productivity analysis

The format of the main repository, with its scope indicators and its examples of technologies made independent of any one stack. Collect the data from the git history and the diff, without guessing and without omitting fields.

```
## AI productivity analysis

| Metric | Value |
|---|---|
| Lines of code handled (added + removed) | {loc_added + loc_removed} ({loc_added} added, {loc_removed} removed) |
| Branch duration | {duration} (from `{branch_start_date}` to `{pr_date}`) |
| Technologies involved | {comma-separated list} |

### Estimated human effort (without AI assistance)

> **Estimated effort:** {hours}h, roughly {total_days} working days (8h/day) or {total_weeks} working weeks (40h/week).
```

**How to fill in each field:**

- **Lines of code handled:** run `git diff --stat origin/main...HEAD` and add the insertions and deletions of the final totals line. Exclude lock files (`pnpm-lock.yaml`, `package-lock.json`) from the count.
- **Branch duration:** use the date of the first commit on the branch as the start, and today as the PR date.
- **Technologies involved:** list every language, runtime, framework, library, cloud service, CI system and tool touched by the diff. Derive it from the extensions of the changed files and from the imports, and do not list technologies that exist in the repository but were not touched by this PR.
- **Estimated human effort:** produce a single realistic estimate of how long one engineer would take to deliver the same result alone, without AI assistance. Base the estimate on:
  - **Volume:** total lines handled (added + removed), weighted by complexity, distinguishing repetitive code from code with dense logic.
  - **Breadth:** the number of distinct technologies involved, since each additional one adds a learning curve and an integration cost.
  - **Scope indicators:** the number of units of design the change adds or reshapes — modules, interfaces, routes, tools, workflows, scripts, documents — counting what the repository actually has, plus the test coverage added.
  - Express the result in hours, for example `8h` or `2h`. If the scope is very small (less than 1h), use `< 1h`.
- **Total estimated effort:** use the single hours value above. Then compute:
  - `{total_days}` = `{hours}` ÷ 8, rounded to one decimal place
  - `{total_weeks}` = `{hours}` ÷ 40, rounded to one decimal place
  - If the estimate is `< 1h`, treat it as `0.5h` for the arithmetic and note the approximation on the line itself.

## 7. A blocked merge

**If a merge is blocked, stop and report.** The protection of `main` is not worked around, even with administrative rights to do so: the ruleset is the real layer of guarantee, and going around it silently defeats the reason it exists. Report what blocked it, and let the owner decide.

## 8. Tests and review

**A green suite is necessary, not sufficient.** Before a change is called done it is exercised the way a person would use it: a document is read where it is rendered and its links followed, a script is run against a real target, a workflow is watched running. What was exercised is written in the PR's *Staging validation*.

**What CI checks.** The workflow *Quality* runs on every pull request and every push to `main`, and the ruleset of `main` requires it. It runs `pnpm run quality`, which checks that:

1. the root `package.json` has a SemVer `version`, and `CHANGELOG.md` has it as its latest released section, or the branch is `release/vX.Y.Z` bumping to it, or, before the first cut, it is `0.1.0`;
2. `CHANGELOG.md` keeps the Keep a Changelog format: `[Unreleased]` on top, dated versions in descending order, its six categories only, a compare link at the foot for every section;
3. `CLAUDE.md` is exactly `@AGENTS.md`;
4. every relative link and anchor of every Markdown file resolves;
5. no document carries a version footer ("Last revised", "Internal development document" and the like);
6. every GitHub link at the foot of `CHANGELOG.md` names the repository the check runs in;
7. every package of the workspace has the root's `version`, and every package not marked `"private": true` declares public access;

then it builds and type-checks the packages (`pnpm -r build`, `pnpm -r typecheck`) and runs `pnpm test`: the tests that make each check fail on a deliberate violation, and the tests of every package. All of it runs locally the same way ([`AGENTS.md` §6](AGENTS.md#6-verified-commands)).

**The owner reviews and merges** the pull request of a cycle; nobody merges their own cycle without that review.

## 9. Versioning

**The version lives in the `version` field of the root `package.json`, and nowhere else.** No document repeats it; `CHANGELOG.md` records the versions that were cut.

**SemVer, with the 0.x caveat.** From `1.0.0` on, a contract break is a major bump, a new capability a minor one, a fix a patch. While the version is `0.x`, a contract break enters as a **minor** bump, recorded under `Changed` or `Removed`.

**`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).** Every entry is born under `[Unreleased]`, in the commit of the change, in one of the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, referencing its issue.

**A change that alters nothing shipped does not cut a version.** Documentation and repository governance are the typical case: it waits in `[Unreleased]` and goes out inside the next cycle, dated by the cut.

**The cut takes the whole `[Unreleased]`, and the accumulation decides the number.** No subset is picked, because the compare range in the foot of `CHANGELOG.md` covers every commit between two tags. The bump is the **largest that any accumulated entry requires**, not what the last change would require on its own.

## 10. Release

**Nobody tags by hand.** The tag and the GitHub Release are written after the merge, on the merged commit, with the notes of that version's section of `CHANGELOG.md`.

The bump flow, in this order:

1. On the branch `release/vX.Y.Z`, in **one commit** `chore(release): cut vX.Y.Z`: set `version` in the root `package.json` to `X.Y.Z`; in `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` with the date of the cut, open a fresh empty `[Unreleased]` above it, and update the compare links in the foot.
2. Push the branch and open the single pull request of the cycle ([§6](#6-pull-request)).
3. The owner reviews and merges it. The bump never reaches `main` by a direct push.
4. The merge is a push to `main`, which runs the workflow **Release** on the merged commit:
   1. it reads the `version` of the root `package.json`;
   2. if the links at the foot of `CHANGELOG.md` do not name this repository, it does nothing: the changelog is still the copy of another repository's, as in a repository just created from `memorysmithapp-template`;
   3. if the tag `vX.Y.Z` already exists **on this commit**, it does nothing; if it exists on **another** commit, it fails, because a version names one commit;
   4. if `CHANGELOG.md` has no released section `[X.Y.Z]`, it does nothing: the push was not a release;
   5. otherwise it writes the **annotated** tag `vX.Y.Z` on the merged commit and creates the GitHub Release `vX.Y.Z` with the notes of that section.

Every push to `main` runs the workflow, and only the push that carries a cut version's section with no tag yet releases anything. A run that failed is run again from the Actions tab once the cause is fixed; a tag that already names the merged commit is left as it is, so running it again is safe.

**A repository that publishes to npm** adds to this flow the publish of the cut version, from the workflow that releases it, through npm trusted publishing; its packages declare `"publishConfig": { "access": "public" }`, and every package not meant to be published declares `"private": true`. Why both fields are required is in [`ARCHITECTURE.md` §4](ARCHITECTURE.md#4-integrations) (npm).

When a cycle is cut, every issue delivered in it is closed already ([§5](#5-when-an-issue-closes)), and the ones left behind move to the milestone of the next version: an accepted issue nobody reassessed is a silent promise.

## 11. Rollback

A released version that turns out wrong is **never undone by moving or deleting its tag**: a version names one commit, and somebody may have taken it already.

For a repository that ships no deployable, as this one, the correction is a **new patch version**: the fix enters `[Unreleased]` under `Fixed` on a `fix/` or `release/` branch, and is cut and released by the flow of [§10](#10-release). A repository that deploys extends this section with how it returns production to the previous version while the fix travels.

## 12. Done criteria

An issue's work is done when, on the branch of the cycle:

- every point of its "Done when" holds, exercised the way a person would use it ([§8](#8-tests-and-review));
- the documents it touches and its `CHANGELOG.md` entry are in the same commit as the change ([§4](#4-commits));
- the commit is pushed and the checks of the branch are green;
- the issue is closed as `completed`, with a comment naming the commit ([§5](#5-when-an-issue-closes)).

The version is done when its pull request is merged and its tag and Release exist.
