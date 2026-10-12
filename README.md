# memorysmithapp-template

The starting point of every new repository of the [`memorysmithapp`](https://github.com/memorysmithapp) organisation. It carries no product code: it carries the documents humans and agents work by — how an agent works here, what the product delivers, how it is organised, how a change travels to a release — so that a new repository starts with its process already written. It is its own first instance: its documents describe this repository, and a new repository rewrites the parts that are its own and keeps the process.

## Create a repository from it

You need a GitHub account with permission to create repositories in the organisation, and, for the command line, the [GitHub CLI](https://cli.github.com/) authenticated (`gh auth login`).

Either press **Use this template → Create a new repository** on this repository's page on GitHub, or run:

```sh
gh repo create memorysmithapp/<name> --template memorysmithapp/memorysmithapp-template --public --clone
```

The new repository receives a copy of these files in one initial commit, and keeps no link to this one: an improvement made here later does not reach it.

## Apply the settings a copy does not carry

A copy carries files, not settings. From the root of the new clone, with `gh` authenticated as an administrator of the new repository and [`jq`](https://jqlang.org/) installed, run once:

```sh
scripts/setup-repo.sh memorysmithapp/<name> "<description>" <topic>[,<topic>...]
```

It sets the description and the topics, allows merge, squash and rebase, turns the wiki and discussions off, and creates the ruleset `main` that protects the default branch: no deletion, no force push, every change through a pull request. It prints what it changed and what was already in place; running it again changes nothing. It stays in the new repository after the adoption: run it again whenever the ruleset or the settings drift, and it puts back only what differs.

## Adopt it in the first session

Open a [Claude Code](https://claude.com/claude-code) session at the root of the new repository. `CLAUDE.md` imports `AGENTS.md`, so the session starts with the instructions loaded. Until the adoption, the check `Quality` fails on the new repository, saying that `CHANGELOG.md` still links to `memorysmithapp-template`; nothing is released there before it. Ask the session to adopt the repository: it follows [`AGENTS.md` §8](AGENTS.md#8-adopting-this-repository), opening an adoption issue and working on the branch `docs/adopt-template`. In one commit it rewrites the identity and the README, empties `PRD.md` and `ARCHITECTURE.md` down to their skeletons while keeping what the process relies on, resets the version and the changelog, and keeps `SDLC.md` and the rules. Then it opens a pull request of its own: review and merge it before any other work, and `main` passes `Quality` from then on.

## Check the documents

With Node 24 and Corepack (`corepack enable`), from the root:

```sh
pnpm run quality   # the checks the workflow Quality runs on every pull request
pnpm test          # their tests
```

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
