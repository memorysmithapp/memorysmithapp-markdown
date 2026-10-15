/**
 * The language of a fenced code block, chosen at its top right in edit mode (#84): a button that
 * says the language, and a combobox that searches every grammar Prism carries — by the name a
 * person reads, by Prism's identifier, or by an alias, so `py` finds Python — with plain text and a
 * Mermaid diagram first. Choosing rewrites the opening fence's info string and nothing else.
 */

import type { EditorView } from '@codemirror/view';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { grammarOf } from '../highlight.js';
import { useHost } from '../host.js';
import { GRAMMARS } from '../prism-grammars.js';
import { ICONS } from './blocks.js';

/** The code blocks whose control opens as soon as it is drawn: one the toolbar or the menu just inserted. */
const opening = new WeakMap<EditorView, number>();

/** Opens the control of the fence that starts at `from` once it is drawn. */
export function chooseLanguageAt(view: EditorView, from: number): void {
  opening.set(view, from);
}

interface Choice {
  /** What the info string says: `null` for none. */
  readonly value: string | null;
  readonly label: string;
  /** The words a search matches, lower case. */
  readonly words: readonly string[];
  /** An alias, shown beside the name when it is what the search matched. */
  readonly hint?: string;
}

/**
 * The fence's opening line rewritten with `language` as the first word of its info string, the
 * rest of it kept; `null` takes the word away.
 */
export function withLanguage(fence: string, language: string | null): string {
  const match = /^([ \t>]*(?:`{3,}|~{3,}))([ \t]*)(\S*)(.*)$/.exec(fence);
  if (!match) return fence;
  const [, marker, , , rest] = match;
  return language ? `${marker}${language}${rest}` : `${marker}${rest?.replace(/^[ \t]+/, '') ?? ''}`;
}

export function LanguageControl({ view, from, language }: { view: EditorView; from: number; language: string | null }) {
  const host = useHost();
  const words = host.strings.editor;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const grammar = grammarOf(language);

  const choices = useMemo<Choice[]>(() => {
    const all: Choice[] = [
      { value: null, label: words.plainText, words: [words.plainText.toLowerCase(), 'text', 'plain'] },
      { value: 'mermaid', label: words.mermaidDiagram, words: [words.mermaidDiagram.toLowerCase(), 'mermaid'] },
      ...GRAMMARS.filter((each) => !each.part)
        .map((each) => ({ value: each.id, label: each.title, words: [each.title.toLowerCase(), each.id, ...each.aliases.map((alias) => alias.toLowerCase())] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    // A name no grammar answers is offered as itself, drawn as plain code.
    if (language && !grammar && language.toLowerCase() !== 'mermaid') all.splice(1, 0, { value: language, label: `${language} · ${words.notHighlighted}`, words: [language.toLowerCase()] });
    return all;
  }, [words, language, grammar]);

  const wanted = query.trim().toLowerCase();
  // What the search finds, best first: a name or an alias that is the search, then one that starts
  // with it, then one that holds it; the order of the list within each.
  const shown = useMemo(() => {
    if (!wanted) return choices;
    const rank = (each: Choice) => (each.words.some((word) => word === wanted) ? 0 : each.words.some((word) => word.startsWith(wanted)) ? 1 : 2);
    return choices
      .filter((each) => each.words.some((word) => word.includes(wanted)))
      .map((each, order) => ({ each, order, rank: rank(each) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map(({ each }) => {
        const alias = each.words.slice(2).find((word) => word.startsWith(wanted));
        return alias && !each.label.toLowerCase().includes(wanted) ? { ...each, hint: alias } : each;
      });
  }, [choices, wanted]);

  const current = language === null ? null : (grammar?.id ?? language.toLowerCase());
  const label = language === null ? words.plainText : language.toLowerCase() === 'mermaid' ? words.mermaidDiagram : (grammar?.title ?? language);

  // A block the toolbar or the menu just inserted opens its choice at once, its search focused.
  useEffect(() => {
    if (opening.get(view) !== from) return;
    opening.delete(view);
    setOpen(true);
  }, [view, from]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, shown.findIndex((each) => each.value === current)));
    box.current?.querySelector<HTMLInputElement>('input')?.focus();
    const outside = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
    // The active option is placed once, as the list opens.
  }, [open]);

  useEffect(() => {
    box.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id]);

  const close = (back: 'text' | 'button') => {
    setOpen(false);
    setQuery('');
    if (back === 'text') view.focus();
    else button.current?.focus();
  };

  const choose = (choice: Choice) => {
    const line = view.state.doc.lineAt(from);
    const next = withLanguage(line.text, choice.value);
    if (next !== line.text) view.dispatch({ changes: { from: line.from, to: line.to, insert: next }, userEvent: 'input.form' });
    // The cursor goes into the code, where the author writes next.
    const after = view.state.doc.lineAt(from);
    if (after.number < view.state.doc.lines) view.dispatch({ selection: { anchor: view.state.doc.line(after.number + 1).from } });
    close('text');
  };

  return (
    <span className="edit-language" ref={box} data-ms-control="">
      <button
        ref={button}
        type="button"
        className="edit-language-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={words.language}
        aria-label={`${words.language}: ${label}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (open ? close('button') : setOpen(true))}
      >
        {label}
        <span className="edit-language-caret" aria-hidden="true">
          {ICONS.caret}
        </span>
      </button>
      {open && (
        <span className="edit-language-popover">
          <input
            className="edit-language-search"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? `${id}-option-${active}` : undefined}
            aria-label={words.searchLanguages}
            placeholder={words.searchLanguages}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') setActive((at) => Math.min(shown.length - 1, at + 1));
              else if (event.key === 'ArrowUp') setActive((at) => Math.max(0, at - 1));
              else if (event.key === 'Enter' && shown[active]) choose(shown[active]);
              else if (event.key === 'Escape') close('text');
              else return;
              event.preventDefault();
              event.stopPropagation();
            }}
          />
          <span className="edit-language-list" role="listbox" id={`${id}-list`} aria-label={words.language}>
            {shown.length === 0 ? (
              <span className="edit-language-none">{words.noLanguage}</span>
            ) : (
              shown.map((each, index) => (
                <span
                  key={each.value ?? ''}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={each.value === current}
                  data-active={index === active || undefined}
                  className="edit-language-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(each)}
                >
                  <span>{each.label}</span>
                  {each.hint && <span className="edit-language-hint">{each.hint}</span>}
                </span>
              ))
            )}
          </span>
        </span>
      )}
    </span>
  );
}
