# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A pnpm workspace with the packages `@memorysmithapp/markdown-spec` and `@memorysmithapp/markdown-renderer` under `packages/`, built with TypeScript and tested with Vitest, configured once at the root (#3).
- `@memorysmithapp/markdown-spec` carries the MemorySmith Markdown Specification brought from the main repository at `4b67c7e`: `SPEC.md`, `spec.json` and its schema, the conformance suite and its checker, exported at `./SPEC.md`, `./spec.json`, `./conformance.json` and `./schema.json`; the `url` of `spec.json` names `SPEC.md` at the tag of the version, and the checker fails when it does not (#4).
- `@memorysmithapp/markdown-spec` ships the TypeScript types of its data and typed entry points, `import { spec, cases } from '@memorysmithapp/markdown-spec'`, with a test that compiles the data against them (#5).
- `@memorysmithapp/markdown-renderer` exports `NoteBody`, which draws the body of a note through MemorySmith's reading-page pipeline — newlines normalised, `remark-gfm` with `singleTilde: false`, no raw HTML, the address filter, footnotes and image dimensions — under a typed host contract: `resolve`, `keeps`, `renderAttachment`, `renderLink` and `strings`, with safe defaults (#6).
- A seventh check in `Quality`: every package of the workspace has the root's `version`, and a package not marked private declares public access; the workflow also installs, builds, type-checks and tests the packages (#3).

### Changed

- The repository adopts `memorysmithapp-template` v0.2.1: `AGENTS.md`, `README.md` and `package.json` name `memorysmithapp-markdown`; `PRD.md` and `ARCHITECTURE.md` keep their skeletons and the description of the parts kept; the version restarts at `0.1.0` and the changelog names this repository (#2).

[unreleased]: https://github.com/memorysmithapp/memorysmithapp-markdown/commits/main
