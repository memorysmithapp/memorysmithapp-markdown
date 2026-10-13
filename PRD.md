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
- `@memorysmithapp/markdown-renderer`: a React component, `NoteBody`, that draws the body of a note as MemorySmith's reading page draws it, asking the host for every piece of notebook data, in MemorySmith's look or in a theme the host writes (RN-RENDER-001 to RN-RENDER-015).

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

Codes are append-only: never renumbered, never reused. A rule that stops holding stays on its own line, marked **Removed** with the version and the reason. Areas: `SPEC` (the specification package), `RENDER` (the renderer), `DEMO` (the demonstration notebooks and the playground), `PUB` (publishing).

| Code | Rule | Status |
|---|---|---|
| RN-SPEC-001 | A notation lives in three files at once — `SPEC.md`, `spec.json` and `tests/conformance.json` — and the three move in the same commit, together with the reader that implements it. A notation whose `reader` is `links` or `frontmatter` and has no conformance case is not part of the specification; one whose `reader` is `reading-surface` is rendering, and is proved by the renderer instead of a JSON case | declared in #1 |
| RN-SPEC-002 | The specification has no version of its own: it follows the version of this repository, which both packages carry. The `url` of `spec.json` names `SPEC.md` at the tag of that version, never at `main`, so a published package names the text it implements | declared in #1 |
| RN-SPEC-003 | The package exports the document and the data at stable paths: `./SPEC.md`, `./spec.json`, `./conformance.json` and `./schema.json` | declared in #4 |
| RN-SPEC-004 | The text of the specification (`SPEC.md` and the prose of `tests/README.md`) is CC BY 4.0; the data, the suite and the checker are MIT, so an implementation may embed them without an attribution obligation on its output | *observed* in `SPEC.md`, carried over from the main repository |
| RN-SPEC-005 | The package ships the TypeScript types of its own data — the specification, its sources, each notation and its reader, a conformance case — and typed entry points `spec`, `conformance` and `cases`, so a consumer never retypes the JSON. The types admit every notation and case of the data, and nothing the schema refuses | declared in #5 |
| RN-PUB-001 | Both packages are public on npm under `@memorysmithapp`, at the version of this repository; after a package's first publish, which is the owner's, every version is published by the workflow *Release* through trusted publishing, with provenance and no token, once per version | declared in #1 and #16 |
| RN-PUB-002 | A package ships only what a consumer needs: its built modules and declarations, its `README.md` and `LICENSE`, the renderer's stylesheet, and the specification's document, data, suite and checker — no test, no fixture, no source map | declared in #16 |
| RN-DEMO-001 | The two demonstration notebooks, `continuity-engineering` in en-US and `enologia` in pt-BR, are not translations of each other; each demonstrates in context every notation of the specification but those delegated to the base parser, demonstrates none the specification does not declare, and shows the forms it does not describe being ignored, beside what to write instead | declared in #1 and #14 |
| RN-DEMO-002 | The playground draws any note of the two notebooks with the renderer, under an in-memory host, in the default theme, light and dark, and in three example themes — one of properties alone, one with its own CSS, one with slots — chosen in the page and named in its address; the example themes use only the public API and, like the playground, are never published | declared in #14 and #28 |
| RN-RENDER-001 | In its default theme, the renderer draws what MemorySmith's reading page draws today: it is that page extracted, not a new design, and what the page decided — no raw HTML, strikethrough with two tildes only, the address filter, highlight tokens as elements — is kept with its reason. A theme a host writes draws its own look; the guarantee is the default theme's | declared in #1, decision 2, and #28 |
| RN-RENDER-002 | The renderer knows no API, no router, no i18n library and no query cache: what it needs from the notebook reaches it through the host contract, as functions and words, and every default is the safe one — with no `resolve` every link is pending, with no `keeps` no embed reaches a file, with no `strings` the words are MemorySmith's English | declared in #1, decision 3 |
| RN-RENDER-003 | The renderer never rewrites the source: a note is drawn from its bytes as the host keeps them, and nothing it does changes what the host stores. Its frontmatter is content, drawn as the theme decides (RN-RENDER-015) | declared in #1, decision 4, and #29 |
| RN-RENDER-004 | The renderer renders no raw HTML: a `<script>`, an HTML block or an inline tag in a note is drawn as its text. It is a security boundary, because a notebook is written by several people and by agents (`SPEC.md` §7.9) | declared in #1, decision 2 |
| RN-RENDER-005 | A link is followed only to `http:`, `https:` and `mailto:`, to a path or to an anchor of the note; any other address — an editor's scheme, `data:`, `javascript:`, `file:` — stays on the page as text, not clickable, with a title that says why. An anchor scrolls inside the note it was drawn in and never navigates; the web opens in a new tab with `rel="noreferrer"` | declared in #6 |
| RN-RENDER-006 | A wikilink target is a name, literal, compared after NFC and never slugified; nothing inside code is touched. One note answering it is a link to the host's address; none is a pending link, drawn as such and never as a link; several — or none, when the host can ask about aliases — open a choice in place. Only an embed reaches a file the notebook keeps, and it carries the dimensions after its pipe | declared in #9 |
| RN-RENDER-007 | A note whose images name another host says so under its body, naming each host once, unless the host discloses it elsewhere (`SPEC.md` §7.10) | declared in #9 |
| RN-RENDER-008 | `![[note]]` draws the body of the one note it reaches in place, `![[note#Heading]]` its section and `![[note#^id]]` its block, with the note it came from named under it. An embed inside embedded content, past ten embeds in one note, in a table cell or in code is a link and is never dropped, so the page expands one level only and a pair of notes that embed each other cannot hang it. The body comes from the host; the package never fetches | declared in #10 |
| RN-RENDER-009 | A task box shows the state written in the source, and is one box per item. Where the host makes the note writable, a click reports the ordinal of the box among the boxes of the note as the host gave it; the host applies it as a one-character change with `toggleTaskAt`, and the package writes nothing. The boxes are disabled when the note is not writable, when the source and the drawn text disagree on how many boxes there are, and inside an embedded note, whose boxes belong to another note. A box inside a callout is counted in its place: on MemorySmith's reading page it reports the next box outside the callout, a defect this renderer does not carry | declared in #11 |
| RN-RENDER-010 | The package ships the stylesheet of the reading surface, `styles.css`: a host that imports it, KaTeX's stylesheet and the faces draws a note as MemorySmith draws it, in the light and the dark scheme. Every selector is under `.markdown`, so the package styles the note and never the page; every value the stylesheet reads is a public `--markdown-*` custom property, and a host themes a note through a theme (RN-RENDER-014) or those properties, never by overriding a selector. `structure.css` alone is what a theme that draws everything itself needs | declared in #12 and #28 |
| RN-RENDER-011 | Every entry of the specification whose `reader` is `reading-surface` is asserted by a rendering test, or listed as delegated to the base parser with the reason; an entry the specification adds that is neither fails the build | declared in #1 and #13 |
| RN-RENDER-012 | The renderer differs from MemorySmith's reading page only where the package must not reach outside the note, and says so: when the choice a link opens is up, MemorySmith stops the page behind it from scrolling by a class on `body`, and the renderer, which styles and touches nothing outside `.markdown`, leaves that to the host; and where MemorySmith carries a defect the renderer does not: a box inside a callout keeps its own ordinal (RN-RENDER-009), and a footnote an embed separates from its reference is drawn (RN-RENDER-013) | declared in #15 and #20 |
| RN-RENDER-013 | A note an embed cuts draws its footnotes as one document would (`SPEC.md` §7.12): a reference on one side of an embed reaches its definition on the other, the footnotes are numbered once in the order of the note, with ids that never repeat, and their one section is drawn at the end of the note, below its last embed too. On MemorySmith's reading page such a reference is drawn as its characters, and a section sits above an embed that ends the note. A definition written inside a quote or a list keeps MemorySmith's drawing | declared in #20 |
| RN-RENDER-014 | A host changes how a note looks with a theme it writes and ships in its own project, at three levels it may mix: properties, its own CSS scoped to the note, and components for a closed set of slots. A theme decides how a note looks and never what its notation means: every slot is handed the notation already interpreted, and no theme can draw raw HTML, follow a refused address, report another task box, or change a footnote's number. MemorySmith's look is the default theme, `default`, and `light` and `dark` keep meaning it | declared in #28 |
| RN-RENDER-015 | A note's frontmatter is content, and it is drawn: the renderer reads it as the specification does (§6) and the theme decides how, and whether. The default theme draws it as MemorySmith's note page does: `name` as the note's title, always, and the other entries in a block that folds, under a rule, the reserved keys first, each key with the icon of its value's shape — a list as chips, a boolean in the reader's words, a date in the reader's locale. A wikilink in a value is a link, resolved by the host as a link of the body is, and adds no edge; so is a Markdown link or a bare address to the web, through the address filter. A value is drawn as text, never as markup. A host that shows properties elsewhere gives a theme that draws nothing | declared in #29 and #30 |

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
| RN-PUB-001 | `scripts/publish.test.mjs` passes: nothing is published off a release, only the version of the tag, a release whose version exists fails, a run again finishes a half-done one, and a package npm has never seen is left for the owner; and both packages are on npm at the cut version |
| RN-PUB-002 | `node scripts/pack-check.mjs`, run by *Quality*, finds no file missing or extra |
| RN-DEMO-001 | `playground/test/notebooks.test.ts` passes, and fails when a declared notation is removed from either notebook |
| RN-DEMO-002 | `pnpm --filter playground dev` opens the notebooks, and `playground/test/every-note.test.tsx` draws every note in both schemes of the default theme and in every scheme of each example theme with no error |
| RN-RENDER-001 | `pnpm --filter playground compare` draws every note of the demonstration notebooks with MemorySmith's own component at `4b67c7e` and with the renderer, in light and dark, at a desktop and a phone width, and every pair matches within 0.2% of its pixels or is listed as deliberate with its reason |
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
| RN-RENDER-012 | The differences are the ones listed here, and the comparison finds no other |
| RN-RENDER-013 | `test/footnotes-across-embeds.test.tsx` passes, and the comparison lists the one demonstration note whose footnote an embed separates as deliberate |
| RN-RENDER-014 | `test/themes.test.tsx` passes: a property reaches the root and the set of properties is the set the stylesheet reads, a theme's CSS applies inside the note and not outside it, every slot is called with its documented props, and a theme filling every slot draws no raw HTML, follows no refused address and reports only an enabled box's ordinal; with no theme the comparison with MemorySmith still passes |
| RN-RENDER-015 | The comparison with MemorySmith covers the title and the properties and finds them identical, and `test/properties.test.tsx` passes: each shape of §6.3 is read and drawn, `name` is the title, a value carrying markup is text, a value's wikilink reaches the host's address or is pending, a `properties` slot gets the entries and may draw nothing, and the task ordinals are unchanged; the playground draws the frontmatter of every note in every theme |
