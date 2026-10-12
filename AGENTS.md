# AGENTS.md

How an agent works in this repository. `CLAUDE.md` imports this file, so it is loaded whole in every session and every sub-agent: it stays short and points at sections of the other documents instead of repeating them.

Every section says what a repository created from this one does with it on adoption ([§8](#8-adopting-this-repository)): **kept** as it is, or **rewritten** for the new project.

## 1. Identity

*Rewritten on adoption.*

- **Name:** `memorysmithapp-template`, always by its full name: in MemorySmith, *Template* is a term of the product (the shape of the notes of a folder).
- **Purpose:** the starting point of every new repository of the organisation, carrying the documents and repository configuration humans and agents work by.
- **Organisation:** [`memorysmithapp`](https://github.com/memorysmithapp).
- **Licence:** MIT, public repository.
- **Version:** the `version` field of the root `package.json`, and nowhere else.

## 2. Reading map

*Kept on adoption.*

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

*Kept on adoption.*

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

*Kept on adoption.*

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

*Kept on adoption.*

- **INV-01** The version has exactly one home, the root `package.json`, and `CHANGELOG.md` agrees with it; RN-VER-001 ([mechanism](ARCHITECTURE.md#inv-01-the-version-has-one-home)).
- **INV-02** `CLAUDE.md` is exactly `@AGENTS.md` and nothing else; RN-DOC-002 ([mechanism](ARCHITECTURE.md#inv-02-claudemd-is-only-the-import)).
- **INV-03** `main` changes only through a pull request; RN-REP-001 ([mechanism](ARCHITECTURE.md#inv-03-main-changes-only-through-a-pull-request)).
- **INV-04** Only the release workflow writes a tag, and a version names one commit; RN-VER-003, RN-VER-004 ([mechanism](ARCHITECTURE.md#inv-04-only-the-release-workflow-writes-a-tag)).
- **INV-05** The documents keep their form: the changelog's format, links and anchors that resolve, no version footers; RN-REP-003 ([mechanism](ARCHITECTURE.md#inv-05-the-documents-keep-their-form)).

## 6. Verified commands

*Kept on adoption.*

Each command with the directory it runs in, what it does, and the date somebody last ran it and saw it work. A command nobody ran is never listed.

| Command | Run in | What it does | Last verified |
|---|---|---|---|
| `scripts/setup-repo.sh <owner>/<repo> "<description>" <topic>[,<topic>...]` | The root | Applies the description, topics, merge options, wiki and discussions off, and the ruleset `main`; idempotent | 2026-10-12, against a throwaway repository |
| `pnpm run quality` | The root | Runs the checks of the workflow *Quality* ([SDLC §8](SDLC.md#8-tests-and-review)); exit 1 and the failing lines when one fails | 2026-10-12 |
| `pnpm test` | The root | Runs the tests of the checks, each against a deliberate violation | 2026-10-12 |

## 7. Before calling something done

*Kept on adoption.*

- [ ] The issue's "Done when" holds, checked the way a person would use the change, not only by a green suite ([SDLC §12](SDLC.md#12-done-criteria)).
- [ ] `CHANGELOG.md` has the entry under `[Unreleased]`, in the same commit as the change.
- [ ] Every document the change touches is updated in the same commit ([SDLC §4.1](SDLC.md#41-when-a-commit-touches-each-document)).
- [ ] `.gitignore` was assessed for every file or directory created, moved or deleted; no sensitive file is left untracked without an entry.
- [ ] The commit is pushed, and the CI of the branch is green.
- [ ] The issue is closed as `completed`, with a comment naming the commit ([SDLC §5](SDLC.md#5-when-an-issue-closes)).

## 8. Adopting this repository

*Kept in `memorysmithapp-template`; deleted from a repository once it is adopted.*

A repository created from `memorysmithapp-template` holds a copy of these files and nothing else. Its first session adopts it as one piece of work under `SDLC.md`, and the owner asking for the adoption is the go-ahead ([§4](#4-limits)):

- it opens the issue *Adopt memorysmithapp-template* in the milestone `v0.1.0`, creating the milestone if it is missing;
- it works on the branch `docs/adopt-template`, in one commit that references the issue, and closes the issue naming the commit ([SDLC §5](SDLC.md#5-when-an-issue-closes));
- it opens a pull request of its own ([SDLC §6](SDLC.md#6-pull-request)), which the owner reviews and merges before any other work, so the new repository's `main` passes `Quality` from then on;
- it cuts no version: the adoption is governance, and its entry waits in `[Unreleased]` for the project's first cut ([SDLC §9](SDLC.md#9-versioning)).

The commit does what follows. Followed as written, the result passes `Quality`, and no kept text points at something the adoption removed.

1. **Identity:** rewrite §1 of this file for the new project, and `README.md` whole: what the project is, how to start, the command of `scripts/setup-repo.sh` with the description and topics the owner used, and the documents it has. Set `name` (under the `@memorysmithapp` scope), `description` and `repository` in `package.json`. Ask the owner what the repository does not say, such as its visibility.
2. **Skeletons:** `PRD.md` and `ARCHITECTURE.md` keep their title, their opening sentence saying what the document answers (rewritten for the new repository), the paragraph on the status of claims, and each heading with the *Instruction* line under it. `PRD.md` §7 also keeps its rule on codes (append-only, never reused), without this repository's areas; its codes start again from `001`. `ARCHITECTURE.md` also keeps the description of every part the adoption keeps, so it starts true and incomplete, not empty:
   - §1: the overview lines of the kept parts: documents, repository files, the setup script, the two workflows, the GitHub configuration;
   - §2: the row of every file the adoption keeps, updated for the new repository (its package name; `AGENTS.md` without this section);
   - §3: the subsections INV-01 to INV-05, headings unchanged since §5 of this file links to them; a mechanism is rewritten only where the new repository differs, such as the id of its ruleset;
   - §4: the GitHub integration (rulesets and settings, issues and milestones, Actions), without the item on template repositories, and the npm paragraph, a fact of the organisation that `SDLC.md` §10 points at;
   - §5: what the workflows *Quality* and *Release* do, and how `scripts/setup-repo.sh` runs;
   - §6: its format paragraph, and no record.
3. **The template's history:** remove from every kept text the citations of `memorysmithapp-template`'s RN codes, ADRs and issue numbers. They name its rules, records and issues: in the new repository an ADR link would not resolve, and `#N` would name an unrelated issue. The sentence stays; only the citation goes. A claim marked *observed* or *declared* about this repository becomes **To confirm** until it is verified in the new one; the adopting session may verify it there and mark it *observed*. A fact of the organisation, such as the npm plan, keeps its status.
4. **Markers:** remove every paragraph that marks a section as kept or rewritten, or says what the adoption does to a document, the one at the top of this file included: in a repository that is not a template they describe nothing. Each such marker stands in a paragraph of its own. The *Instruction* lines stay until their sections are filled.
5. **Version:** reset `version` in `package.json` to `0.1.0`, and `CHANGELOG.md` to an `[Unreleased]` whose only entry, under `Changed`, records the adoption, with its foot link pointing at the new repository's `commits/main`: the workflow *Release* publishes only where the foot links name the repository, and `Quality` fails until they do.
6. **Kept:** `SDLC.md` (but for step 4), `CLAUDE.md`, `LICENSE`, `.gitignore`, `.editorconfig`, `pnpm-lock.yaml`, §2–§7 of this file, `.github/workflows/`, `scripts/setup-repo.sh` (the mechanism of INV-03, run again whenever the ruleset drifts), `scripts/quality.mjs`, `scripts/release.mjs`, `scripts/lib/` and their tests. §6 keeps the commands run in the new repository, with that date; the owner's run of `scripts/setup-repo.sh` counts, with the date the owner gives.
7. **Deleted:** this section.

Then the owner fills `PRD.md` and `ARCHITECTURE.md` with the project, issue by issue.
