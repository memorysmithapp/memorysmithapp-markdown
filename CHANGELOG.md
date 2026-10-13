# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `NoteBody` draws a footnote whose reference and definition an embed separates: a note an embed cuts numbers its footnotes once, in the order of the note, with ids that never repeat, and draws their one section at its end, below its last embed too, where MemorySmith's reading page draws the reference as its characters; a way back reaches a reference in another run (#20).
- `.gitignore` ignores the tarballs `pnpm pack` leaves in a package during the first publish, so they cannot be committed by accident (#21).

### Changed

- `SDLC.md` §10 says that the first publish needs two-factor authentication on the owner's npm account, and that a version the workflow publishes is staged until the owner approves it on npmjs.com, with the trusted publisher's settings as configured (#22).

## [0.1.0] - 2026-10-12

### Added

- A pnpm workspace with the packages `@memorysmithapp/markdown-spec` and `@memorysmithapp/markdown-renderer` under `packages/`, built with TypeScript and tested with Vitest, configured once at the root (#3).
- `@memorysmithapp/markdown-spec` carries the MemorySmith Markdown Specification brought from the main repository at `4b67c7e`: `SPEC.md`, `spec.json` and its schema, the conformance suite and its checker, exported at `./SPEC.md`, `./spec.json`, `./conformance.json` and `./schema.json`; the `url` of `spec.json` names `SPEC.md` at the tag of the version, and the checker fails when it does not (#4).
- `@memorysmithapp/markdown-spec` ships the TypeScript types of its data and typed entry points, `import { spec, cases } from '@memorysmithapp/markdown-spec'`, with a test that compiles the data against them (#5).
- `@memorysmithapp/markdown-renderer` exports `NoteBody`, which draws the body of a note through MemorySmith's reading-page pipeline — newlines normalised, `remark-gfm` with `singleTilde: false`, no raw HTML, the address filter, footnotes and image dimensions — under a typed host contract: `resolve`, `keeps`, `renderAttachment`, `renderLink` and `strings`, with safe defaults (#6).
- `NoteBody` draws callouts titled in the host's words, marked text, comments off the page, block identifiers off the page, and mathematics through KaTeX, with the dollar rule that keeps `R$100 e o frete R$200` a sentence (#7).
- `NoteBody` draws code as MemorySmith does: `mermaid` fences as diagrams through a lazily imported Mermaid that shows its source when it fails, fifteen languages highlighted into React elements, and every fence in a frame with a Copy button that copies the bytes as typed; `theme` picks Mermaid's theme, and `katex` is a peer dependency for its stylesheet (#8).
- `NoteBody` resolves wikilinks as MemorySmith does — a literal name after NFC, nothing inside code touched, a pending link drawn as such, a choice in place when several notes answer through the host's `reaches` and `choose` — draws a file the notebook `keeps` only for an embed, through the host's `renderAttachment`, and says under the body which hosts a note's images fetched from; `splitFrontmatter` and `remoteImageHosts` are exported for hosts (#9).
- `NoteBody` draws embedded notes in place — a whole note, a section or a block, with the note they came from named under them — from the body the host's `loadNote` gives, one level deep, at most ten per note, and as a link inside a table cell or code (#10).
- `NoteBody` draws task boxes that report the ordinal of the ticked box through `onToggleTask` when the host makes the note `writable`, and exports `toggleTaskAt`, `taskCheckedAt`, `taskBoxes` and `ordinalAt`, so the host applies a tick as a one-character change; a box inside a callout keeps an ordinal of its own, which MemorySmith's reading page does not give it (#11).
- `@memorysmithapp/markdown-renderer/styles.css`, the stylesheet of MemorySmith's reading surface scoped under `.markdown`, with its colours, faces and radii as `--markdown-*` custom properties in a light and a dark theme, picked by the `data-theme` the root of a note carries from `theme`; the root draws what sits beside the runs of text — an embed, a pending embed, the notice of remote images — under the body's line height, as MemorySmith's page does (#12, #15).
- Every `reading-surface` entry of the specification is asserted by the renderer's conformance test, reading the entries from `@memorysmithapp/markdown-spec`, or listed in the exported `DELEGATED_TO_THE_BASE_PARSER`; an entry in neither fails the build (#13).
- The demonstration notebooks `continuity-engineering` (en-US) and `enologia` (pt-BR), brought from MemorySmith's history at `9dbc682` with a footnote added to each, the one notation they lagged on, and three fixture images they draw; a test guards that each shows every declared notation and none the specification does not declare (#14).
- A playground, a private Vite page of the workspace that draws any note of the two notebooks with the renderer under an in-memory host, in light and dark (#14).
- `pnpm --filter playground compare`, which draws every note of the demonstration notebooks with MemorySmith's own reading surface at `4b67c7e` and with the renderer, in light and dark, at a desktop and a phone width, and compares the images: the 56 pairs are identical (#15).
- The workflow `Release` publishes both packages to npm after it writes the tag, through trusted publishing with provenance and no token, by `scripts/publish.mjs`: only on a release, only the version of the tag, failing when that version exists already, and leaving a package npm has never seen for the owner's first publish, whose steps `SDLC.md` §10 lists (#16).
- Both packages are complete for npm — description, keywords, homepage, repository, `files`, `exports` and types, a `README.md` and a `LICENSE` each — and `Quality` checks with `npm pack --dry-run` that each ships exactly the files meant to ship (#16).
- A seventh check in `Quality`: every package of the workspace has the root's `version`, and a package not marked private declares public access; the workflow also installs, builds, type-checks and tests the packages (#3).

### Changed

- The repository adopts `memorysmithapp-template` v0.2.1: `AGENTS.md`, `README.md` and `package.json` name `memorysmithapp-markdown`; `PRD.md` and `ARCHITECTURE.md` keep their skeletons and the description of the parts kept; the version restarts at `0.1.0` and the changelog names this repository (#2).

### Fixed

- `Quality` check 4 reads a footnote definition, `[^label]: text`, as prose instead of as a link definition pointing at its first word (#14).

[unreleased]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/releases/tag/v0.1.0
