# @memorysmithapp/markdown-spec

The MemorySmith Markdown Specification — the notation MemorySmith notebooks are written in — as a document, as data and as a conformance suite.

| Path | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | The specification, the text an implementation is written against |
| [`spec.json`](spec.json) | Every notation as data: its identifier, which reader decides it, the syntax, an example and the observable effect; and every notice an implementation may report about a note (§7.13), with its severity |
| [`schema/spec.schema.json`](schema/spec.schema.json) | The JSON Schema of `spec.json` |
| [`tests/conformance.json`](tests/conformance.json) | The conformance suite: a Markdown input and what a conforming indexer derives from it, the parameters it references, or the notices it raises; [`tests/README.md`](tests/README.md) says how to run it |
| [`tools/check-spec.mjs`](tools/check-spec.mjs) | The checker that keeps the document, the data and the suite together |

The specification has no version of its own: it is the version of this package, and the `url` of `spec.json` names `SPEC.md` at that version's tag.

## Use

```sh
npm install @memorysmithapp/markdown-spec
```

```ts
import { spec, cases, type Notation } from '@memorysmithapp/markdown-spec';

const drawn: Notation[] = spec.notations.filter((notation) => notation.reader === 'reading-surface');
```

The raw files are exported too: `@memorysmithapp/markdown-spec/spec.json`, `/conformance.json`, `/schema.json` and `/SPEC.md`.

## Licence

The text of the specification — `SPEC.md` and the prose of `tests/README.md` — is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The data, the suite and the checker are [MIT](LICENSE).
