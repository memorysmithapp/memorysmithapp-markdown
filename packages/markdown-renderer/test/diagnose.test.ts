// @vitest-environment node
// The notices of a note (§7.13), read with no DOM: the conformance suite's notices, the table of
// `spec.json`, the demonstration notebooks, and the promise that the subpath carries no React.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { cases, spec } from '@memorysmithapp/markdown-spec';
import { describe, expect, it } from 'vitest';
import { diagnose, NOTICES, type NoticeCode } from '../src/diagnose.js';
import { readProperties } from '../src/properties.js';

const ROOT = resolve(__dirname, '..', '..', '..');
const SOURCE = resolve(__dirname, '..', 'src');

const byLine = (notices: readonly { code: string; line: number }[]): string[] =>
  notices.map(({ code, line }) => `${code}@${line}`).sort();

describe('the conformance suite', () => {
  const raising = cases.filter((testCase) => testCase.notices !== undefined);

  it('has notice cases to run', () => {
    expect(raising.length).toBeGreaterThan(0);
  });

  for (const testCase of raising) {
    it(testCase.id, async () => {
      const notebook = testCase.notebook;
      const names = new Set<string>();
      for (const note of notebook?.notes ?? []) {
        const read = readProperties(note);
        if (read.name) names.add(read.name);
        for (const alias of read.entries.find((entry) => entry.key === 'aliases')?.values ?? []) names.add(alias);
      }
      const notices = await diagnose(
        testCase.markdown,
        notebook
          ? { resolve: (name) => (names.has(name) ? `/notes/${name}` : null), keeps: (name) => (notebook.attachments ?? []).includes(name) }
          : {},
      );
      expect(byLine(notices)).toEqual(byLine(testCase.notices ?? []));
    });
  }
});

describe('the table of notices', () => {
  it('is the one spec.json declares, code for code', () => {
    const declared = Object.fromEntries(spec.notices.map(({ code, severity, spec: section }) => [code, { severity, section }]));
    const implemented = Object.fromEntries(
      Object.entries(NOTICES).map(([code, { severity, section }]) => [code, { severity, section }]),
    );
    expect(implemented).toEqual(declared);
  });
});

describe('a notice', () => {
  const NAMED = '---\nname: Note\naliases: [note]\ntags: [example]\n---\n';

  it('is placed over the whole note, frontmatter included, whatever its newlines', async () => {
    const [notice] = await diagnose(`${NAMED}# Title\n\nA claim[^source].\n`.replace(/\n/g, '\r\n'));
    expect(notice).toMatchObject({
      code: 'footnote-undefined',
      severity: 'notice',
      section: '7.12',
      line: 8,
      column: 8,
      endLine: 8,
      endColumn: 17,
    });
  });

  it('reports no pending link when the host says nothing about the notebook', async () => {
    expect(await diagnose(`${NAMED}# Title\n\nSee [[Nowhere]] and ![[Nothing]].\n`)).toEqual([]);
  });

  it('counts a note named by an alias as answered, through reaches', async () => {
    const notices = await diagnose(`${NAMED}# Title\n\nSee [[Here]] and [[There]].\n`, { reaches: (name) => (name === 'Here' ? 1 : 0) });
    expect(notices.map((notice) => notice.code)).toEqual(['link-pending']);
    expect(notices[0]?.message).toContain('There');
  });

  it('leaves Mermaid unloaded when diagrams are not asked for', async () => {
    expect(await diagnose(`${NAMED}# Title\n\n\`\`\`mermaid\ngraph TD\n  A -->\n\`\`\`\n`, { diagrams: false })).toEqual([]);
  });

  it('is never raised by text inside code', async () => {
    const note = `${NAMED}# Title\n\n\`\`\`markdown\n### Skipped\n<b>raw</b> [^none] H~2~O [[Nowhere]]\n\`\`\`\n`;
    expect(await diagnose(note, { resolve: () => null })).toEqual([]);
  });
});

describe('the demonstration notebooks', () => {
  const NOTEBOOKS = join(ROOT, 'notebooks');
  const notes: string[] = [];
  const collect = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      // What frames a notebook — its guidance, its structure, a folder's template — is not a note.
      else if (entry.name.endsWith('.md') && !['GUIDANCE.md', 'STRUCTURE.md', 'TEMPLATE.md'].includes(entry.name)) notes.push(path);
    }
  };
  collect(NOTEBOOKS);

  it('raise no notice but the name the two drafts leave out on purpose', async () => {
    const raised: Record<string, NoticeCode[]> = {};
    for (const path of notes) {
      const notices = (await diagnose(readFileSync(path, 'utf8'))).filter((notice) => notice.severity === 'notice');
      if (notices.length > 0) raised[relative(NOTEBOOKS, path)] = notices.map((notice) => notice.code);
    }
    expect(raised).toEqual({
      'continuity-engineering/03 Reviews/Exercise 2026-06 · Account loss (draft).md': ['name-missing'],
      'enologia/03 Safras/Rascunho da safra 2027.md': ['name-missing'],
    });
  }, 30_000);
});

describe('the subpath', () => {
  it('reaches no React and no module that draws', () => {
    const seen = new Set<string>();
    const bare = new Set<string>();
    const visit = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/^import\s+(type\s+)?[^'"]*?from\s+'([^']+)';/gm)) {
        if (match[1]) continue;
        const specifier = match[2] ?? '';
        if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
        else bare.add(specifier);
      }
    };
    visit(join(SOURCE, 'diagnose.ts'));
    expect([...seen].filter((file) => file.endsWith('.tsx'))).toEqual([]);
    expect([...bare].filter((specifier) => /react|hast-util-to-jsx-runtime/.test(specifier))).toEqual([]);
  });
});
