#!/usr/bin/env node
// The consistency check of the specification.
//
// A notation lives in three files at once — the document `SPEC.md`, `spec.json` and
// `tests/conformance.json` — and the failure it exists to prevent is the three of them
// drifting apart in silence. This is what refuses that. It is part of the `test` script of
// its package, so it runs wherever the suites of the repository run, with no dependencies,
// no build and no network.
//
// The three live in one package, which is what makes "the three move together" obvious; this
// is still what carries that rule: the document is read beside the data, and a document that
// is not there fails the build instead of being skipped.
//
// It checks the package folder it is given as its argument, or its own package by default,
// so that its tests can run it against a copy carrying a deliberate defect.
//
// It validates spec.json against schema/spec.schema.json with a validator that
// implements only the keywords the schema actually uses, and that FAILS on any keyword it
// does not implement. A validator that ignores what it does not understand is worse than
// no validator, because it reports success it did not establish.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
/** The document of the specification, which lives beside the data. */
const documentPath = join(root, 'SPEC.md');
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const readJson = (relative) => {
  const text = readFileSync(join(root, relative), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(relative, `is not valid JSON — ${error.message}`);
    return null;
  }
};

const schema = readJson('schema/spec.schema.json');
const spec = readJson('spec.json');
const conformance = readJson('tests/conformance.json');
let specText = '';
try {
  specText = readFileSync(documentPath, 'utf8');
} catch {
  fail('SPEC.md', 'is missing: the document and the data move together');
  report();
}

if (!schema || !spec || !conformance) {
  report();
}

// ---------------------------------------------------------------------------
// A JSON Schema validator for the subset this repository uses.
// ---------------------------------------------------------------------------

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'examples']);
const IMPLEMENTED = new Set([
  'type',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'enum',
  'pattern',
  'format',
  'propertyNames',
]);

const typeOf = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

function validate(value, node, path) {
  for (const keyword of Object.keys(node)) {
    if (!ANNOTATIONS.has(keyword) && !IMPLEMENTED.has(keyword)) {
      fail(
        'schema/spec.schema.json',
        `uses the keyword "${keyword}", which this checker does not implement. Implement it in tools/check-spec.mjs or drop it from the schema`,
      );
    }
  }

  if (node.type) {
    const actual = typeOf(value);
    const expected = node.type === 'number' && actual === 'integer' ? 'number' : actual;
    if (expected !== node.type) {
      fail(path, `should be ${node.type} and is ${actual}`);
      return;
    }
  }

  if (node.enum && !node.enum.includes(value)) {
    fail(path, `is "${value}", which is not one of ${node.enum.map((v) => `"${v}"`).join(', ')}`);
  }

  if (node.pattern && typeof value === 'string' && !new RegExp(node.pattern).test(value)) {
    fail(path, `is "${value}", which does not match ${node.pattern}`);
  }

  if (node.format === 'uri' && typeof value === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    fail(path, `is "${value}", which is not an absolute URI`);
  }

  if (typeOf(value) === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in value)) fail(path, `is missing the required property "${key}"`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = node.properties?.[key];
      if (childSchema) {
        validate(child, childSchema, `${path}.${key}`);
      } else if (node.additionalProperties === false) {
        fail(path, `carries "${key}", which the schema does not declare`);
      }
    }
  }

  if (typeOf(value) === 'array') {
    if (node.minItems !== undefined && value.length < node.minItems) {
      fail(path, `holds ${value.length} items and the schema requires at least ${node.minItems}`);
    }
    if (node.items) {
      value.forEach((item, index) => validate(item, node.items, `${path}[${index}]`));
    }
  }
}

validate(spec, schema, 'spec.json');

// ---------------------------------------------------------------------------
// The three files have to agree.
// ---------------------------------------------------------------------------

const notations = spec.notations ?? [];
const notices = spec.notices ?? [];
const cases = conformance.cases ?? [];

// A notice is a code an implementation reports under (§7.13): stable, declared once, and raised
// by at least one case, or nothing proves two implementations mean the same thing by it.
const declaredNotices = new Set();
for (const notice of notices) {
  if (declaredNotices.has(notice.code)) fail('spec.json', `declares the notice "${notice.code}" twice`);
  declaredNotices.add(notice.code);
}

// Identifiers are stable: never renamed, never reused. Duplicates break that promise
// before anybody has a chance to rely on it.
const seenNotations = new Set();
for (const entry of notations) {
  if (seenNotations.has(entry.id)) fail('spec.json', `declares the notation "${entry.id}" twice`);
  seenNotations.add(entry.id);
}

const KINDS = new Set(['note', 'attachment', 'pending']);

/** The name of a parameter (§7.14): a letter or `_`, then letters, marks, digits, `_` and `-`. */
const PARAMETER_NAME = /^[\p{L}_][\p{L}\p{M}\p{N}_-]*$/u;

const seenCases = new Set();
for (const testCase of cases) {
  if (seenCases.has(testCase.id))
    fail('tests/conformance.json', `declares the case "${testCase.id}" twice`);
  seenCases.add(testCase.id);

  if (!testCase.notation) {
    fail('tests/conformance.json', `the case "${testCase.id}" names no notation`);
  } else if (!seenNotations.has(testCase.notation)) {
    fail(
      'tests/conformance.json',
      `the case "${testCase.id}" exercises "${testCase.notation}", which spec.json does not declare`,
    );
  }
  if (typeof testCase.markdown !== 'string') {
    fail('tests/conformance.json', `the case "${testCase.id}" carries no markdown input`);
  }
  if (
    !('links' in testCase) &&
    !('facets' in testCase) &&
    !('name' in testCase) &&
    !('resolution' in testCase) &&
    !('notices' in testCase) &&
    !('parameters' in testCase)
  ) {
    fail(
      'tests/conformance.json',
      `the case "${testCase.id}" claims neither a name, nor links, nor facets, nor a resolution, nor notices, nor parameters, so it asserts nothing`,
    );
  }

  // A parameter is a name (§7.14), written as a reader compares it: in NFC, and once.
  if ('parameters' in testCase) {
    const parameters = testCase.parameters;
    if (!Array.isArray(parameters) || parameters.some((name) => typeof name !== 'string')) {
      fail('tests/conformance.json', `the case "${testCase.id}" has "parameters" that is not a list of names`);
    } else {
      for (const name of parameters) {
        if (!PARAMETER_NAME.test(name)) {
          fail('tests/conformance.json', `the case "${testCase.id}" lists the parameter "${name}", which is not a name`);
        } else if (name !== name.normalize('NFC')) {
          fail('tests/conformance.json', `the case "${testCase.id}" lists the parameter "${name}" in a form other than NFC`);
        }
      }
      if (new Set(parameters).size !== parameters.length) {
        fail('tests/conformance.json', `the case "${testCase.id}" lists a parameter twice`);
      }
    }
  }

  for (const notice of testCase.notices ?? []) {
    if (!declaredNotices.has(notice.code)) {
      fail(
        'tests/conformance.json',
        `the case "${testCase.id}" raises the notice "${notice.code}", which spec.json does not declare`,
      );
    }
    if (!Number.isInteger(notice.line) || notice.line < 1) {
      fail('tests/conformance.json', `the case "${testCase.id}" places the notice "${notice.code}" on a line that is not a whole number from 1`);
    }
  }

  // A resolution is a claim about a notebook, and a notebook is only there to be resolved
  // against. One without the other is half a case, and the half that is missing is the
  // one that would have made it fail.
  const hasNotebook = 'notebook' in testCase;
  const hasResolution = 'resolution' in testCase;
  if (hasNotebook !== hasResolution) {
    fail(
      'tests/conformance.json',
      hasNotebook
        ? `the case "${testCase.id}" builds a notebook and claims no resolution against it`
        : `the case "${testCase.id}" claims a resolution and gives no notebook to resolve against`,
    );
  }

  if (hasNotebook) {
    const notebook = testCase.notebook ?? {};
    const notes = notebook.notes ?? [];
    const attachments = notebook.attachments ?? [];
    if (!Array.isArray(notes) || notes.some((note) => typeof note !== 'string')) {
      fail(
        'tests/conformance.json',
        `the case "${testCase.id}" has a notebook whose "notes" is not a list of Markdown documents`,
      );
    }
    if (!Array.isArray(attachments) || attachments.some((name) => typeof name !== 'string')) {
      fail(
        'tests/conformance.json',
        `the case "${testCase.id}" has a notebook whose "attachments" is not a list of names`,
      );
    }
    if (notes.length === 0 && attachments.length === 0) {
      fail(
        'tests/conformance.json',
        `the case "${testCase.id}" has an empty notebook, which resolves nothing`,
      );
    }
  }

  for (const outcome of testCase.resolution ?? []) {
    const where = `the case "${testCase.id}"`;
    if (typeof outcome.target !== 'string') {
      fail('tests/conformance.json', `${where} has a resolution with no target`);
      continue;
    }
    if (!KINDS.has(outcome.kind)) {
      fail(
        'tests/conformance.json',
        `${where} resolves "${outcome.target}" to the kind "${outcome.kind}", which is not one of ${[...KINDS].join(', ')}`,
      );
    }
    if (!Number.isInteger(outcome.edges) || outcome.edges < 0) {
      fail(
        'tests/conformance.json',
        `${where} resolves "${outcome.target}" to an edge count that is not a whole number`,
      );
      continue;
    }
    // The specification § 5.4, 5.5 and 5.8: only a note produces an edge, and a note that matches
    // produces one per match.
    if (outcome.kind !== 'note' && outcome.edges !== 0) {
      fail(
        'tests/conformance.json',
        `${where} resolves "${outcome.target}" to the kind ${outcome.kind} and to ${outcome.edges} edges. Only a note produces an edge`,
      );
    }
    if (outcome.kind === 'note' && outcome.edges < 1) {
      fail(
        'tests/conformance.json',
        `${where} resolves "${outcome.target}" to a note and to no edge`,
      );
    }
  }
}

// Every notation an indexer decides needs a case. The ones whose reader is
// reading-surface are rendering, and what a callout looks like is not something a JSON
// file can assert — that is the one exception, and the renderer's own suite proves those.
const exercised = new Set(cases.map((testCase) => testCase.notation));
for (const entry of notations) {
  if (entry.reader !== 'reading-surface' && !exercised.has(entry.id)) {
    fail(
      'tests/conformance.json',
      `has no case for "${entry.id}". A notation without a case is not part of the specification`,
    );
  }
}

const raised = new Set(cases.flatMap((testCase) => (testCase.notices ?? []).map((notice) => notice.code)));
for (const notice of notices) {
  if (!raised.has(notice.code)) {
    fail('tests/conformance.json', `has no case raising the notice "${notice.code}". A notice without a case is not part of the specification`);
  }
}

// ---------------------------------------------------------------------------
// Every section reference resolves to a real heading of the document.
// ---------------------------------------------------------------------------

const headings = new Set(
  [...specText.matchAll(/^#{2,6}\s+([0-9]+(?:\.[0-9]+)*)\.?\s/gm)].map((match) => match[1]),
);

for (const entry of notations) {
  if (!entry.spec) continue;
  for (const section of entry.spec.split(',').map((value) => value.trim())) {
    if (!headings.has(section)) {
      fail(
        'spec.json',
        `the notation "${entry.id}" points at the specification § ${section}, which has no heading`,
      );
    }
  }
}

// The table of §7.13 and the notices of spec.json are the same list, row for row.
const documented = new Map(
  [...specText.matchAll(/^\| `([a-z0-9-]+)` \| (notice|hint) \| §([0-9.]+) \|/gm)].map((match) => [match[1], { severity: match[2], spec: match[3] }]),
);
for (const notice of notices) {
  if (!headings.has(notice.spec)) {
    fail('spec.json', `the notice "${notice.code}" points at the specification § ${notice.spec}, which has no heading`);
  }
  const row = documented.get(notice.code);
  if (!row) {
    fail('SPEC.md', `does not list the notice "${notice.code}" that spec.json declares`);
  } else if (row.severity !== notice.severity || row.spec !== notice.spec) {
    fail('SPEC.md', `lists the notice "${notice.code}" as ${row.severity} under § ${row.spec}, and spec.json as ${notice.severity} under § ${notice.spec}`);
  }
}
for (const code of documented.keys()) {
  if (!declaredNotices.has(code)) fail('spec.json', `does not declare the notice "${code}" that SPEC.md lists`);
}

// The document points at itself constantly — a form is stated where an author meets it and
// again in the section that governs it — and a renumbering is what breaks all of those at
// once. Every § in the prose has to resolve too.
const danglingRefs = new Set();
for (const match of specText.matchAll(/§(\d+(?:\.\d+)*)/g)) {
  if (!headings.has(match[1])) danglingRefs.add(match[1]);
}
for (const section of [...danglingRefs].sort()) {
  fail('SPEC.md', `refers to § ${section}, which has no heading`);
}

// ---------------------------------------------------------------------------
// One name, in both data files, and the address of the text they implement.
//
// There is no version to mirror. The specification follows the version of the repository that
// carries it, and a number written in the document would be one more place to forget: a version
// was once released with the header of the document still saying the one before. The one place
// the version does appear is the `url` of spec.json, because a published package has to name the
// text it implements, and `main` moves: it names SPEC.md at the tag of the package's version, and
// this is what keeps the two from drifting.
// ---------------------------------------------------------------------------

if (conformance.spec !== spec.spec) {
  fail(
    'tests/conformance.json',
    `names the specification "${conformance.spec}" and spec.json names it "${spec.spec}"`,
  );
}

let version = null;
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {
  fail('package.json', 'is missing or not valid JSON, so the version the url must name is unknown');
}
if (version) {
  const expected = `https://github.com/memorysmithapp/memorysmithapp-markdown/blob/v${version}/packages/markdown-spec/SPEC.md`;
  if (spec.url !== expected) {
    fail('spec.json', `has the url "${spec.url}", which does not name SPEC.md at the tag of the version ${version}: ${expected}`);
  }
}

report();

function report() {
  if (errors.length === 0) {
    const surface = notations.filter((entry) => entry.reader === 'reading-surface').length;
    console.log(
      `The specification is consistent: ${notations.length} notations (${notations.length - surface} an indexer decides, ${surface} rendering), ${notices.length} notices, ${cases.length} conformance cases.`,
    );
    process.exit(0);
  }
  console.error(
    `The specification is inconsistent. ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`,
  );
  for (const error of errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}
