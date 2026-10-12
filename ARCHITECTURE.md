# Architecture

How `memorysmithapp-markdown` is organised, and why: what it is made of, what enforces each invariant of [`AGENTS.md` §5](AGENTS.md#5-invariants), what it integrates with, and the decisions behind it.

Claims carry their status when it is not obvious: *observed*, *declared*, *inferred*, and **To confirm** for what was not verified.

## 1. Overview

*Instruction: what the system is made of, and how the parts relate.*

The repository is made of:

- **Documents**, the core of what it delivers: `CLAUDE.md` imports `AGENTS.md`; `AGENTS.md` maps the reading and the writing onto `PRD.md`, `ARCHITECTURE.md`, `SDLC.md` and `README.md`, and states the limits and invariants in one line each; `CHANGELOG.md` records what each version changed.
- **Two packages**, in a pnpm workspace under `packages/`: `@memorysmithapp/markdown-spec` and `@memorysmithapp/markdown-renderer`, each built with TypeScript into its own `dist/` and tested with Vitest.
- **Repository files:** `package.json`, the one home of the version and the root of the workspace; `.gitignore`, `.editorconfig` and `LICENSE`.
- **A setup script**, `scripts/setup-repo.sh`, which applies to a repository the GitHub configuration a copy does not carry, and puts it back when it drifts.
- **A quality workflow**, `.github/workflows/quality.yml`, which runs `scripts/quality.mjs`, builds and type-checks the packages and runs every test on every pull request and push to `main`; the ruleset requires it.
- **A release workflow**, `.github/workflows/release.yml`, which tags and publishes a version once its bump is merged.
- **GitHub configuration**: the ruleset `main` and the settings the script applies.

Each fact has one home: an invariant is stated in `AGENTS.md` and its mechanism here; a rule is stated in `PRD.md` and enforced where §3 says.

## 2. Layout

*Instruction: every file and directory, and what it is for.*

| Path | What it is for |
|---|---|
| `CLAUDE.md` | The single line `@AGENTS.md`, which Claude Code imports at the start of every session and sub-agent |
| `AGENTS.md` | How an agent works here: identity, reading and writing maps, limits, invariants, verified commands, the checklist before done |
| `PRD.md` | What the product solves and delivers, under which rule |
| `ARCHITECTURE.md` | This document |
| `SDLC.md` | How a change travels from an issue to a release |
| `README.md` | What this is and how to start |
| `CHANGELOG.md` | What changed in each version, in Keep a Changelog 1.1.0 |
| `package.json` | The one home of the version (`version`), the package manager pinned (`packageManager`), the toolchain shared by the workspace (`devDependencies`), and the scripts `quality`, `build`, `typecheck` and `test`; private, named `@memorysmithapp/markdown`, never published |
| `pnpm-workspace.yaml` | The workspace: every directory under `packages/`; and the one dependency allowed to run an install script, `esbuild`, which Vitest needs |
| `tsconfig.base.json` | The TypeScript options every package extends: strict, ES2022, ESM, `react-jsx`, declarations |
| `vitest.config.ts` | The one Vitest configuration: a project per package, the renderer's in `jsdom` |
| `packages/markdown-spec/` | `@memorysmithapp/markdown-spec`: `package.json`, `tsconfig.json` (type-checks sources and tests), `tsconfig.build.json` (emits `dist/` from `src/`, tests excluded), `src/` |
| `packages/markdown-renderer/` | `@memorysmithapp/markdown-renderer`, laid out as `markdown-spec`; `react` and `react-dom` 19 are its peer dependencies |
| `scripts/setup-repo.sh` | Applies the settings a copy does not carry to a repository; uses only `gh` and `jq`; the mechanism of INV-03 |
| `scripts/quality.mjs` | The checks of the workflow *Quality*, Node only |
| `scripts/quality.test.mjs` | The tests of the checks, one deliberate violation each, on `node:test` |
| `scripts/release.mjs` | Decides what the workflow *Release* does on a push to `main`: release, nothing, or fail |
| `scripts/release.test.mjs` | The tests of that decision |
| `scripts/lib/changelog.mjs` | Reads `CHANGELOG.md`: its sections, categories, link definitions and the notes of a version |
| `.github/workflows/quality.yml` | The workflow *Quality*, job `Quality` |
| `.github/workflows/release.yml` | The workflow *Release*, which writes the tag and the GitHub Release of a merged version |
| `pnpm-lock.yaml` | Written by pnpm; installed with `--frozen-lockfile` in CI |
| `.gitignore` | Dependencies, build output, coverage, environment files, logs, operating-system and editor files |
| `.editorconfig` | UTF-8, LF, two spaces, final newline |
| `LICENSE` | The MIT licence |

### 2.1 Toolchain

- **pnpm**, pinned in `packageManager` and enabled through Corepack; the workspace links the packages to each other, so the renderer's tests read the specification's data from the package, not from a copy.
- **TypeScript 5.9**, strict, configured once in `tsconfig.base.json`. Each package type-checks its sources and tests with `tsconfig.json` and emits ESM and declarations into `dist/` with `tsconfig.build.json`; `dist/` is what `exports` names and what a consumer receives.
- **Vitest 3**, configured once in `vitest.config.ts`. Each package's `test` script runs its project from the root (`cd ../.. && vitest run --project <name>`), so the configuration is never repeated; the renderer's project runs in `jsdom`.
- The versions of the toolchain and of the renderer's libraries are those the main repository's frontend locks at the commit the renderer is extracted from, so that "draws the same" is not disturbed by an upgrade (*declared* in #1, decision 2; the versions *observed* in that repository's `pnpm-lock.yaml`).

## 3. Invariants and their mechanisms

*Instruction: one subsection per invariant of `AGENTS.md` §5, saying what enforces it, or that nothing does.*

### INV-01 The version has one home

The version lives in the `version` field of the root `package.json` and nowhere else; `CHANGELOG.md` records the versions that were cut.

**Mechanism:** check 1 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*: the root `package.json` has a SemVer `version`, and it is the latest released section of `CHANGELOG.md`; on the branch `release/vX.Y.Z` it may be ahead of it, bumping to it; before the first cut it may be `0.1.0` with no released section. Check 7 holds the packages to it: every package of the workspace has the root's `version`, and a package that is not `"private": true` declares public access ([§4, npm](#4-integrations)). That the version is written in no other file is held by the writing map and the owner's review.

### INV-02 CLAUDE.md is only the import

`CLAUDE.md` is the line `@AGENTS.md` and nothing else. Claude Code expands an `@path` line into the contents of the file it names, so the instructions load in every session and sub-agent; a `CLAUDE.md` that only mentioned `AGENTS.md` in prose would leave reading it to the agent's judgement (*observed* in this repository's first session, which started with `AGENTS.md` in its context).

**Mechanism:** check 3 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*: the file is byte for byte `@AGENTS.md` and an optional newline.

### INV-03 main changes only through a pull request

**Mechanism:** the repository ruleset `main` (*observed*, id `24930653`), active on the default branch, with no bypass actors:

- `deletion`: the branch cannot be deleted;
- `non_fast_forward`: no force push;
- `pull_request`: every change through a pull request, with 0 required approvals, merge, squash and rebase allowed;
- `required_status_checks`: the check `Quality` passes before a merge.

Nobody can bypass it, administrators included (`current_user_can_bypass: never`, *observed*). A ruleset is a setting of the repository, not a file, so a created repository does not receive it: **`scripts/setup-repo.sh`** creates it there, or brings it back to this definition when it drifted. The script defines the ruleset in its own source and compares, rule by rule, only the parameters it sets, so a parameter GitHub fills in by default does not count as drift. The owner's run on 2026-10-12 created the ruleset above (*observed*); that a second run changes nothing is **To confirm** in this repository.

### INV-04 Only the release workflow writes a tag

A version names one commit: the tag `vX.Y.Z` is written once, on the merged commit, and never moved or deleted ([`SDLC.md` §10](SDLC.md#10-release), [§11](SDLC.md#11-rollback)).

**Mechanism:** the workflow *Release* ([`.github/workflows/release.yml`](.github/workflows/release.yml)), on every push to `main`. [`scripts/release.mjs`](scripts/release.mjs) reads the version, releases nothing when the GitHub links at the foot of `CHANGELOG.md` do not all name `GITHUB_REPOSITORY`, refuses to go on when its tag names another commit, and releases only when `CHANGELOG.md` has a section for it and the tag does not exist yet; the workflow then writes the annotated tag on `GITHUB_SHA` and the Release with that section as its notes. That nobody writes a tag by hand is held by the limit of `AGENTS.md` §4: the ruleset `main` protects the branch, not tags.

The link condition exists because a repository created from `memorysmithapp-template`, as this one was, receives that repository's `CHANGELOG.md`, its released sections included, in an initial commit pushed to `main`: without it, *Release* would publish one of those versions there on creation. In this repository, *Release* ran on the initial commit and wrote no tag and no Release (*observed*). Check 6 of [`scripts/quality.mjs`](scripts/quality.mjs) holds the other side: the foot links name the repository the check runs in, so a changelog whose links name another repository fails `Quality` instead of leaving *Release* to skip in silence; it failed on this repository's initial commit for that reason (*observed*).

### INV-05 The documents keep their form

`CHANGELOG.md` keeps the format of Keep a Changelog 1.1.0, every relative link and anchor resolves, and no document carries a version footer.

**Mechanism:** checks 2, 4 and 5 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*. Anchors are computed as GitHub computes them (lowercase, punctuation dropped, spaces as hyphens, `-1`, `-2`… for repeated headings), which is what keeps the links of `AGENTS.md` into this document from rotting silently. Code blocks and inline code are skipped, so a link or a footer quoted as code is not read as one. A footer is a line *starting* with "Last revised", "Last updated", "Revision date", "Internal document" and the like; the words inside a sentence are not one.

## 4. Integrations

*Instruction: every external system the project depends on, and what it uses from each.*

**GitHub.**

- *Rulesets and settings:* the ruleset `main` of [INV-03](#inv-03-main-changes-only-through-a-pull-request), and the description, topics, merge options, wiki and discussions, all through the REST API by `scripts/setup-repo.sh` with the `gh` of an administrator.
- *Issues and milestones:* GitHub's blank issue and default labels; a milestone per version.
- *Actions:* the workflows *Quality* and *Release* on `ubuntu-latest`, with Node 24 from `actions/setup-node` and the pnpm of `packageManager` through Corepack.

**npm.** Any package a repository of the organisation publishes uses the scope `@memorysmithapp`. The npm organisation `memorysmithapp` exists since 2026-10-12, which reserves the scope, and is on the **free plan, which publishes public packages only**; a private package would need the paid Teams plan (*declared* by the owner in #1). No npm token exists (*declared*). Therefore, in the `package.json` of every repository of the organisation:

- **A package published under `@memorysmithapp` declares `"publishConfig": { "access": "public" }`.** npm publishes a scoped package as *restricted* by default, and on the free plan that publish fails with `402 Payment Required`; written in `package.json`, the access does not depend on somebody remembering `--access public`.
- **A package never meant to be published declares `"private": true`**, which stops `npm publish` whatever the plan. The root `package.json` of this repository is one: it is never published.
- **Publishing from CI goes through npm *trusted publishing* from GitHub Actions (OIDC)**, with no stored token, set up by the repository that first publishes, in an issue of its own.

## 5. Operation

*Instruction: what runs, where, with which permissions and secrets.*

**Quality** (`.github/workflows/quality.yml`) runs on every pull request and every push to `main`, with `contents: read` and no secret; it reads the branch from `GITHUB_HEAD_REF` or `GITHUB_REF_NAME` for check 1.

**Release** (`.github/workflows/release.yml`) runs on every push to `main`, reads the repository it runs in from `GITHUB_REPOSITORY`, one run at a time (`concurrency: release`), with `contents: write` for the workflow's own `GITHUB_TOKEN` and no stored secret: it pushes the tag with git, as `github-actions[bot]`, and creates the Release with `gh`. A tag pushed with that token starts no other workflow.

There is no deployable. `scripts/setup-repo.sh` runs on a person's machine, once when a repository is created and again whenever its settings drift, with the permissions of the administrator whose `gh` it uses; it needs no token of its own.

## 6. Architecture decision records

*Instruction: the decisions behind the architecture, one record each, in the format below.*

Each record has an identifier, never reused; its context, decision, rationale and consequences; its date, status and **origin**. A decision that changes keeps its old record, marked *Superseded by ADR-NNN*, and a new record states the new decision.
