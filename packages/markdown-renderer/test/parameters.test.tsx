/**
 * Parameter references, `{{name}}` (§7.14, #134): drawn unresolved, as a parameter, wherever text
 * is, and never inside code, a diagram, math, a destination or an autolink; a wikilink whose target
 * writes one is neither a link nor pending, and an embed of one transcludes nothing.
 */

import { describe, expect, it } from 'vitest';
import { hasParameterReference, parameterReferences, splitParameters } from '../src/parameters.js';
import { diagnose } from '../src/diagnose.js';
import { html } from './render.js';

/** The parameters the page draws, by name, in order. */
const drawn = (out: string): string[] => [...out.matchAll(/class="parameter" data-parameter="([^"]*)"/g)].map((match) => match[1]!);

describe('a reference', () => {
  it('is a name between double braces, the shortest match', () => {
    expect(parameterReferences('{{a}}{{b}}').map((each) => each.name)).toEqual(['a', 'b']);
    expect(parameterReferences('{{{name}}}')).toEqual([{ name: 'name', from: 1, to: 9 }]);
  });

  it('is named by a letter or _, then letters, marks, digits, _ and -', () => {
    expect(parameterReferences('{{condomínio}} {{_x}} {{a-1_b}} {{注意}}').map((each) => each.name)).toEqual(['condomínio', '_x', 'a-1_b', '注意']);
    for (const text of ['{{123}}', '{{-}}', '{{}}', '{{ some text }}', '{{name}', '{{a b}}']) {
      expect(hasParameterReference(text), text).toBe(false);
    }
  });

  it('is one parameter in NFC and in NFD', () => {
    expect(parameterReferences('{{condomínio}}'.normalize('NFD'))[0]?.name).toBe('condomínio'.normalize('NFC'));
  });

  it('needs two unescaped braces', () => {
    for (const text of ['\\{{name}}', '{\\{name}}', '{{name\\}}']) expect(hasParameterReference(text), text).toBe(false);
    expect(hasParameterReference('\\\\{{name}}')).toBe(true);
  });

  it('cuts a text at its references, keeping what was typed', () => {
    expect(splitParameters('Condomínio {{nome}}, bloco {{bloco}}')).toEqual([
      'Condomínio ',
      { name: 'nome', from: 11, to: 19 },
      ', bloco ',
      { name: 'bloco', from: 27, to: 36 },
    ]);
    expect(splitParameters('nothing')).toEqual(['nothing']);
  });
});

describe('the reading surface', () => {
  it('draws an unresolved reference as a parameter, braces and all', () => {
    const out = html('O condomínio {{condomínio}} aprovou.');
    expect(out).toContain('<span class="parameter" data-parameter="condomínio" title="Parameter: filled in when a notebook is created from this model.">{{condomínio}}</span>');
  });

  it('draws the same parameter as often as it is written, and in every place text is', () => {
    const out = html(
      [
        '# Ata do {{condomínio}}',
        '',
        '> [!note] {{síndico}}',
        '> Assinada por {{síndico}}.',
        '',
        '- item {{a}}',
        '  continued {{b}}',
        '',
        '| Bloco |',
        '|---|',
        '| {{bloco}} |',
        '',
        '*{{em}}* **{{strong}}** =={{marked}}== [text {{label}}](https://example.org)',
      ].join('\n'),
    );
    expect(drawn(out)).toEqual(['condomínio', 'síndico', 'síndico', 'a', 'b', 'bloco', 'em', 'strong', 'marked', 'label']);
    expect(out).toMatch(/<mark><span class="parameter" data-parameter="marked"/);
  });

  it('keeps the text around a reference as the parser read it', () => {
    const out = html('a &amp; \\*b {{x}} c\\*');
    expect(out).toContain('a &amp; *b <span class="parameter" data-parameter="x"');
    expect(out).toContain('</span> c*');
  });

  it('draws an escaped reference as the characters, without the backslash', () => {
    const out = html('Write \\{{name}} to show the notation, and {\\{name}} too.');
    expect(drawn(out)).toEqual([]);
    expect(out).toContain('Write {{name}} to show the notation, and {{name}} too.');
  });

  it('draws a run that does not close as one as text', () => {
    const out = html('{{{name}}} {{name} {{}} {{123}}');
    expect(drawn(out)).toEqual(['name']);
    expect(out).toContain('{<span class="parameter" data-parameter="name"');
    expect(out).toContain('</span>} {{name} {{}} {{123}}');
  });

  it('leaves code, a diagram and math as they are', () => {
    const out = html(
      ['`{{span}}`', '', '```', '{{block}}', '```', '', '```mermaid', 'graph TD', '  A{{hexagon}}', '```', '', '$x{{p}}$', '', '$$', '{{q}}', '$$', '', '    {{indented}}'].join('\n'),
    );
    expect(drawn(out)).toEqual([]);
    expect(out).toContain('<code>{{span}}</code>');
    expect(out).toContain('{{block}}');
    expect(out).toContain('<annotation encoding="application/x-tex">x{{p}}</annotation>');
  });

  it('leaves a destination, an autolink and raw HTML as they are', () => {
    const out = html('[site]({{url}}) ![alt]({{image}}) <https://example.org/{{a}}> https://example.org/{{b}}\n\n<div>\n{{c}}\n</div>\n\n[ref]: {{dest}}');
    expect(drawn(out)).toEqual([]);
    expect(out).toContain('&lt;div&gt;\n{{c}}\n&lt;/div&gt;');
  });

  it('reads the text between two inline tags as text, as CommonMark does', () => {
    expect(drawn(html('<b>{{c}}</b>'))).toEqual(['c']);
  });
});

describe('a wikilink', () => {
  const resolve = (name: string): string | null => (name === 'Nota' ? '/notes/nota' : null);

  it('whose target writes a parameter is drawn as the parameter, neither a link nor pending', () => {
    const out = html('Cliente: [[{{client}}]].', { resolve });
    expect(out).toContain('<span class="wikilink-parameter" title="A link to a parameter: it leads to a note once a notebook is created from this model."><span class="parameter" data-parameter="client"');
    expect(out).not.toContain('wikilink-pending');
    expect(out).not.toContain('href');
  });

  it('whose embed writes a parameter transcludes nothing, and is drawn as the parameter', () => {
    const asked: string[] = [];
    const out = html('![[{{client}}]]', { resolve, loadNote: async (name) => (asked.push(name), null) });
    expect(asked).toEqual([]);
    expect(out).toContain('<span class="wikilink-parameter"');
    expect(drawn(out)).toEqual(['client']);
  });

  it('whose alias writes a parameter is the ordinary link, its alias drawn with the parameter', () => {
    const out = html('[[Nota|{{c}}]] [[Nota#{{s}}]]', {
      resolve,
      renderLink: ({ href, className, children }) => (
        <a className={className} href={href}>
          {children}
        </a>
      ),
    });
    expect(out).toContain('<a class="wikilink" href="/notes/nota"><span class="parameter" data-parameter="c"');
    expect(out).toContain('<a class="wikilink" href="/notes/nota">Nota#<span class="parameter" data-parameter="s"');
  });

  it('whose target writes a parameter raises no pending notice', async () => {
    const notices = await diagnose('[[{{client}}]] ![[{{client}}]] [[Missing]]\n', { resolve });
    expect(notices.map((notice) => notice.code).filter((code) => code.endsWith('-pending'))).toEqual(['link-pending']);
  });
});

describe('the frontmatter', () => {
  it('draws a parameter in a value and in the name of the note', () => {
    const out = html('---\nname: "Ata do {{condomínio}}"\nmanager: "{{síndico}}"\nunquoted: {{bare}}\nblocks: ["{{bloco}}", B]\nowner: "[[{{pessoa}}]]"\n---\nCorpo.\n');
    expect(out).toMatch(/<h1 class="note-title">Ata do <span class="parameter" data-parameter="condomínio"[^>]*>\{\{condomínio\}\}<\/span><\/h1>/);
    expect(drawn(out)).toEqual(['condomínio', 'síndico', 'bare', 'bloco', 'pessoa']);
    expect(out).toContain('<span class="wikilink-parameter"');
  });
});
