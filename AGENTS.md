# AGENTS.md

How an agent works in this repository. `CLAUDE.md` imports this file, so it is loaded whole in every session and every sub-agent: it stays short and points at sections of the other documents instead of repeating them.

## 1. Identity

- **Name:** `memorysmithapp-markdown`.
- **Purpose:** the MemorySmith Markdown Specification — the notation MemorySmith notebooks are written in — and a React renderer that draws a note as MemorySmith does, as two npm packages under `@memorysmithapp`.
- **Organisation:** [`memorysmithapp`](https://github.com/memorysmithapp).
- **Licence:** MIT, public repository.
- **Version:** the `version` field of the root `package.json`, and nowhere else.

## 2. Reading map

Read in this order; open a document at the section that answers the question in hand, not whole.

| Question | Where |
|---|---|
| What is this and how do I start? | [`README.md`](README.md) |
| What does the product solve and deliver, and under which rule? | [`PRD.md`](PRD.md), the rules in [§7](PRD.md#7-features-and-rules) |
| How is it organised, and why? | [`ARCHITECTURE.md`](ARCHITECTURE.md), the invariants in [§3](ARCHITECTURE.md#3-invariants-and-their-mechanisms), the decisions in [§6](ARCHITECTURE.md#6-architecture-decision-records) |
| How does a change travel to `main` and to a release? | [`SDLC.md`](SDLC.md) |
| What changed, and when? | [`CHANGELOG.md`](CHANGELOG.md) and the git history |
| What is planned, undecided or at risk? | The issues and milestones on GitHub, never a document |

## 3. Writing map

Each fact has one home. When a paragraph seems to fit two documents it goes into exactly one, and the other references it by section.

| The paragraph says… | It belongs to… |
|---|---|
| What the product solves, for whom, a business rule, a term of the ubiquitous language, a quality requirement | `PRD.md` |
| How the code or the repository is organised, a dependency, an integration, the mechanism of an invariant, a technical decision and its reason | `ARCHITECTURE.md` (a decision becomes an ADR) |
| How a change reaches `main` or a release: issues, branches, commits, PRs, review, versioning, rollback | `SDLC.md` |
| How to install, run or start using it | `README.md` |
| A rule an agent must not break, a verified command, the checklist before done | `AGENTS.md`, one line pointing at the home of its reason |
| What changed in a version | `CHANGELOG.md` |
| **Boundary:** "this changes the code" | `ARCHITECTURE.md`, even when it also changes how work flows |
| **Boundary:** "this changes the path to `main`" | `SDLC.md`, even when a workflow file implements it |
| **Boundary:** "this is why we chose it" | The ADR in `ARCHITECTURE.md`; `PRD.md` states the rule, not the history |
| **Boundary:** a rule that holds and is enforced | The rule in `PRD.md`, its enforcement in `ARCHITECTURE.md`, its one-line limit or invariant here |
| **Last row, absolute:** a hypothesis, the roadmap, an open risk, an undecided question, anything about the future | An issue, never a document |

## 4. Limits

One line each; the reason lives where the link points.

- `main` is protected: every change reaches it through a pull request. Never push to `main`; never use `--admin`, *Bypass rules*, `--no-verify` or an equivalent ([SDLC §1](SDLC.md#1-the-life-cycle-of-a-change)).
- A blocked merge means **stop and report**, never work around it ([SDLC §7](SDLC.md#7-a-blocked-merge)).
- An issue before implementing. An opinion asked for, or "open the issue", means register and ask; implement only on an explicit go-ahead from the owner ([SDLC §2](SDLC.md#2-issues-and-milestones)).
- Nobody tags by hand: tags and Releases are written by the release workflow ([SDLC §10](SDLC.md#10-release)).
- A document never describes the future: if it is in a document, it is true now ([SDLC §2](SDLC.md#2-issues-and-milestones)).
- No version notes, revision dates or "internal document" footers inside documents; history lives in `CHANGELOG.md` and git ([SDLC §4](SDLC.md#4-commits)).
- Everything is written in American English (en-US): documents, code, comments, commits, branches, issue and PR text.
- Create or delete a GitHub repository, or change a ruleset, only with the owner's go-ahead in the session.

## 5. Invariants

- **INV-01** The version has exactly one home, the root `package.json`, and `CHANGELOG.md` agrees with it ([mechanism](ARCHITECTURE.md#inv-01-the-version-has-one-home)).
- **INV-02** `CLAUDE.md` is exactly `@AGENTS.md` and nothing else ([mechanism](ARCHITECTURE.md#inv-02-claudemd-is-only-the-import)).
- **INV-03** `main` changes only through a pull request ([mechanism](ARCHITECTURE.md#inv-03-main-changes-only-through-a-pull-request)).
- **INV-04** Only the release workflow writes a tag, and a version names one commit ([mechanism](ARCHITECTURE.md#inv-04-only-the-release-workflow-writes-a-tag)).
- **INV-05** The documents keep their form: the changelog's format, links and anchors that resolve, no version footers ([mechanism](ARCHITECTURE.md#inv-05-the-documents-keep-their-form)).

## 6. Verified commands

Each command with the directory it runs in, what it does, and the date somebody last ran it and saw it work. A command nobody ran is never listed.

| Command | Run in | What it does | Last verified |
|---|---|---|---|
| `scripts/setup-repo.sh <owner>/<repo> "<description>" <topic>[,<topic>...]` | The root | Applies the description, topics, merge options, wiki and discussions off, and the ruleset `main`; idempotent | 2026-10-12, by the owner, when the repository was created |
| `pnpm install` | The root | Installs the workspace from `pnpm-lock.yaml` | 2026-10-12 |
| `pnpm -r build` | The root | Builds every package into its `dist/` | 2026-10-12 |
| `pnpm -r typecheck` | The root | Type-checks every package, sources and tests | 2026-10-12 |
| `node scripts/pack-check.mjs` | The root, after the build | Compares what `npm pack --dry-run` packs for each published package with what it is meant to ship | 2026-10-12 |
| `node scripts/publish.mjs <action> <tag> --dry-run` | The root, after the build | Decides what *Release* would publish to npm for that action and tag, packs it and asks npm for a dry run; sends nothing | 2026-10-12 |
| `pnpm run quality` | The root | Runs the checks of the workflow *Quality* ([SDLC §8](SDLC.md#8-tests-and-review)); exit 1 and the failing lines when one fails | 2026-10-12 |
| `pnpm test` | The root | Runs the tests of the checks, each against a deliberate violation, then builds the packages and runs every package's tests | 2026-10-12 |
| `pnpm --filter <package> test` | The root | Runs one package's tests | 2026-10-12 |
| `pnpm --filter playground compare` | The root | Draws every note of the demonstration notebooks with MemorySmith's own component at `4b67c7e` and with the renderer, in two themes and two widths, and compares the images; the first run clones and installs MemorySmith into `playground/compare/.memorysmith` (or uses `MEMORYSMITH_CHECKOUT`), and Chromium needs its system libraries (`npx playwright install --with-deps chromium`); exit 1 on an unexplained difference | 2026-10-15, 132 pairs: 94 identical and 38 deliberate |
| `node scripts/prism-grammars.mjs` | `packages/markdown-renderer/` | Writes `src/prism-grammars.ts`, every grammar the installed `refractor` carries with its aliases, readable name and loader; run when `refractor` is upgraded | 2026-10-15 |
| `node fixtures/make-files.mjs` | `playground/`, with Chromium installed for Playwright | Makes the playground's sixteen sample files into `fixtures/files/` and their attributes into `fixtures/files.json`; MP3, Ogg and QuickTime carry another format's bytes, as their descriptions say | 2026-10-15 |
| `pnpm --filter playground dev` | The root, after `pnpm -r build` | Serves the playground at `http://localhost:5173/`: any note of the notebooks, drawn by the renderer, at `/notes/<slug>/<path>` with `?theme=<name>` (`default`, `sepia`, `docs`, `terminal`), `?scheme=dark`, `?lang=pt`, `?save=slow`, `fail`, `random`, `alert` or `refuse` (with `&delay=<ms>`), `?editable=0`, `?button=label` or `responsive` and `?bare=1`; the switch at the top right of a note edits it, the toolbar's last button shows its Markdown, and `?save=` applies to edits as to ticks, `alert` and `refuse` giving an edit's save the host's notice and its choices, a file attached under a simulated save reporting its parts, and `refuse` refusing it with a reason; what was saved and attached is kept in the browser until the sidebar discards it | 2026-10-15 |

## 7. Before calling something done

- [ ] The issue's "Done when" holds, checked the way a person would use the change, not only by a green suite ([SDLC §12](SDLC.md#12-done-criteria)).
- [ ] `CHANGELOG.md` has the entry under `[Unreleased]`, in the same commit as the change.
- [ ] Every document the change touches is updated in the same commit ([SDLC §4.1](SDLC.md#41-when-a-commit-touches-each-document)).
- [ ] `.gitignore` was assessed for every file or directory created, moved or deleted; no sensitive file is left untracked without an entry.
- [ ] The commit is pushed, and the CI of the branch is green.
- [ ] The issue is closed as `completed`, with a comment naming the commit ([SDLC §5](SDLC.md#5-when-an-issue-closes)).
