#!/usr/bin/env node
// What each published package ships, checked against what it is meant to ship: `npm pack
// --dry-run` lists the files, and the list has to be exactly the built modules of `src/` (a `.js`
// and a `.d.ts` each, no test, no source map) and the files named below. Run after the build.
//   node scripts/pack-check.mjs

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedPackages } from './publish.mjs';

/** The files a package ships beside its built modules. */
export const SHIPPED = {
  '@memorysmithapp/markdown-spec': ['LICENSE', 'README.md', 'SPEC.md', 'package.json', 'schema/spec.schema.json', 'spec.json', 'tests/README.md', 'tests/conformance.json', 'tools/check-spec.mjs'],
  '@memorysmithapp/markdown-renderer': ['LICENSE', 'README.md', 'package.json', 'styles.css', 'structure.css', 'theme-default.css'],
};

/** The built modules of a package's `src/`: a module and its declarations, for every source but the tests. */
export function builtModules(sources) {
  return sources
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts'))
    .flatMap((name) => {
      const base = name.replace(/\.tsx?$/, '');
      return [`dist/${base}.d.ts`, `dist/${base}.js`];
    });
}

/** What differs between the files packed and the files meant to ship. */
export function checkPack(name, packed, expected) {
  const missing = expected.filter((file) => !packed.includes(file));
  const extra = packed.filter((file) => !expected.includes(file));
  return [
    ...missing.map((file) => `${name}: ${file} is meant to ship and is not packed`),
    ...extra.map((file) => `${name}: ${file} is packed and is not meant to ship`),
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve('.');
  const problems = [];
  for (const pkg of publishedPackages(root)) {
    const dir = join(root, pkg.dir);
    const listing = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const packed = listing[0].files.map((file) => file.path).sort();
    const expected = [...builtModules(readdirSync(join(dir, 'src'))), ...(SHIPPED[pkg.name] ?? [])].sort();
    const found = checkPack(pkg.name, packed, expected);
    problems.push(...found);
    console.log(`${found.length === 0 ? 'ok  ' : 'FAIL'} ${pkg.name}: ${packed.length} files`);
  }
  for (const problem of problems) console.log(`       ${problem}`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
