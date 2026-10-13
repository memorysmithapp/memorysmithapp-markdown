/**
 * The frontmatter of a note, drawn above its body — or not — as the theme decides.
 *
 * The renderer reads it (`readProperties`) and hands it to the theme's
 * `properties` slot; with none, the default theme draws `name` as the note's
 * title and every other entry by the shape of its value: a list as chips, a
 * boolean in the reader's words, a date as the author wrote it (§6.6), text
 * and prose as text. Keys are the author's, in their language (§6.4).
 */

import type { ReactNode } from 'react';
import { useHost } from './host.js';
import { MarkdownAnchor } from './Markdown.js';
import { VALUE_WIKILINK, type NoteProperties, type PropertyEntry } from './properties.js';
import { drawSlot, useSlot } from './slots.js';
import { wikilinkAddress } from './wikilink-address.js';

/**
 * A value as the note means it: each wikilink a link to where the host resolved it — the note,
 * the choice, or the pending marker — through the same anchor the body's links take, so a theme's
 * `wikilink` slot draws it too; everything else as text, never as markup.
 */
function useValue(): (text: string) => ReactNode {
  const host = useHost();
  return (text) => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(VALUE_WIKILINK)) {
      const at = match.index ?? 0;
      if (at > cursor) parts.push(text.slice(cursor, at));
      const target = (match[1] ?? '').trim();
      const name = target.split('#')[0]?.trim() ?? '';
      const address = name ? wikilinkAddress(host, name.normalize('NFC')) : null;
      const href = address ?? `pending:${encodeURIComponent(name)}`;
      parts.push(
        <MarkdownAnchor key={at} href={href}>
          {match[2]?.trim() || target}
        </MarkdownAnchor>,
      );
      cursor = at + match[0].length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };
}

function Entry({ entry, value }: { entry: PropertyEntry; value: (text: string) => ReactNode }) {
  const { strings } = useHost();
  const drawn = (() => {
    switch (entry.shape) {
      case 'list':
        return entry.values.map((item, index) => (
          <span key={index} className="property-chip">
            {value(item)}
          </span>
        ));
      case 'boolean':
        return (
          <span className="property-boolean" data-value={entry.values[0]}>
            {entry.values[0] === 'true' ? strings.yes : strings.no}
          </span>
        );
      case 'date':
        return <time dateTime={entry.values[0]}>{entry.values[0]}</time>;
      case 'empty':
        return null;
      default:
        return value(entry.values[0] ?? '');
    }
  })();
  return (
    <div className="property" data-shape={entry.shape}>
      <dt>{entry.key}</dt>
      <dd>{drawn}</dd>
    </div>
  );
}

export function Properties({ properties }: { properties: NoteProperties }) {
  const { strings } = useHost();
  const slot = useSlot('properties');
  const value = useValue();
  if (slot) return drawSlot(slot, { name: properties.name, entries: properties.entries, value });
  if (properties.name === null && properties.entries.length === 0) return null;
  return (
    <header className="note-properties">
      {properties.name !== null && <h1 className="note-title">{properties.name}</h1>}
      {properties.entries.length > 0 && (
        <dl className="properties" aria-label={strings.properties}>
          {properties.entries.map((entry, index) => (
            <Entry key={index} entry={entry} value={value} />
          ))}
        </dl>
      )}
    </header>
  );
}
