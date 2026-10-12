# Architecture

How `memorysmithapp-template` is organised, and why. It describes this repository itself: what it is made of, what enforces each invariant of [`AGENTS.md` §5](AGENTS.md#5-invariants), what it integrates with, and the decisions behind it.

*Rewritten on adoption*, except [§6](#6-architecture-decision-records), whose format is kept and whose records start empty. A repository created from this one keeps every heading below with the one-line instruction in italics under it, and replaces the content with its own.

Claims carry their status when it is not obvious: *observed*, *declared*, *inferred*, and **To confirm** for what was not verified ([`PRD.md`](PRD.md), RN-DOC-006).

## 1. Overview

*Instruction: what the system is made of, and how the parts relate.*

The repository carries no product code. It is made of:

- **Documents**, the core of what it delivers: `CLAUDE.md` imports `AGENTS.md`; `AGENTS.md` maps the reading and the writing onto `PRD.md`, `ARCHITECTURE.md`, `SDLC.md` and `README.md`, and states the limits and invariants in one line each; `CHANGELOG.md` records what each version changed.
- **Repository files:** `package.json`, the one home of the version; `.gitignore`, `.editorconfig` and `LICENSE`.
- **A setup script**, `scripts/setup-repo.sh`, which applies to a repository the GitHub configuration a copy does not carry, and puts it back when it drifts.
- **A quality workflow**, `.github/workflows/quality.yml`, which runs `scripts/quality.mjs` on every pull request and push to `main`; the ruleset requires it.
- **A release workflow**, `.github/workflows/release.yml`, which tags and publishes a version once its bump is merged.
- **GitHub configuration**: the ruleset `main` and the settings the script applies.

Each fact has one home ([`PRD.md` RN-DOC-004](PRD.md#7-features-and-rules)): an invariant is stated in `AGENTS.md` and its mechanism here; a rule is stated in `PRD.md` and enforced where §3 says.

## 2. Layout

*Instruction: every file and directory, and what it is for.*

| Path | What it is for |
|---|---|
| `CLAUDE.md` | The single line `@AGENTS.md`, which Claude Code imports at the start of every session and sub-agent |
| `AGENTS.md` | How an agent works here: identity, reading and writing maps, limits, invariants, verified commands, the checklist before done, adoption |
| `PRD.md` | What the product solves and delivers, under which rule |
| `ARCHITECTURE.md` | This document |
| `SDLC.md` | How a change travels from an issue to a release |
| `README.md` | What this is and how to start |
| `CHANGELOG.md` | What changed in each version, in Keep a Changelog 1.1.0 |
| `package.json` | The one home of the version (`version`), the package manager pinned (`packageManager`), and the scripts `quality` and `test`; private, named `@memorysmithapp/template`, with no dependency |
| `scripts/setup-repo.sh` | Applies the settings a copy does not carry to a created repository (RN-REP-001, RN-REP-002); uses only `gh` and `jq`; the mechanism of INV-03 |
| `scripts/quality.mjs` | The checks of the workflow *Quality*, Node only (RN-REP-003) |
| `scripts/quality.test.mjs` | The tests of the checks, one deliberate violation each, on `node:test` |
| `scripts/release.mjs` | Decides what the workflow *Release* does on a push to `main`: release, nothing, or fail (RN-VER-003) |
| `scripts/release.test.mjs` | The tests of that decision |
| `scripts/lib/changelog.mjs` | Reads `CHANGELOG.md`: its sections, categories, link definitions and the notes of a version |
| `.github/workflows/quality.yml` | The workflow *Quality*, job `Quality` |
| `.github/workflows/release.yml` | The workflow *Release*, which writes the tag and the GitHub Release of a merged version |
| `pnpm-lock.yaml` | Written by pnpm; with no dependency, it records only the pinned pnpm |
| `.gitignore` | Dependencies, build output, coverage, environment files, logs, operating-system and editor files |
| `.editorconfig` | UTF-8, LF, two spaces, final newline |
| `LICENSE` | The MIT licence |

## 3. Invariants and their mechanisms

*Instruction: one subsection per invariant of `AGENTS.md` §5, saying what enforces it, or that nothing does.*

### INV-01 The version has one home

The version lives in the `version` field of the root `package.json` and nowhere else; `CHANGELOG.md` records the versions that were cut (RN-VER-001, RN-VER-002).

**Mechanism:** check 1 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*: the root `package.json` has a SemVer `version`, and it is the latest released section of `CHANGELOG.md`; on the branch `release/vX.Y.Z` it may be ahead of it, bumping to it; before the first cut it may be `0.1.0` with no released section. That the version is written in no other file is held by the writing map and the owner's review.

### INV-02 CLAUDE.md is only the import

`CLAUDE.md` is the line `@AGENTS.md` and nothing else (RN-DOC-002). Claude Code expands an `@path` line into the contents of the file it names, so the instructions load in every session and sub-agent; a `CLAUDE.md` that only mentioned `AGENTS.md` in prose would leave reading it to the agent's judgement (*observed* in a fresh session, #2).

**Mechanism:** check 3 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*: the file is byte for byte `@AGENTS.md` and an optional newline.

### INV-03 main changes only through a pull request

**Mechanism:** the repository ruleset `main` (*observed*, id `24923714`), active on the default branch, with no bypass actors:

- `deletion`: the branch cannot be deleted;
- `non_fast_forward`: no force push;
- `pull_request`: every change through a pull request, with 0 required approvals, merge, squash and rebase allowed;
- `required_status_checks`: the check `Quality` passes before a merge.

Nobody can bypass it, administrators included (`current_user_can_bypass: never`, *observed*). A ruleset is a setting of the repository, not a file, so a created repository does not receive it: **`scripts/setup-repo.sh`** creates it there, or brings it back to this definition when it drifted (RN-REP-001). The script defines the ruleset in its own source and compares, rule by rule, only the parameters it sets, so a parameter GitHub fills in by default does not count as drift. Run against a throwaway repository, the ruleset it created was identical to this repository's, identifiers and timestamps aside, and a second run changed nothing (*observed*, #7).

The adoption keeps the script, so every created repository holds the definition of its ruleset and the means to put it back (#17).

### INV-04 Only the release workflow writes a tag

A version names one commit: the tag `vX.Y.Z` is written once, on the merged commit, and never moved or deleted ([`SDLC.md` §10](SDLC.md#10-release), [§11](SDLC.md#11-rollback)).

**Mechanism:** the workflow *Release* ([`.github/workflows/release.yml`](.github/workflows/release.yml)), on every push to `main`. [`scripts/release.mjs`](scripts/release.mjs) reads the version, releases nothing when the GitHub links at the foot of `CHANGELOG.md` do not all name `GITHUB_REPOSITORY` (RN-VER-004), refuses to go on when its tag names another commit, and releases only when `CHANGELOG.md` has a section for it and the tag does not exist yet; the workflow then writes the annotated tag on `GITHUB_SHA` and the Release with that section as its notes (RN-VER-003). That nobody writes a tag by hand is held by the limit of `AGENTS.md` §4: the ruleset `main` protects the branch, not tags.

The link condition exists because a repository created from this one receives its `CHANGELOG.md`, `[0.1.0]` section included, in an initial commit pushed to `main`: without it, *Release* published this repository's `v0.1.0` there on creation (*observed*, #14). Check 6 of [`scripts/quality.mjs`](scripts/quality.mjs) holds the other side: the foot links name the repository the check runs in, so an adoption that forgets to rewrite them fails `Quality` on its pull request instead of leaving *Release* to skip in silence. Until the adoption, a created repository's `Quality` therefore fails on that check, and says to rewrite the links.

### INV-05 The documents keep their form

`CHANGELOG.md` keeps the format of Keep a Changelog 1.1.0, every relative link and anchor resolves, and no document carries a version footer (RN-VER-002, RN-DOC-005, RN-REP-003).

**Mechanism:** checks 2, 4 and 5 of [`scripts/quality.mjs`](scripts/quality.mjs), run by the workflow *Quality*. Anchors are computed as GitHub computes them (lowercase, punctuation dropped, spaces as hyphens, `-1`, `-2`… for repeated headings), which is what keeps the links of `AGENTS.md` into this document from rotting silently. Code blocks and inline code are skipped, so a link or a footer quoted as code is not read as one. A footer is a line *starting* with "Last revised", "Last updated", "Revision date", "Internal document" and the like; the words inside a sentence are not one.

## 4. Integrations

*Instruction: every external system the project depends on, and what it uses from each.*

**GitHub.**

- *Template repositories:* a repository is created from this one with *Use this template* or `gh repo create --template`, receiving a copy of the files of the default branch in one initial commit, with no link back and no settings ([ADR-004](#adr-004-a-github-template-repository-copied-once)). What makes this repository offer them is GitHub's *Template repository* flag, which the owner sets with `gh repo edit --template` (*declared*).
- *Rulesets and settings:* the ruleset `main` of [INV-03](#inv-03-main-changes-only-through-a-pull-request), and the description, topics, merge options, wiki and discussions, all through the REST API by `scripts/setup-repo.sh` with the `gh` of an administrator.
- *Issues and milestones:* GitHub's blank issue and default labels; a milestone per version ([ADR-005](#adr-005-githubs-defaults-for-issues-pull-requests-and-labels)).
- *Actions:* the workflows *Quality* and *Release* on `ubuntu-latest`, with Node 24 from `actions/setup-node` and the pnpm of `packageManager` through Corepack.

**npm.** Any package a repository of the organisation publishes uses the scope `@memorysmithapp` ([ADR-006](#adr-006-the-npm-scope-memorysmithapp)). The npm organisation `memorysmithapp` exists since 2026-10-12, which reserves the scope, and is on the **free plan, which publishes public packages only**; a private package would need the paid Teams plan (*declared* by the owner in #1). No npm token exists (*declared*). Therefore, in the `package.json` of every repository of the organisation:

- **A package published under `@memorysmithapp` declares `"publishConfig": { "access": "public" }`.** npm publishes a scoped package as *restricted* by default, and on the free plan that publish fails with `402 Payment Required`; written in `package.json`, the access does not depend on somebody remembering `--access public`.
- **A package never meant to be published declares `"private": true`**, which stops `npm publish` whatever the plan. The root `package.json` of this repository is one: this repository publishes nothing.
- **Publishing from CI goes through npm *trusted publishing* from GitHub Actions (OIDC)**, with no stored token, set up by the repository that first publishes, in an issue of its own.

## 5. Operation

*Instruction: what runs, where, with which permissions and secrets.*

**Quality** (`.github/workflows/quality.yml`) runs on every pull request and every push to `main`, with `contents: read` and no secret; it reads the branch from `GITHUB_HEAD_REF` or `GITHUB_REF_NAME` for check 1.

**Release** (`.github/workflows/release.yml`) runs on every push to `main`, reads the repository it runs in from `GITHUB_REPOSITORY`, one run at a time (`concurrency: release`), with `contents: write` for the workflow's own `GITHUB_TOKEN` and no stored secret: it pushes the tag with git, as `github-actions[bot]`, and creates the Release with `gh`. A tag pushed with that token starts no other workflow.

There is no deployable. `scripts/setup-repo.sh` runs on a person's machine, once when a repository is created and again whenever its settings drift, with the permissions of the administrator whose `gh` it uses; it needs no token of its own.

## 6. Architecture decision records

*Instruction: the decisions behind the architecture, one record each, in the format below.*

*Kept on adoption: the format below stays, and a created repository starts with no record.*

Each record has an identifier, never reused; its context, decision, rationale and consequences; its date, status and **origin**. A decision that changes keeps its old record, marked *Superseded by ADR-NNN*, and a new record states the new decision.

The records ADR-001 to ADR-007 are **reconstructed**: the decisions were taken by the owner of the organisation before this repository existed, declared in #1 on 2026-10-12, and written here as records by the session that built v0.1.0.

### ADR-001 A small set of documents instead of a large CLAUDE.md

- **Context:** the main repository keeps its agent instructions in a `CLAUDE.md` of about 7,500 words and its knowledge in five documents under `docs/` (*observed*). The instructions are loaded whole in every session, and the knowledge overlaps them.
- **Decision:** each repository holds `CLAUDE.md` → `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `SDLC.md` and `README.md`, each answering one question (RN-DOC-001).
- **Rationale:** a document per question gives each fact one home; `AGENTS.md`, loaded always, stays a short map pointing at sections instead of a copy of them.
- **Consequences:** the writing map of `AGENTS.md` §3 becomes the arbiter of where a paragraph goes. The structure is tried here first; the main repository migrates only if it proves itself (*declared*).
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-002 CLAUDE.md is the AGENTS.md import

- **Context:** Claude Code reads `CLAUDE.md`; other agents read `AGENTS.md`.
- **Decision:** `CLAUDE.md` is the single line `@AGENTS.md` (RN-DOC-002).
- **Rationale:** the import makes Claude Code load the instructions automatically in every session and sub-agent; a `CLAUDE.md` that mentioned `AGENTS.md` in prose would not. One file holds the instructions for every agent.
- **Consequences:** nothing is written in `CLAUDE.md`; [INV-02](#inv-02-claudemd-is-only-the-import).
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-003 The version lives in the root package.json

- **Context:** the main repository reads its version out of `CLAUDE.md` with a regex, which is what keeps that file from shrinking (*observed*).
- **Decision:** the version lives in the `version` field of the root `package.json`, and nowhere else; `CHANGELOG.md` follows Keep a Changelog 1.1.0 (RN-VER-001, RN-VER-002).
- **Rationale:** `package.json` is where the tooling of the organisation already looks for a version, and a field is read without a regex.
- **Consequences:** every repository has a root `package.json`, even one with no package; [INV-01](#inv-01-the-version-has-one-home).
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-004 A GitHub template repository, copied once

- **Context:** the organisation needs every new repository to start with its process written, with two or three repositories in sight (*declared*).
- **Decision:** a GitHub template repository, copied once into each created repository and never synced, instead of a generator package or an organisation `.github` repository.
- **Rationale:** a template needs no tooling to create a repository and no machinery to maintain; at this number of repositories, syncing costs more than it saves. An organisation `.github` repository is not created until the need for it is felt.
- **Consequences:** an improvement made here does not reach the repositories already created; what a template does not copy, the settings of a repository, needs another mechanism.
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-005 GitHub's defaults for issues, pull requests and labels

- **Context:** the main repository has issue forms and custom labels (*observed*).
- **Decision:** GitHub's blank issue, no issue or pull request templates, GitHub's default labels. The format of a PR description lives as text in [`SDLC.md` §6](SDLC.md#6-pull-request).
- **Rationale:** nothing to maintain or to copy, and the format of a PR is read where the process is.
- **Consequences:** the PR format is followed by reading, not by a form.
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-006 The npm scope @memorysmithapp

- **Context:** repositories of the organisation will publish npm packages, the next one being `memorysmithapp/memorysmithapp-markdown` (*declared*).
- **Decision:** every package published by a repository of the organisation uses the scope `@memorysmithapp`.
- **Rationale:** the scope matches the GitHub organisation, so a package names where it lives.
- **Consequences:** the root `package.json` of each repository is named under the scope, even when private. The scope was reserved on 2026-10-12, when the npm organisation `memorysmithapp` was created on the free plan; because that plan publishes public packages only, a published package declares public access and an unpublished one `"private": true` ([§4, npm](#4-integrations)).
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.

### ADR-007 The repository is its own first instance

- **Context:** a starting point made of placeholders shows a structure but never proves it.
- **Decision:** `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md` and `SDLC.md` are real documents describing this repository; each marks which of its sections a created repository keeps and which it rewrites (RN-DOC-003).
- **Rationale:** a structure that cannot describe a small repository will not describe a large one, and this repository is small and new enough that nothing breaks if a part is wrong.
- **Consequences:** a created repository has an adoption step ([`AGENTS.md` §8](AGENTS.md#8-adopting-this-repository), RN-ADO-001) that empties the content and keeps the process.
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** reconstructed; declared by the owner in #1.
