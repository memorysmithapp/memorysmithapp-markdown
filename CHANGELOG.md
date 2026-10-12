# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-10-12

### Changed

- `AGENTS.md` §8 keeps in `ARCHITECTURE.md` the description of every part the adoption keeps (the overview, the GitHub integration, the operation of `scripts/setup-repo.sh`), and says that the adopting session may verify a claim and mark it *observed* while facts of the organisation keep their status (#20).
- The *AI productivity analysis* of `SDLC.md` §6.3 counts the units of design a change adds (modules, interfaces, routes, tools, workflows, scripts, documents) instead of the main repository's aggregates, adapters and CDK stacks, and its examples of technologies no longer name one stack; the table, the effort line and the arithmetic are unchanged (#21).

### Fixed

- After an adoption, no kept text points at the deleted `AGENTS.md` §8 or carries an adoption marker: the message of `Quality` check 6 no longer cites §8, and the row of `scripts/setup-repo.sh` in `ARCHITECTURE.md` §2 and the INV-03 mechanism keep the adoption note in a paragraph of its own (#19).

## [0.2.0] - 2026-10-12

### Added

- A sixth check in `Quality`: the links at the foot of `CHANGELOG.md` name the repository the check runs in, so an adoption that forgets to rewrite them fails on its pull request (#14).

### Changed

- `AGENTS.md` §8 lists what the adoption keeps in `ARCHITECTURE.md` (the invariant subsections, the npm paragraph, the workflows), drops the RN citations and the *Kept*/*Rewritten* markers, and rewrites `README.md` whole, so following it to the letter leaves no kept text pointing at something it removed (#15).
- The adoption follows `SDLC.md`: the session opens its issue in the milestone `v0.1.0`, works on `docs/adopt-template` in one commit, and opens a pull request of its own that the owner merges before any other work; it cuts no version (#16).
- A created repository keeps `scripts/setup-repo.sh` after the adoption, as the mechanism of INV-03, to run again whenever its ruleset or settings drift (#17).

### Fixed

- A repository created from `memorysmithapp-template` no longer receives a `v0.1.0` tag and Release of the template on its initial commit: `Release` publishes only when the links at the foot of `CHANGELOG.md` name the repository it runs in (#14).
- The annotated tag written by `Release` keeps the `###` category lines of its notes: `git tag` now takes the message verbatim instead of stripping lines that start with `#` (#13).

## [0.1.0] - 2026-10-12

### Added

- `AGENTS.md`, how an agent works in this repository: identity, reading and writing maps, limits, invariants, verified commands, the checklist before calling something done, and the adoption step of a repository created from this one (#2).
- `CLAUDE.md`, the single line `@AGENTS.md`, so Claude Code loads the instructions in every session and sub-agent (#2).
- `SDLC.md`, how a change travels from a need to a release: life cycle, issues and milestones, branches, commits, when an issue closes, the three sections of a pull request, a blocked merge, tests and review, versioning, release, rollback and done criteria (#3).
- `PRD.md`, the product requirements of `memorysmithapp-template` itself: problem, audience, goals and scope, principles, ubiquitous language, journeys, the business rules `RN-DOC-001`–`007`, `RN-VER-001`–`002` and `RN-ADO-001`, quality requirements and acceptance criteria (#4).
- `ARCHITECTURE.md`, the organisation of the repository: overview, layout, the mechanism of each invariant of `AGENTS.md`, integrations, operation, and the reconstructed records ADR-001 to ADR-007 of the decisions declared before the repository existed (#5).
- `README.md`, what this repository is, how to create a repository from it and how the first session adopts it (#6).
- `package.json` at the root, private, named `@memorysmithapp/template`, the one home of the version, with pnpm pinned (#6).
- `.gitignore` and `.editorconfig` (#6).
- `scripts/setup-repo.sh`, which applies to a created repository what a copy does not carry: description, topics, merge options, wiki and discussions off, and the ruleset `main`; idempotent, using only `gh` and `jq` (#7).
- The workflow `Quality` and `pnpm run quality`: the version agrees with `CHANGELOG.md`, `CHANGELOG.md` keeps its format, `CLAUDE.md` is exactly the import, relative links and anchors resolve, and no document carries a version footer; with `pnpm test` making each check fail on a deliberate violation (#8).
- `scripts/setup-repo.sh` requires the status check `Quality` in the ruleset `main` (#8).
- The workflow `Release`: on every push to `main`, it writes the annotated tag of the version in `package.json` on the merged commit and the GitHub Release with the notes of its `CHANGELOG.md` section, and refuses a tag that already names another commit (#9).

### Changed

- `LICENSE` names `memorysmithapp` as the copyright holder (#6).
- `ARCHITECTURE.md` records that the npm organisation `memorysmithapp` exists on the free plan, so a package published under `@memorysmithapp` declares `"publishConfig": { "access": "public" }`, a package never meant to be published declares `"private": true`, and publishing from CI goes through trusted publishing; ADR-006 and `SDLC.md` §10 point at it (#11).

[unreleased]: https://github.com/memorysmithapp/memorysmithapp-template/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/memorysmithapp/memorysmithapp-template/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/memorysmithapp/memorysmithapp-template/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/memorysmithapp/memorysmithapp-template/releases/tag/v0.1.0
