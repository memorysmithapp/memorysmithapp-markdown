/**
 * Writes `src/prism-grammars.ts`: every grammar the installed `refractor` carries — Prism's, as a
 * hast tree — with its identifier, its aliases, a name a person reads, and the dynamic import that
 * loads it (#84). Run it when `refractor` is upgraded:
 *
 *   node scripts/prism-grammars.mjs        (in packages/markdown-renderer)
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const lang = join(dirname(require.resolve('refractor/core')), '..', 'lang');
const version = JSON.parse(readFileSync(join(lang, '..', 'package.json'), 'utf8')).version;

/** What Prism calls each language, where its identifier is not what a person reads. */
const TITLES = {
  abap: 'ABAP', abnf: 'ABNF', actionscript: 'ActionScript', ada: 'Ada', agda: 'Agda', al: 'AL', antlr4: 'ANTLR4',
  apacheconf: 'Apache Configuration', apex: 'Apex', apl: 'APL', applescript: 'AppleScript', aql: 'AQL', arduino: 'Arduino',
  arff: 'ARFF', armasm: 'ARM Assembly', arturo: 'Arturo', asciidoc: 'AsciiDoc', asm6502: '6502 Assembly',
  asmatmel: 'Atmel AVR Assembly', aspnet: 'ASP.NET (C#)', autohotkey: 'AutoHotkey', autoit: 'AutoIt', avisynth: 'AviSynth',
  'avro-idl': 'Avro IDL', awk: 'AWK', bash: 'Bash', basic: 'BASIC', batch: 'Batch', bbcode: 'BBcode', bbj: 'BBj', bicep: 'Bicep',
  birb: 'Birb', bison: 'Bison', bnf: 'BNF', bqn: 'BQN', brainfuck: 'Brainfuck', brightscript: 'BrightScript', bro: 'Bro',
  bsl: 'BSL (1C:Enterprise)', c: 'C', cfscript: 'CFScript', chaiscript: 'ChaiScript', cil: 'CIL', cilkc: 'Cilk/C',
  cilkcpp: 'Cilk/C++', clojure: 'Clojure', cmake: 'CMake', cobol: 'COBOL', coffeescript: 'CoffeeScript', concurnas: 'Concurnas',
  cooklang: 'Cooklang', coq: 'Coq', cpp: 'C++', crystal: 'Crystal', csharp: 'C#', cshtml: 'Razor C#', csp: 'Content-Security-Policy',
  css: 'CSS', csv: 'CSV', cue: 'CUE', cypher: 'Cypher', d: 'D', dart: 'Dart', dataweave: 'DataWeave', dax: 'DAX', dhall: 'Dhall',
  diff: 'Diff', django: 'Django/Jinja2', 'dns-zone-file': 'DNS zone file', docker: 'Docker', dot: 'DOT (Graphviz)', ebnf: 'EBNF',
  editorconfig: 'EditorConfig', eiffel: 'Eiffel', ejs: 'EJS', elixir: 'Elixir', elm: 'Elm', erb: 'ERB', erlang: 'Erlang',
  etlua: 'Embedded Lua templating', 'excel-formula': 'Excel Formula', factor: 'Factor', false: 'False',
  'firestore-security-rules': 'Firestore security rules', flow: 'Flow', fortran: 'Fortran', fsharp: 'F#',
  ftl: 'FreeMarker Template Language', gap: 'GAP (CAS)', gcode: 'G-code', gdscript: 'GDScript', gedcom: 'GEDCOM',
  gettext: 'gettext', gherkin: 'Gherkin', git: 'Git', glsl: 'GLSL', gml: 'GameMaker Language', gn: 'GN', go: 'Go',
  'go-module': 'Go module', gradle: 'Gradle', graphql: 'GraphQL', groovy: 'Groovy', haml: 'Haml', handlebars: 'Handlebars',
  haskell: 'Haskell', haxe: 'Haxe', hcl: 'HCL', hlsl: 'HLSL', hoon: 'Hoon', hpkp: 'HTTP Public-Key-Pins',
  hsts: 'HTTP Strict-Transport-Security', http: 'HTTP', ichigojam: 'IchigoJam', icon: 'Icon', 'icu-message-format': 'ICU Message Format',
  idris: 'Idris', iecst: 'Structured Text (IEC 61131-3)', ignore: '.ignore', inform7: 'Inform 7', ini: 'INI', io: 'Io', j: 'J',
  java: 'Java', javadoc: 'JavaDoc', javascript: 'JavaScript', javastacktrace: 'Java stack trace', jexl: 'Jexl', jolie: 'Jolie',
  jq: 'JQ', jsdoc: 'JSDoc', json: 'JSON', json5: 'JSON5', jsonp: 'JSONP', jsstacktrace: 'JS stack trace', jsx: 'JSX', julia: 'Julia',
  keepalived: 'Keepalived Configure', keyman: 'Keyman', kotlin: 'Kotlin', kumir: 'KuMir', kusto: 'Kusto', latex: 'LaTeX',
  latte: 'Latte', less: 'Less', lilypond: 'LilyPond', 'linker-script': 'Linker script', liquid: 'Liquid', lisp: 'Lisp',
  livescript: 'LiveScript', llvm: 'LLVM IR', log: 'Log file', lolcode: 'LOLCODE', lua: 'Lua', magma: 'Magma (CAS)',
  makefile: 'Makefile', markdown: 'Markdown', markup: 'Markup (HTML, XML, SVG)', mata: 'Mata', matlab: 'MATLAB', maxscript: 'MAXScript',
  mel: 'MEL', metafont: 'METAFONT', mizar: 'Mizar', mongodb: 'MongoDB', monkey: 'Monkey', moonscript: 'MoonScript', n1ql: 'N1QL',
  n4js: 'N4JS', 'nand2tetris-hdl': 'Nand To Tetris HDL', naniscript: 'Naninovel Script', nasm: 'NASM', neon: 'NEON', nevod: 'Nevod',
  nginx: 'nginx', nim: 'Nim', nix: 'Nix', nsis: 'NSIS', objectivec: 'Objective-C', ocaml: 'OCaml', odin: 'Odin', opencl: 'OpenCL',
  openqasm: 'OpenQasm', oz: 'Oz', parigp: 'PARI/GP', parser: 'Parser', pascal: 'Pascal', pascaligo: 'Pascaligo', pcaxis: 'PC-Axis',
  peoplecode: 'PeopleCode', perl: 'Perl', php: 'PHP', phpdoc: 'PHPDoc', 'plant-uml': 'PlantUML', plsql: 'PL/SQL',
  powerquery: 'PowerQuery', powershell: 'PowerShell', processing: 'Processing', prolog: 'Prolog', promql: 'PromQL',
  properties: '.properties', protobuf: 'Protocol Buffers', psl: 'PATROL Scripting Language', pug: 'Pug', puppet: 'Puppet', pure: 'Pure',
  purebasic: 'PureBasic', purescript: 'PureScript', python: 'Python', q: 'Q (kdb+ database)', qml: 'QML', qore: 'Qore', qsharp: 'Q#',
  r: 'R', racket: 'Racket', reason: 'Reason', regex: 'Regex', rego: 'Rego', renpy: "Ren'py", rescript: 'ReScript',
  rest: 'reST (reStructuredText)', rip: 'Rip', roboconf: 'Roboconf', robotframework: 'Robot Framework', ruby: 'Ruby', rust: 'Rust',
  sas: 'SAS', sass: 'Sass (Sass)', scala: 'Scala', scheme: 'Scheme', scss: 'Sass (SCSS)', 'shell-session': 'Shell session',
  smali: 'Smali', smalltalk: 'Smalltalk', smarty: 'Smarty', sml: 'SML', solidity: 'Solidity (Ethereum)', 'solution-file': 'Solution file',
  soy: 'Soy (Closure Template)', sparql: 'SPARQL', 'splunk-spl': 'Splunk SPL', sqf: 'SQF (Arma 3)', sql: 'SQL', squirrel: 'Squirrel',
  stan: 'Stan', stata: 'Stata Ado', stylus: 'Stylus', supercollider: 'SuperCollider', swift: 'Swift', systemd: 'Systemd configuration file',
  't4-cs': 'T4 Text Templates (C#)', 't4-vb': 'T4 Text Templates (VB)', tap: 'TAP', tcl: 'Tcl', textile: 'Textile', toml: 'TOML',
  tremor: 'Tremor', tsx: 'TSX', tt2: 'Template Toolkit 2', turtle: 'Turtle', twig: 'Twig', typescript: 'TypeScript',
  typoscript: 'TypoScript', unrealscript: 'UnrealScript', uorazor: 'UO Razor Script', uri: 'URI', v: 'V', vala: 'Vala',
  vbnet: 'VB.Net', velocity: 'Velocity', verilog: 'Verilog', vhdl: 'VHDL', vim: 'Vim', 'visual-basic': 'Visual Basic',
  warpscript: 'WarpScript', wasm: 'WebAssembly', 'web-idl': 'Web IDL', wgsl: 'WGSL', wiki: 'Wiki markup', wolfram: 'Wolfram language',
  wren: 'Wren', xeora: 'Xeora', 'xml-doc': 'XML doc (.net)', xojo: 'Xojo (REALbasic)', xquery: 'XQuery', yaml: 'YAML', yang: 'YANG',
  zig: 'Zig',
};

/**
 * Grammars that are parts of others and no language of their own, which the control does not
 * offer — a fence may still name one — and `mermaid`, whose fence is a diagram.
 */
const PARTS = new Set(['clike', 'css-extras', 'js-extras', 'js-templates', 'javadoclike', 'markup-templating', 'php-extras', 't4-templating', 'mermaid']);

const entries = readdirSync(lang)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const id = file.replace(/\.js$/, '');
    const source = readFileSync(join(lang, file), 'utf8');
    const aliases = /\.aliases = \[([^\]]*)\]/.exec(source)?.[1]?.match(/'[^']*'/g)?.map((each) => each.slice(1, -1)) ?? [];
    return { id, aliases, title: TITLES[id] ?? null, part: PARTS.has(id) };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const line = ({ id, aliases, title, part }) =>
  `  { id: ${JSON.stringify(id)}, title: ${JSON.stringify(title ?? id)}, aliases: ${JSON.stringify(aliases)},${part ? ' part: true,' : ''} load: () => import('refractor/${id}') },`;

writeFileSync(
  join(here, '..', 'src', 'prism-grammars.ts'),
  `/**
 * Every grammar \`refractor\` ${version} carries — Prism's grammars, as a hast tree — written by
 * \`scripts/prism-grammars.mjs\` (#84): its identifier, its aliases, the name a person reads, and the
 * import that loads it, so a bundler splits each into a chunk a page downloads only when a note
 * names it. Do not edit by hand: run the script.
 */

import type { Syntax } from 'refractor/core';

export interface Grammar {
  readonly id: string;
  readonly title: string;
  readonly aliases: readonly string[];
  /** A part of other grammars, or a diagram's: loaded when named, never offered. */
  readonly part?: true;
  readonly load: () => Promise<{ default: Syntax }>;
}

export const GRAMMARS: readonly Grammar[] = [
${entries.map(line).join('\n')}
];
`,
);
console.log(`${entries.length} grammars, ${entries.filter((each) => !each.title || each.title === each.id).length} named by identifier`);
