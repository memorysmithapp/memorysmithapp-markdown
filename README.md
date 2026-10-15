# memorysmithapp-markdown

The MemorySmith Markdown Specification — the notation MemorySmith notebooks are written in — and a React renderer that draws a note as MemorySmith does, as two npm packages under [`@memorysmithapp`](https://github.com/memorysmithapp).

Neither package exists in this repository yet: today it holds the documents it is built by and the checks that keep them true.

## Start

With Node 24 and Corepack (`corepack enable`), from the root:

```sh
pnpm install       # the workspace: packages/markdown-spec and packages/markdown-renderer
pnpm -r build      # each package into its dist/
pnpm run quality   # the checks of the documents and the version
pnpm test          # the tests of the checks and of every package
```

The workflow *Quality* runs the same commands on every pull request.

## Look at it

The two demonstration notebooks, `notebooks/continuity-engineering` (en-US) and `notebooks/enologia` (pt-BR), show every notation of the specification in context. The playground draws any of their notes with the renderer:

```sh
pnpm -r build
pnpm --filter playground dev   # http://localhost:5173/
```

The sidebar picks the theme and the scheme: the default theme, MemorySmith's look, and three example themes in `playground/src/themes/` — `sepia`, properties alone; `docs`, its own CSS; `terminal`, components. The address carries them (`?theme=sepia&scheme=dark`; `?theme=dark` is the default theme, dark), and `?lang=pt` draws the words of the page in Brazilian Portuguese.

The button at the top right of every note edits it on the page; the toolbar grows out of it, and its last tool shows the note's Markdown. The sidebar says whether the note was saved with changes, and restores the original. `?button=icon` draws the button as its icon alone and `?editable=0` hides it. A ticked task box or an edit is saved after a delay with `?save=slow`, fails with `?save=fail`, and does either with `?save=random`, so you can see the item locked under *Updating…*, the editor's icons for *Saving…* and *Saved*, and the *Not saved* that follows a failure.

## Compare it with MemorySmith

The renderer is MemorySmith's reading page, extracted. This draws every note of the two notebooks with MemorySmith's own component and with the renderer, in light and dark, at a desktop and a phone width, and compares the images:

```sh
npx playwright install --with-deps chromium   # once
pnpm --filter playground compare
```

The first run clones MemorySmith at the commit the renderer was extracted from and installs its frontend; the images land in `playground/compare/out/`.

## Repository settings

The settings a copy of the files does not carry — description, topics, merge options, wiki and discussions off, and the ruleset `main` that protects the default branch — are applied by a script, with `gh` authenticated as an administrator and [`jq`](https://jqlang.org/) installed. It was run with:

```sh
scripts/setup-repo.sh memorysmithapp/memorysmithapp-markdown \
  "The MemorySmith Markdown Specification — the notation MemorySmith notebooks are written in — as a document, as data and as a conformance suite, with a React renderer that draws a note exactly as MemorySmith does." \
  markdown,commonmark,gfm,specification,conformance,react,remark,knowledge-management,mcp
```

It is idempotent: run it again whenever the ruleset or the settings drift, and it puts back only what differs.

## The documents

| Document | Answers |
|---|---|
| [`AGENTS.md`](AGENTS.md) (imported by [`CLAUDE.md`](CLAUDE.md)) | How an agent works here |
| [`PRD.md`](PRD.md) | What the product solves and delivers, under which rule |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the repository is organised, and why |
| [`SDLC.md`](SDLC.md) | How a change travels from an issue to a release |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed in each version |

The version lives in the `version` field of [`package.json`](package.json).

## Licence

[MIT](LICENSE).
