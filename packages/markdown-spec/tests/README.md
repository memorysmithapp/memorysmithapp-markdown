# The conformance suite

The executable half. A specification is a claim; this is the part that can be checked.

## The format

`conformance.json` holds an array of cases. Each case is one Markdown input and what a conforming implementation derives from it.

```json
{
  "id": "wikilink/anchor-is-kept-and-not-resolved",
  "notation": "wikilink-anchor",
  "markdown": "See [[Lei 14.133#Article 75]] for the exception.",
  "links": [{ "name": "Lei 14.133", "anchor": "Article 75" }]
}
```

| Field | Meaning |
|---|---|
| `id` | Stable identifier of the case. Never renamed, never reused |
| `notation` | The `id` of the entry in `spec.json` this case exercises |
| `markdown` | The input, verbatim, including the frontmatter when there is one |
| `name` | The name the note carries, which is the key a link resolves against (`SPEC.md` §5.3). `null` says the note has no name. Absent means the case makes no claim about it |
| `links` | The edges a conforming Indexer produces, in any order, each as the `name` it addresses and its `anchor`. Absent means the case makes no claim about links |
| `facets` | The attributes a conforming Indexer produces, as `name → { kind, values }`. Absent means the case makes no claim about attributes |
| `notebook` | The notes, attachments and tables that exist while this case runs: `notes` is a list of whole Markdown documents, `attachments` a list of names, and `tables` a list of tables, each a `name` and its `columns`, each column a `name` and a `kind` (`text`, `number`, `date`, `boolean` or `list`, `SPEC.md` §5.9). A table carries no rows: what a case claims about one depends on its name and its columns alone. Absent means the case makes no claim that depends on a notebook |
| `resolution` | What each target resolves to once the notebook is there: `target`, `kind` (`note`, `attachment`, `table` or `pending`) and `edges`. Requires `notebook`, and `notebook` requires it |
| `parameters` | The parameters the input references (`SPEC.md` §7.14), in its body and its frontmatter: each name once, normalised to NFC, in any order. A reference inside code, mathematics, a destination, an autolink or raw HTML, or one escaped, is not listed. Absent means the case makes no claim about parameters |
| `tables` | The tables the input references (`SPEC.md` §5.9): the `table` key of each `table` block, trimmed and normalised to NFC, each table once. A block inside another code block, or one with no `table` key or two, is not listed. Absent means the case makes no claim about tables |
| `notices` | Every notice the input raises (`SPEC.md` §7.13), hints included, each as its `code` and the `line` it starts on, counted from 1 over the whole document. Compared as a multiset, in any order. The two pending codes are raised against the case's `notebook`. Absent means the case makes no claim about notices |

An expectation of `[]` or `{}` is a claim, and a strong one: it says the input produces **nothing**. Those cases carry as much of the specification as the positive ones, because the failure they prevent — a notation that quietly does nothing while somebody believes in it — is the failure a specification exists to prevent.

## Running it

The suite is data, not code: it carries no runner, so that an implementation in any language can consume it. An implementation feeds each `markdown` to its own extractors and compares the result.

Rules a runner has to follow:

- **Order does not matter** in `links`; identity does. Compare as sets keyed by `name`, after normalising both sides to NFC. The same holds for `parameters`, compared as a set of names, and for `tables`, compared with case folded as well.
- **A missing field is not an empty expectation.** A case with no `facets` key says nothing about attributes; a case with `"facets": {}` says there are none.
- **A fixture note carries a document, never a declared name.** The name is read from it by
  `SPEC.md` §5.3, which is the rule these cases exist to exercise — a fixture that announced
  its own name outside the document would let a runner skip it. A fixture whose document
  opens with a frontmatter stating `name:` or `aliases:` is not announcing anything: it is
  the input, and reading it is the rule under test. A fixture whose document only opens with
  a heading has no name, and that is under test too.
- **`resolution` is not `links`.** `links` is what one note *extracts*, and holds with no notebook
  at all; `resolution` is what those targets *become* once other notes and attachments exist.
  Only a note produces an edge, one per note that matches — by name, or, when no name
  matched the target, by alias (§5.2, step 8). An attachment produces none, nor does a table, which
  only a `table` block reaches (§5.9), and a target that matches nothing is `pending` and produces
  none.
- **Every case must run.** Skipping a case is a conformance failure, not a local decision.

## Coverage

Every entry of `spec.json` whose `reader` is `links` or `frontmatter` has at least one case here, and so does every notice `spec.json` declares. Entries whose reader is `reading-surface` are rendering, and are verified by the implementation against its own renderer: what a callout looks like is not something a JSON file can assert.
