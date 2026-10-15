# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A note is edited on the page that draws it (#48). The editor's model is the note's bytes: the page is drawn over them by the reading surface's own parser and components, every change reaches the host whole through `onChange`, and a byte the author did not touch is never rewritten — the frontmatter's order and quoting, a list's marker, a table's spacing, a comment, a construct the specification does not describe. The note is written back with its own line break; one that mixes them opens read-only. CodeMirror 6 is the engine, on the subpath `@memorysmithapp/markdown-renderer/edit` (`NoteEditor`), loaded only when a note is edited; the decision is ADR-006 (#49).
- Every construct is edited in place: inline marks by shortcut and toolbar, a typed delimiter becoming the mark (#52); headings, lists, task lists, quotations and dividers, their notation typed at the start of a line or set from the toolbar, a list started from it on a blank line (#53, #74); links, wikilinks with the host's `suggest` offering names after `[[`, embeds and images drawn until the cursor reaches them, block identifiers shown as markers, a link followed with a modifier held (#54); callouts, their type and folding chosen in place (#55); tables, cell by cell where they stand, an empty cell as easy to click as a full one and a Tab past the last cell adding a row, with rows, columns and alignment from their controls, which keep what was typed in the cell being edited and act on the cell the author was in (#56, #68, #69); code with its language and colours, formulas and Mermaid diagrams with their drawing live below their source (#57); the frontmatter as a form — the name as the title, each key and value by its shape, a list as chips, a date as a date, a boolean as the reader's yes or no that reading draws (#61), a property's type chosen from the icon at its key, a chevron marking it as a menu, for a new property or an existing one whose value is carried over, its removal from a button before its name, always shown, in one column, a list taking item after item with its + or Enter (#70 to #73) — each field rewriting its one entry (#58); footnotes numbered and defined together, comments shown as what they are, raw HTML and unknown notation as source (#59).
- `NoteBody` takes `editable`, which draws a switch between reading and editing at the top right of the note, as its icon or its icon and its word (`modeButton`), in the reader's language (`strings.edit`, `strings.view`); `mode`, `defaultMode` and `onModeChange` let a host control the mode, and `onChange` receives each change. A theme may draw the switch through the `modeSwitch` slot (#51). The icon has a class of its own, `mode-switch-glyph`, so the icon-only form's padding never shrinks it (#60).
- In edit mode the switch keeps its place at the top right and becomes the last control of the toolbar, which grows out of it and shrinks back into it when the note returns to reading, with no motion under `prefers-reduced-motion`; on a phone the tools take the width under the switch, and a row the tools wrap to starts with no separator (#62, #65, #80).
- Beside the switch, in both modes, *Show Markdown* opens the note's Markdown, read-only and exactly as the host has it or receives it, in a modal dialog whose text alone scrolls, and *Copy Markdown* copies it, showing a check; the playground's side panel is gone (#63, #76).
- The toolbar's first button, *Undo all changes*, gives back the note as edit mode opened it, in one change that Undo reverses; it replaces the playground's restore (#67).
- A kept file is drawn by its media type, as MemorySmith's page draws it, where the host gives `fileOf`, which describes it — media type, size, addresses, description: an image, an audio or a video player, or a card with its name, its type in the reader's words, its size, its description, *Open* where a browser shows it — a file kept as `data:` opened as the `blob:` of its bytes, since a browser navigates no tab to `data:` (#79) — and *Download*. A theme may draw it through the `attachment` slot; `renderAttachment` still wins. The playground keeps one sample of each of MemorySmith's sixteen types, with their attributes and their bytes in base64 (#77).
- The toolbar's paperclip opens a dialog with three ways in (#78): a file from the computer, given a name and a description that the host's `attach` receives with it; a file the notebook keeps, listed by the new host member `files` and found by name or description; an image at a web address, written as `![name](address)`. The playground keeps the notes saved and the files attached in this browser, so both survive a reload, and its sidebar discards them.
- A file is attached in edit mode, by pasting or by dropping it, where the host gives `attach`, which keeps it and answers its name; the editor embeds it as `![[name]]`, and says on its button while the host keeps it or when it could not. The playground keeps attached files for the session, as `?save=` asks (#75).
- The editor says whether the last change was saved: when `onChange` answers with a promise, an icon before the switch — a turning loader, a check, an alert that tries again when clicked (#66) — its word in its title and told to a screen reader, in a slot of one size so the toolbar never moves. Going back to reading waits for a save in flight and stays in edit when the last save failed, the switch shaking once. A note the host passes back after saving is not applied over what the author typed since. The playground's `?save=` applies to edits as to ticks (#64).
- The words of the editor are `strings.editor`, each one a host leaves out in English; `strings.editUnavailable` says why a note opens read-only.
- The playground edits any note: beside it, the Markdown the editor would save, the lines that differ from the original marked, and a control that restores it; `?editable=0` hides the switch and `?button=icon` draws it as its icon alone (#50, #51).
- A task box shows its save on the item itself: when the host answers `onToggleTask` with a promise, the item is locked under *Updating…*, its box showing the state being written, until the promise settles; a save that fails returns the box to the state its source holds and the item says *Not saved* for a moment. Ticks reach the host one at a time, and a polite live region tells whoever hears the page. The words are `strings.updating`, `strings.notSaved` and `strings.saved`; the `taskBox` slot is handed `pending` and `failed`; a host that answers with nothing keeps today's page. The playground simulates a save with `?save=slow`, `fail` or `random` and `&delay=<ms>` (#47).

## [0.3.2] - 2026-10-15

### Fixed

- A link in a callout title is underlined, so it reads as a link whatever the colour of the callout: in a blue callout — `note`, `info`, `todo`, and every type the theme does not name, such as `[!regra]` — the title is drawn in the accent, at the weight of a wikilink, and a link in it could not be told from the title around it. A pending link keeps its dashed rule. The underline is two public properties, `--markdown-callout-title-link-decoration` and `--markdown-callout-title-link-offset`, which a theme sets as `calloutTitleLinkDecoration` and `calloutTitleLinkOffset` (#45).

## [0.3.1] - 2026-10-14

### Changed

- The demonstration notebooks show a callout title holding bold text, in the red-wine protocol and the March exercise, and a callout of a type outside A–Z, `[!atenção]`, in the protocol; the comparison with MemorySmith lists both notes as deliberate differences (#42, #43).

### Fixed

- An empty fenced block is an empty block of code, with a language or without one, where one that named a language drew the word *undefined*; an empty block keeps the height of one line, so its *Copy* button sits inside it instead of over its edge (#38).
- An embed of a section runs to the next real heading of its level or higher: a `# ` line inside a fence of the section, such as a shell comment, is code and no longer ends the cut, which used to leave the section's code block empty (#40).
- A link to a block, `[[note#^identifier]]`, keeps its label as typed, identifier included, where the label lost its `^identifier` to the rule that takes a block identifier off the page: that rule now reads the end of a block — a paragraph, a heading, a table cell — and never the end of a link or another inline inside it (#39).
- A note whose `name:` carries `#`, `[`, `]` or `|` has no name on the page and in `diagnose` too, as `SPEC.md` §5.3 says and MemorySmith reads it: `name: Incident #4711` used to be drawn as the note's title and raise nothing, and now draws *Unnamed note* and raises `name-unusable`. `SPEC.md` §6.2 now says the subset has no comments, so a ` #` is a character of the value it is written in, with a conformance case for a name and one for an attribute (#41).
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
[0.3.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/releases/tag/v0.1.0
