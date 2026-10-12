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

### 1.1 The renderer

`@memorysmithapp/markdown-renderer` exports one component, **`NoteBody`**, which draws the body of a note. The name says what it draws — the body, never the frontmatter, which a host shows as properties — and leaves `Markdown` to the component that draws one parsed run, as MemorySmith's reading page names it.

- **`NoteBody`** (`src/NoteBody.tsx`) takes the note as the host keeps it, frontmatter included, cuts the frontmatter off, and draws the rest inside `<div class="markdown">`. It is MemorySmith's `WritableContent`: it splits the body into runs of text and embeds (`splitEmbeds`, `src/transclusion.ts`), resolves the wikilinks of each run, and draws each run with `Markdown` and each embed with `Transclusion` — the body of the one note a target reaches, asked of the host's `loadNote`, cut to the section or block its anchor names, its own embeds demoted to links so the page expands one level only, and the note it came from named in a caption. Past `EMBED_LIMIT` (10) embeds, and inside a table cell or code, an embed is a link, never dropped.
- **`Markdown`** (`src/Markdown.tsx`) is MemorySmith's `Markdown` component: `react-markdown` over the text with newlines normalised, no raw HTML (no `rehype-raw`), `followable` as `urlTransform`, the footnote labels of the host, and the components that draw an anchor and an image. Its plugins run in this order, and the order is part of the contract:
  1. `remark-gfm`, at `singleTilde: false`, so `H~2~O` is not struck;
  2. `remarkCallouts` (`src/remark-callouts.ts`), titled by `strings.callouts`, or by the kind capitalised;
  3. `remarkHighlight`, `remarkComments` and `remarkBlockIds` (`src/remark-ring.ts`), on text nodes only, so nothing inside code is touched;
  4. `remark-math`;
  5. `remarkMathDollarRule`, **after** `remark-math`: it gives back to the text an inline formula that breaks the dollar rule of `SPEC.md` §7.8, reading the source the parser read, so `R$100 e o frete R$200` stays a sentence;
  6. `rehype-katex` with `throwOnError: false`, so a formula KaTeX cannot typeset shows its source.

  Before the parser, `NoteBody` rewrites the text it hands it, never the note: `resolveWikilinks` (`src/markdown.ts`) turns each `[[name]]` outside code into a Markdown link to the host's address, to `pending:` when no note answers, to `choice:` when the host has `choose` and no single note answers, and each `![[file]]` the host `keeps` into `attachment:` with its dimension. Code — fences by the specification's rules, code spans by their runs — is found before anything is rewritten, so notation inside it stays characters. The anchor of the surface turns each of those schemes into what it is: `pending:` into a pending span, `attachment:` into the host's `renderAttachment`, `choice:` into `LinkChoice`, a modal dialog of the notes the host's `choose` answers. `followable` lets the three schemes through.

  Code is drawn by three branches, in this order: a `mermaid` fence reaches `MermaidDiagram` untouched; a fence whose language `refractor` carries (`src/highlight.ts`, MemorySmith's fifteen grammars) is tokenised into a hast tree that `hast-util-to-jsx-runtime` turns into React elements, never an HTML string; everything else is drawn as it was typed. A fence other than a diagram sits in a `.code-block` frame with a `CopyButton` that copies the `textContent` of the code less the newline before the closing fence.
- **The host contract** (`src/host.tsx`) is the typed props object `NoteHost`, resolved once into defaults and handed down through a React context, so every part of the surface reads the same host without props threaded through `react-markdown`:

| Prop | Shape | Default |
|---|---|---|
| `resolve` | `(name) => string \| null`: the address of the one note a target names, compared after NFC | Every link is pending |
| `reaches` | `(name) => number`: how many notes a target reaches, by name or by alias | 1 when `resolve` answers, 0 otherwise |
| `choose` | `(name) => Promise<LinkChoices>`: the notes a target no single note answers may lead to, asked on a click | Such a link is pending and asks nothing |
| `targetAddress` | `(name) => string \| null`: the host's page about a target, for a new tab | None |
| `navigate` | `(address) => void`: goes to an internal address | `location.assign` |
| `loadNote` | `(name) => Promise<{ markdown, name, address } \| null>`: the note an embed draws in place, asked only when exactly one note reaches the target | Every embed of a note is pending |
| `keeps` | `(name) => boolean`: whether the notebook keeps a file by that name | No embed reaches a file |
| `renderAttachment` | `({ name, width, height }) => ReactNode`: draws a kept file | The file's name as text |
| `renderLink` | `({ href, className, children }) => ReactNode`: follows an internal address with the host's router | A plain `<a>` |
| `remoteNotice` | `boolean`: whether a note that fetched images from other sites says so under its body | `true` |
| `theme` | `'light' \| 'dark'`: the theme the host draws in, which picks Mermaid's | `light` (Mermaid's `neutral`) |
| `strings` | `Partial<NoteStrings>`: callout titles by kind, the footnote label and back label, the titles of a pending link, a refused link and a missing attachment, the verb of the Copy button and what it says once copied, the notice of remote images, the words of the choice a link opens, and what an embed says when its section is missing | MemorySmith's English (`ENGLISH`) |

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
| `packages/markdown-spec/` | `@memorysmithapp/markdown-spec`: `package.json`, `tsconfig.json` (type-checks sources and tests), `tsconfig.build.json` (emits `dist/` from `src/`, tests excluded), `src/`, `test/` |
| `packages/markdown-spec/SPEC.md` | The specification as a document, CC BY 4.0 |
| `packages/markdown-spec/spec.json` | Every notation as data: identifier, reader, syntax, example, effect, governing section; validated by `schema/spec.schema.json` |
| `packages/markdown-spec/tests/conformance.json`, `tests/README.md` | The conformance suite, and its format |
| `packages/markdown-spec/tools/check-spec.mjs` | The checker that keeps the document, the data and the suite together (RN-SPEC-001, RN-SPEC-002); Node only |
| `packages/markdown-spec/src/types.ts` | The types of `spec.json` and of a conformance case (RN-SPEC-005) |
| `packages/markdown-spec/src/index.ts` | The typed entry point: `spec`, `conformance` and `cases`, the JSON files given their types |
| `packages/markdown-spec/src/json.d.ts` | Types a JSON import as `unknown` for the build, which runs without `resolveJsonModule` so the data stays at the root of the package and is not copied into `dist/` |
| `packages/markdown-spec/test/` | The tests of the checker and of the types |
| `packages/markdown-spec/LICENSE` | The MIT licence of the data, the suite and the checker, shipped with the package |
| `packages/markdown-renderer/` | `@memorysmithapp/markdown-renderer`, laid out as `markdown-spec`; `react` and `react-dom` 19 are its peer dependencies |
| `packages/markdown-renderer/src/NoteBody.tsx`, `Markdown.tsx` | The component and the pipeline of one parsed run ([§1.1](#11-the-renderer)) |
| `packages/markdown-renderer/src/host.tsx`, `strings.ts` | The host contract, its defaults, and the words of the page with MemorySmith's English |
| `packages/markdown-renderer/src/address.ts` | `followable`, the address filter (RN-RENDER-005) |
| `packages/markdown-renderer/src/image-dimensions.ts` | The dimensions an alt text or an embed declares after its pipe |
| `packages/markdown-renderer/src/markdown.ts` | The text helpers that run before the parser: code, fence and table regions, wikilink resolution, the hosts of remote images, and the frontmatter as MemorySmith reads it |
| `packages/markdown-renderer/src/transclusion.ts`, `Transclusion.tsx` | The split of a body into text and embeds, the cut of a section or a block, and the embed drawn in place |
| `packages/markdown-renderer/src/wikilink-address.ts` | Where a wikilink goes under the host: its note, the choice, or pending |
| `packages/markdown-renderer/src/LinkChoice.tsx` | The choice a link opens when no single note answers it |
| `packages/markdown-renderer/src/highlight.ts` | The fifteen grammars `refractor` registers, and the tokens of a fence as a hast tree |
| `packages/markdown-renderer/src/MermaidDiagram.tsx`, `CopyButton.tsx` | A diagram drawn by a lazily imported Mermaid, and the button that copies a block |
| `packages/markdown-renderer/src/remark-callouts.ts`, `remark-ring.ts` | The remark plugins of callouts, marked text, comments, block identifiers and the dollar rule |
| `packages/markdown-renderer/test/` | The renderer's tests, in `jsdom`; `setup.ts` gives jsdom the `CSS.escape` a browser has |
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

### The specification keeps its three files together

Not an invariant of `AGENTS.md`, a rule of `PRD.md` (RN-SPEC-001, RN-SPEC-002), enforced here because it is the property the specification package exists for.

**Mechanism:** [`packages/markdown-spec/tools/check-spec.mjs`](packages/markdown-spec/tools/check-spec.mjs), the first half of the package's `test`, run by `pnpm test` and so by the workflow *Quality*. It validates `spec.json` against its schema with a validator that implements only the keywords the schema uses and fails on any other; refuses duplicated identifiers, a case naming an undeclared notation, a case that asserts nothing, a notebook without a resolution and the reverse, a `links` or `frontmatter` notation with no case, and a section reference — in the data or in the prose of `SPEC.md` — with no heading; fails when `SPEC.md` is missing instead of skipping it; and fails when the `url` of `spec.json` is not `SPEC.md` at the tag `v<version>` of the package's `package.json`. Its tests (`test/check-spec.test.ts`) run it against a copy of the package carrying one deliberate defect each.

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

### ADR-001 The types of the data live beside the data

- **Context:** the data of the specification is JSON, and every consumer retyped it. The main repository did, in `contracts/src/markdown.ts`, and a hand-retyped response is the defect that file's history warns about: the copy compiles, and drifts from the data in silence (*observed* at `4b67c7e`).
- **Decision:** `@memorysmithapp/markdown-spec` ships the types of its own data in `src/types.ts`, and typed entry points (`spec`, `conformance`, `cases`) next to the raw JSON exports. A test compiles every notation and every case as a literal against the types, compiles values the schema refuses to prove the types refuse them, and type-checks a consumer against the emitted declarations.
- **Rationale:** the types change in the same commit as the data (RN-SPEC-001 already makes the data move with the document), and the compiler, not a reader, checks that they agree. Generating them from the schema was not chosen: the schema says nothing about a conformance case, whose semantics live in `tests/README.md`, and a generator would be one more tool for a few dozen lines.
- **Consequences:** what an implementation decides on top of the specification is not typed here. The two lists the main repository calls "ours and not the profile's" — the entries delegated to the base parser and the forms deliberately left silent — stay with their implementations: the first with the renderer, the second with the main repository.
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** declared by the owner in #5.

### ADR-002 How the renderer carries its heavy libraries

- **Context:** `mermaid`, `katex` and `refractor` are heavy, and a host may already carry some of them. MemorySmith's reading page imports Mermaid lazily, typesets with the KaTeX that `rehype-katex` brings, and takes the stylesheet from its own `katex` dependency (*observed* at `4b67c7e`).
- **Decision:** `refractor` and `hast-util-to-jsx-runtime` are dependencies; so is `mermaid`, imported only through `import('mermaid')` inside `MermaidDiagram`, so a bundler puts it in a chunk of its own that loads when a note holds a diagram. `rehype-katex` is a dependency and brings the KaTeX that typesets; `katex` is a **peer dependency**, because what the host needs from it is the stylesheet and its fonts (`katex/dist/katex.min.css`), which only the host can import into its page. The versions are the ones MemorySmith's frontend locks.
- **Rationale:** a dependency the renderer cannot draw without belongs to the renderer, and installing it is not the host's problem; Mermaid's weight is paid at load time, not at install time, and the dynamic import is what keeps it out of the initial bundle. KaTeX's stylesheet carries fonts a bundler has to resolve, which is the host's work.
- **Consequences:** a host imports `katex/dist/katex.min.css` beside the package's stylesheet. A test reads the built `dist/` and fails if any module imports `mermaid` statically.
- **Date:** 2026-10-12. **Status:** Accepted. **Origin:** decided in #8, as the issue asked.
