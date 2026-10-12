# PRD

What `memorysmithapp-markdown` solves and delivers, and under which rule: the MemorySmith Markdown Specification and the React renderer that draws a note as MemorySmith does.

Claims carry their status when it is not obvious: *observed* (seen in this repository or in GitHub), *declared* (said by the owner of the organisation), *inferred* (an interpretation to confirm). What was not verified is marked **To confirm**.

## 1. Problem

*Instruction: the pain the product removes, for whom, and how it shows today.*

The notation MemorySmith notebooks are written in, and the way MemorySmith draws a note, lived only inside the main repository, [`memorysmithapp/memorysmithapp`](https://github.com/memorysmithapp/memorysmithapp): the specification as a document beside the product's code, and the drawing as a component bound to the product's API, router, locale and query cache. Nobody outside that repository could implement the notation against a published text, or draw a note the way MemorySmith does, without copying both (*declared* in #1).

## 2. Audience

*Instruction: who uses the product, and what each of them needs from it.*

- **Implementers of the notation**, MemorySmith first: need the specification as a text to read, as data to build from, and as a suite to prove against, at a version that does not move (*declared* in #1).
- **Hosts that draw notes**, MemorySmith's reading page first: need a component that draws a note as MemorySmith does and asks the host for every piece of notebook data (*declared* in #1).

## 3. Goals and scope

*Instruction: what the current version delivers, and what it deliberately does not.*

**Delivers:**

- `@memorysmithapp/markdown-spec`: the MemorySmith Markdown Specification as a document (`SPEC.md`), as data (`spec.json` and its schema) and as a conformance suite (`tests/conformance.json`), with the checker that keeps the three together, and the TypeScript types of its data ([§7](#7-features-and-rules), RN-SPEC-001 to RN-SPEC-005).
- `@memorysmithapp/markdown-renderer`: a React component, `NoteBody`, that draws the body of a note as MemorySmith's reading page draws it, asking the host for every piece of notebook data (RN-RENDER-001 to RN-RENDER-011).

**Deliberately does not** (*declared* in #1):

- An editor. If one comes, it comes as a need opened in this repository.
- Any change to the main repository: incorporating the packages there is that repository's work.

## 4. Principles

*Instruction: the product principles behind the decisions, each in one sentence.*

## 5. Ubiquitous language

*Instruction: the terms of the product, each with the meaning it has here and nowhere else.*

## 6. Journeys

*Instruction: the paths a member of the audience follows through the product, step by step.*

## 7. Features and rules

*Instruction: what the product provides, as business rules with codes `RN-{AREA}-{NNN}`.*

Codes are append-only: never renumbered, never reused. A rule that stops holding stays on its own line, marked **Removed** with the version and the reason. Areas: `SPEC` (the specification package), `RENDER` (the renderer).

| Code | Rule | Status |
|---|---|---|
| RN-SPEC-001 | A notation lives in three files at once — `SPEC.md`, `spec.json` and `tests/conformance.json` — and the three move in the same commit, together with the reader that implements it. A notation whose `reader` is `links` or `frontmatter` and has no conformance case is not part of the specification; one whose `reader` is `reading-surface` is rendering, and is proved by the renderer instead of a JSON case | declared in #1 |
| RN-SPEC-002 | The specification has no version of its own: it follows the version of this repository, which both packages carry. The `url` of `spec.json` names `SPEC.md` at the tag of that version, never at `main`, so a published package names the text it implements | declared in #1 |
| RN-SPEC-003 | The package exports the document and the data at stable paths: `./SPEC.md`, `./spec.json`, `./conformance.json` and `./schema.json` | declared in #4 |
| RN-SPEC-004 | The text of the specification (`SPEC.md` and the prose of `tests/README.md`) is CC BY 4.0; the data, the suite and the checker are MIT, so an implementation may embed them without an attribution obligation on its output | *observed* in `SPEC.md`, carried over from the main repository |
| RN-SPEC-005 | The package ships the TypeScript types of its own data — the specification, its sources, each notation and its reader, a conformance case — and typed entry points `spec`, `conformance` and `cases`, so a consumer never retypes the JSON. The types admit every notation and case of the data, and nothing the schema refuses | declared in #5 |
| RN-RENDER-001 | The renderer draws what MemorySmith's reading page draws today: it is that page extracted, not a new design, and what the page decided — no raw HTML, strikethrough with two tildes only, the address filter, highlight tokens as elements — is kept with its reason | declared in #1, decision 2 |
| RN-RENDER-002 | The renderer knows no API, no router, no i18n library and no query cache: what it needs from the notebook reaches it through the host contract, as functions and words, and every default is the safe one — with no `resolve` every link is pending, with no `keeps` no embed reaches a file, with no `strings` the words are MemorySmith's English | declared in #1, decision 3 |
| RN-RENDER-003 | The renderer never rewrites the source: a note is drawn from its bytes as the host keeps them, its frontmatter is not drawn, and nothing it does changes what the host stores | declared in #1, decision 4 |
| RN-RENDER-004 | The renderer renders no raw HTML: a `<script>`, an HTML block or an inline tag in a note is drawn as its text. It is a security boundary, because a notebook is written by several people and by agents (`SPEC.md` §7.9) | declared in #1, decision 2 |
| RN-RENDER-005 | A link is followed only to `http:`, `https:` and `mailto:`, to a path or to an anchor of the note; any other address — an editor's scheme, `data:`, `javascript:`, `file:` — stays on the page as text, not clickable, with a title that says why. An anchor scrolls inside the note it was drawn in and never navigates; the web opens in a new tab with `rel="noreferrer"` | declared in #6 |
| RN-RENDER-006 | A wikilink target is a name, literal, compared after NFC and never slugified; nothing inside code is touched. One note answering it is a link to the host's address; none is a pending link, drawn as such and never as a link; several — or none, when the host can ask about aliases — open a choice in place. Only an embed reaches a file the notebook keeps, and it carries the dimensions after its pipe | declared in #9 |
| RN-RENDER-007 | A note whose images name another host says so under its body, naming each host once, unless the host discloses it elsewhere (`SPEC.md` §7.10) | declared in #9 |
| RN-RENDER-008 | `![[note]]` draws the body of the one note it reaches in place, `![[note#Heading]]` its section and `![[note#^id]]` its block, with the note it came from named under it. An embed inside embedded content, past ten embeds in one note, in a table cell or in code is a link and is never dropped, so the page expands one level only and a pair of notes that embed each other cannot hang it. The body comes from the host; the package never fetches | declared in #10 |
| RN-RENDER-009 | A task box shows the state written in the source, and is one box per item. Where the host makes the note writable, a click reports the ordinal of the box among the boxes of the note as the host gave it; the host applies it as a one-character change with `toggleTaskAt`, and the package writes nothing. The boxes are disabled when the note is not writable, when the source and the drawn text disagree on how many boxes there are, and inside an embedded note, whose boxes belong to another note. A box inside a callout is counted in its place: on MemorySmith's reading page it reports the next box outside the callout, a defect this renderer does not carry | declared in #11 |
| RN-RENDER-010 | The package ships the stylesheet of the reading surface, `styles.css`: a host that imports it, KaTeX's stylesheet and the faces draws a note as MemorySmith draws it, in the light and the dark theme. Every selector is under `.markdown`, so the package styles the note and never the page, and a host themes it through `--markdown-*` custom properties without overriding a selector | declared in #12 |
| RN-RENDER-011 | Every entry of the specification whose `reader` is `reading-surface` is asserted by a rendering test, or listed as delegated to the base parser with the reason; an entry the specification adds that is neither fails the build | declared in #1 and #13 |

## 8. Quality requirements

*Instruction: the measurable qualities the product holds, each with its threshold.*

## 9. Acceptance criteria

*Instruction: how each rule is checked, by its code.*

| Rule | The rule holds when |
|---|---|
| RN-SPEC-001 | `pnpm --filter @memorysmithapp/markdown-spec test` passes, and fails on a missing `SPEC.md`, a `links` or `frontmatter` notation with no case, a case naming a notation that does not exist, or a section reference with no heading |
| RN-SPEC-002 | The same test fails when the `url` of `spec.json` does not name `SPEC.md` at `v<version>` of the package |
| RN-SPEC-003 | A consumer resolves each of the four paths from the installed package |
| RN-SPEC-004 | `SPEC.md` ends with its licence section, and the package declares `MIT AND CC-BY-4.0` |
| RN-SPEC-005 | `test/types.test.ts` compiles every notation and case against the types with no error, compiles a value the schema refuses with one, and type-checks a consumer project against the emitted declarations |
| RN-RENDER-001 | The renderer and MemorySmith's reading page draw the same image of every note of the demonstration notebooks |
| RN-RENDER-002 | `test/note-body.test.tsx` draws a note with only the package and React installed, and with no host prop at all |
| RN-RENDER-003 | No export of the package returns a note other than the one it was given, but for `toggleTaskAt`, which the host calls itself |
| RN-RENDER-004 | A note carrying `<script>` renders no `script` element, and its text is on the page |
| RN-RENDER-005 | `test/address.test.ts` keeps each allowed address and refuses one of each refused kind |
| RN-RENDER-006 | `test/links.test.tsx`, `link-target.test.ts`, `code-is-text.test.ts`, `image-and-attachment.test.ts` and `attachment-address.test.tsx` pass |
| RN-RENDER-007 | The remote-notice cases of `test/links.test.tsx` and of the conformance test pass |
| RN-RENDER-008 | `test/embeds.test.tsx`, `transclusion.test.ts`, `transcluded-links.test.ts` and `block-anchors.test.ts` pass, and an embed nested three levels deep draws one level and a link |
| RN-RENDER-009 | `test/task-toggle.test.tsx` ticks every enabled box of a note with boxes in nested lists, in callouts and around embeds, and each tick changes exactly the character between that box's brackets; `task-box.test.tsx` and `tasklist.test.ts` pass |
| RN-RENDER-010 | `test/stylesheet.test.ts` finds no selector outside `.markdown` and every public property in `ARCHITECTURE.md` §1.2; the comparison with MemorySmith's page matches in both themes |
| RN-RENDER-011 | `test/reading-surface-conformance.test.tsx` passes with the asserted and the delegated sets covering all the entries, and fails, in `conformance-coverage.test.ts`, when a fake entry is added |
