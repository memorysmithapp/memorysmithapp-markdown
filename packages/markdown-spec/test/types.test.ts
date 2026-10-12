// The declarations match the data. Every notation of spec.json and every case of conformance.json
// is compiled as a literal against its type, so the check is the compiler's and not a transcription
// of it; and a value the schema refuses is compiled to prove the type refuses it too. A consumer
// project then type-checks against the declarations the build emits.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const PACKAGE = resolve(__dirname, '..');
const TYPES = join(PACKAGE, 'src', 'types.ts');
const specJson = JSON.parse(readFileSync(join(PACKAGE, 'spec.json'), 'utf8'));
const suiteJson = JSON.parse(readFileSync(join(PACKAGE, 'tests', 'conformance.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'markdown-spec-types-'));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  types: [],
};

/** The diagnostics of one file compiled with the given options. */
function diagnostics(file: string, options: ts.CompilerOptions = OPTIONS): string[] {
  const program = ts.createProgram([file], options);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

let counter = 0;
/**
 * Compiles each value as `const value_N: <type> = <literal>` against src/types.ts, in one program,
 * and returns the diagnostics labelled with the name of the value they fall in.
 */
function compileEach(type: string, values: { label: string; value: unknown }[]): string[] {
  const file = join(scratch, `values-${counter++}.ts`);
  const lines = [`import type { ${type} } from ${JSON.stringify(TYPES.replace(/\.ts$/, '.js'))};`];
  const owners: string[] = [];
  for (const { label, value } of values) {
    const body = `export const value_${owners.length}: ${type} = ${JSON.stringify(value)};`;
    owners.push(label);
    lines.push(body);
  }
  writeFileSync(file, lines.join('\n') + '\n');
  const program = ts.createProgram([file], OPTIONS);
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line : 0;
    return `${owners[line - 1] ?? 'import'}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
  });
}

/** Compiles `const value: <type> = <literal>` against src/types.ts. */
function compile(type: string, value: unknown): string[] {
  const file = join(scratch, `value-${counter++}.ts`);
  writeFileSync(
    file,
    `import type { ${type.replace(/\[\]$/, '')} } from ${JSON.stringify(TYPES.replace(/\.ts$/, '.js'))};\n` +
      `export const value: ${type} = ${JSON.stringify(value, null, 2)};\n`,
  );
  return diagnostics(file);
}

describe('the types of spec.json', () => {
  it('admit the whole of spec.json', () => {
    expect(compile('Spec', specJson)).toEqual([]);
  });

  it('admit every notation, one by one', () => {
    const notations = specJson.notations.map((notation: { id: string }) => ({ label: notation.id, value: notation }));
    expect(compileEach('Notation', notations)).toEqual([]);
  });

  it('refuse a reader outside the three the schema allows', () => {
    const schema = JSON.parse(readFileSync(join(PACKAGE, 'schema', 'spec.schema.json'), 'utf8'));
    expect(schema.properties.notations.items.properties.reader.enum).toEqual(['links', 'frontmatter', 'reading-surface']);
    expect(compile('Notation', { ...specJson.notations[0], reader: 'display' })).not.toEqual([]);
  });

  it('refuse a notation missing a required field', () => {
    const { effect: _effect, ...partial } = specJson.notations[0];
    expect(compile('Notation', partial)).not.toEqual([]);
  });

  it('refuse a property the schema does not declare', () => {
    expect(compile('Notation', { ...specJson.notations[0], recognised: false })).not.toEqual([]);
    expect(compile('Spec', { ...specJson, version: '0.1.0' })).not.toEqual([]);
  });
});

describe('the types of a conformance case', () => {
  it('admit the whole suite', () => {
    expect(compile('ConformanceSuite', suiteJson)).toEqual([]);
  });

  it('admit every case, one by one', () => {
    const all = suiteJson.cases.map((testCase: { id: string }) => ({ label: testCase.id, value: testCase }));
    expect(compileEach('ConformanceCase', all)).toEqual([]);
  });

  it('refuse a resolution without a notebook, and a notebook without a resolution', () => {
    const resolved = suiteJson.cases.find((c: { resolution?: unknown }) => c.resolution);
    expect(resolved).toBeDefined();
    const { notebook: _notebook, ...withoutNotebook } = resolved;
    const { resolution: _resolution, ...withoutResolution } = resolved;
    expect(compile('ConformanceCase', withoutNotebook)).not.toEqual([]);
    expect(compile('ConformanceCase', withoutResolution)).not.toEqual([]);
  });

  it('refuse a resolution kind outside note, attachment and pending', () => {
    const resolved = suiteJson.cases.find((c: { resolution?: unknown }) => c.resolution);
    expect(compile('ConformanceCase', { ...resolved, resolution: [{ target: 'x', kind: 'file', edges: 0 }] })).not.toEqual([]);
  });

  it('read an empty expectation as a claim, and an absent one as none', () => {
    expect(compile('ConformanceCase', { id: 'x', notation: 'wikilink', markdown: 'x', links: [] })).toEqual([]);
    expect(compile('ConformanceCase', { id: 'x', notation: 'wikilink', markdown: 'x', facets: {} })).toEqual([]);
    expect(compile('ConformanceCase', { id: 'x', notation: 'wikilink', markdown: 'x', name: null })).toEqual([]);
  });
});

describe('a consumer project', () => {
  it('type-checks against the declarations the build emits', () => {
    expect(existsSync(join(PACKAGE, 'dist', 'index.d.ts')), 'run `pnpm -r build` first').toBe(true);
    const project = join(scratch, 'consumer');
    mkdirSync(join(project, 'node_modules', '@memorysmithapp'), { recursive: true });
    symlinkSync(PACKAGE, join(project, 'node_modules', '@memorysmithapp', 'markdown-spec'), 'dir');
    const file = join(project, 'consumer.ts');
    writeFileSync(
      file,
      [
        "import { spec, cases, type Notation, type NotationReader } from '@memorysmithapp/markdown-spec';",
        'const readers: NotationReader[] = spec.notations.map((notation: Notation) => notation.reader);',
        "const surface: number = readers.filter((reader) => reader === 'reading-surface').length;",
        'const firstLink: string | undefined = cases.find((c) => c.links)?.links?.[0]?.name;',
        "// @ts-expect-error: a reader the specification does not have",
        "const wrong: NotationReader = 'display';",
        'export { surface, firstLink, wrong };',
      ].join('\n'),
    );
    expect(diagnostics(file, { ...OPTIONS, noUncheckedIndexedAccess: true })).toEqual([]);
  });
});
