# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- An empty fenced block is an empty block of code, with a language or without one, where one that named a language drew the word *undefined*; an empty block keeps the height of one line, so its *Copy* button sits inside it instead of over its edge (#38).
- An embed of a section runs to the next real heading of its level or higher: a `# ` line inside a fence of the section, such as a shell comment, is code and no longer ends the cut, which used to leave the section's code block empty (#40).
- A callout whose title holds bold or other inline markup draws its title as one sentence beside the icon, wrapping as a paragraph does, where each run of it used to be a column of its own; the words of a title travel in one element, `.callout-title-text` (#42).
- A callout type is a word of any script, as `SPEC.md` §7.1 says: `> [!atenção]` is a callout titled *Atenção* where it used to be a quotation beginning with its marker, a type written decomposed is the type written composed, and the specification now says so in words, with a conformance case for a type outside A–Z (#43).

## [0.3.0] - 2026-10-14

### Added

- `diagnose`, at `@memorysmithapp/markdown-renderer/diagnose`: a host hands it a note and gets the notices of it — where the page will not show what was typed, and what the note lacks — each with a stable code, a severity (`notice` or `hint`), the section of the specification behind it and its place as lines and columns. It never refuses a note, reads it through the same parser and plugins as `NoteBody`, runs with no DOM and no React, reports pending links only against the notebook the host describes, and loads Mermaid only for a note with a diagram (#35).
- The specification declares the notices an implementation may report (`SPEC.md` §7.13): eighteen codes, in `SPEC.md` and in `spec.json` as `notices`, each raised by a conformance case, which may now list the notices its input raises; the checker holds the table, the data and the suite together (#35).
- The headings of a body form an outline that SHOULD start at level one and descend one level at a time (`SPEC.md` §3.3); the name of a note is not a level of it, and an outline that breaks this is a notice, never an error (#35).

### Fixed

- A comment is hidden whatever it holds — inline markup, raw HTML, a wikilink, an embed, a footnote reference, blank lines and the blocks between them — where it used to be drawn whole, markers included, unless it sat inside one run of text; a comment on lines of its own leaves no empty paragraph, and a task box inside a comment is no box, so the boxes after it keep their ordinals. MemorySmith's reading page carries the defect, and the renderer now differs from it there (#36).

## [0.2.0] - 2026-10-13

### Added

- Themes: `defineTheme` and a `theme` prop that takes a theme a host writes in its own project, at three levels it may mix — properties written on the root as `--markdown-*`, now naming every value the stylesheet reads, metrics, headings, quotations, tables and callout icons included; its own CSS, scoped by the root class `markdown-theme-<name>`; and twelve slots, React components called with the notation already interpreted — with `scheme` choosing light or dark. MemorySmith's look is the theme `default`, and `theme="light"` and `theme="dark"` keep meaning it (#28).
- The stylesheet is `structure.css`, what every theme needs, and `theme-default.css`, MemorySmith's look; `styles.css` is the two together, as before (#28).
- A note's frontmatter is drawn, as the theme decides: `NoteBody` reads it by the shapes of the specification (`readProperties`) and hands it to the theme's `properties` slot; the default theme draws `name` as the note's title and every other entry above the body — lists as chips, booleans in the reader's words, dates as written — with a `[[wikilink]]` in a value drawn as a link the host resolved. A theme whose slot draws nothing keeps a note's body alone, as MemorySmith's page does (#29). The default theme draws it as MemorySmith's note page does — the title always, *Unnamed note* when there is none, and a block that folds under *Properties*, with no card, the reserved keys first, an icon per key by the shape of its value, MemorySmith's chips, dates in the reader's locale (`strings.locale`), and Markdown links and web addresses in values as links, with each key's icon on the key's first line when its value wraps, where MemorySmith's page centres it on the row (#34) — and the comparison with MemorySmith now covers the title and the properties and finds them identical (#30).
- The playground picks the theme and the scheme in its sidebar and its address, among the default theme and three example themes that live only there: `sepia`, properties alone; `docs`, its own CSS; and `terminal`, slots with icons from `lucide-react`; each draws the note's title and properties its own way, `terminal` as the YAML it is (#28, #29).

### Changed

- The demonstration notebooks show code and footnotes where each would write them: `sql`, `bash`, `diff`, `yaml` and `json` in the payments runbook and objective, `python` and `yaml` in the red-wine protocol (the `yaml` inside a callout), a `promql` fence the renderer draws as typed, fences with no language, and several footnotes per note, one cited twice and a numeric label cited before a smaller one (#32).
- The demonstration notes and the `TEMPLATE.md` of each folder start their body at a first-level heading, under the title `name:` gives, since a body may start at any level; the five notes that already started at `#` keep showing that a heading never names a note (#31).
- `NoteBody` no longer leaves the frontmatter off the page: decision 4 of #1 is superseded for it by ADR-004, and a host that already draws properties gives a theme whose `properties` slot draws nothing (#29).
- The root of a note carries the class `markdown-theme-<name>` beside `markdown`, and a callout written with a fold marker carries it as `data-fold` (#28).

### Fixed

- The footnotes of a note an embed cuts keep the space above them that the section of any note takes; drawn in a pass of their own, they lost it to the rule that takes the top margin off a run's first block (#32).
- The comparison's reference page keeps MemorySmith's pane within a phone's width, as MemorySmith's application does, where a long line of code used to widen it (#32).

## [0.1.2] - 2026-10-13

### Fixed

- `SDLC.md` §10 says the trusted publishers allow `npm publish`, as the workflow needs: without that permission npm refuses the workflow's publish instead of staging it, which is what the release of v0.1.1 met; the section also says a new trusted publisher expires unless it publishes within two days (#22).
- `pnpm run quality` reads only the Markdown files git tracks or would track, so it passes locally after `pnpm --filter playground compare` has left MemorySmith's checkout in the tree, instead of reading that checkout's documents as this repository's (#23).

## [0.1.1] - 2026-10-13

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

[unreleased]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/releases/tag/v0.1.0
