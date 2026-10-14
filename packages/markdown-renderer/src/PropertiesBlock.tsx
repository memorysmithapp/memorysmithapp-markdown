/**
 * The frontmatter of a note, drawn above its body — or not — as the theme decides.
 *
 * The renderer reads it (`readProperties`) and hands it to the theme's
 * `properties` slot. With none, the default theme draws what MemorySmith's note
 * page draws above the body (*observed* at `4b67c7e`): the name as the note's
 * title, always — *Unnamed note* when it has none — and the properties in a
 * block that folds, under a rule and never in a card. The reserved keys come
 * first, in the order of the specification, then the notebook's own in the
 * order written; each key wears the icon of the shape of its value; a list is
 * chips, a boolean the reader's *Yes* or *No*, a date in the reader's locale,
 * and what was typed stays in the title of each.
 */

import type { ReactNode } from 'react';
import { useHost } from './host.js';
import { MarkdownAnchor } from './Markdown.js';
import {
  DRAWN_RESERVED_KEYS,
  isTrue,
  VALUE_LINK,
  type NoteProperties,
  type PropertyEntry,
} from './properties.js';
import { drawSlot, useSlot } from './slots.js';
import { wikilinkAddress } from './wikilink-address.js';

/**
 * A value as the note means it: a wikilink a link to where the host resolved it — the note, the
 * choice, or the pending marker — a Markdown link or a bare address to the web a link to it, each
 * through the anchor the body's links take, so the address filter holds and a theme's `wikilink`
 * slot draws them too; everything else as text, never as markup.
 */
function useValue(): (text: string) => ReactNode {
  const host = useHost();
  return (text) => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(VALUE_LINK)) {
      const at = match.index ?? 0;
      if (at > cursor) parts.push(text.slice(cursor, at));
      const [whole, wikiTarget, wikiLabel, mdLabel, mdUrl, rawUrl] = match;
      if (wikiTarget) {
        const target = wikiTarget.trim();
        const name = target.split('#')[0]?.trim() ?? '';
        const address = name ? wikilinkAddress(host, name.normalize('NFC')) : null;
        parts.push(
          <MarkdownAnchor key={at} href={address ?? `pending:${encodeURIComponent(name)}`}>
            {wikiLabel?.trim() || target}
          </MarkdownAnchor>,
        );
      } else {
        parts.push(
          <MarkdownAnchor key={at} href={mdUrl ?? rawUrl}>
            {mdLabel ?? rawUrl}
          </MarkdownAnchor>,
        );
      }
      cursor = at + whole.length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };
}

/** The type that picks a key's icon, by the shape of its value and never by its key. */
function iconType(entry: PropertyEntry): 'list' | 'date' | 'checkbox' | 'text' {
  if (entry.shape === 'list') return 'list';
  if (entry.shape === 'boolean') return 'checkbox';
  if (entry.shape === 'date') return 'date';
  return 'text';
}

/**
 * A date in the reader's locale, as the rest of an interface writes one. A note's date carries no
 * zone, so it is read and written in UTC: read in the zone of the browser, `2026-09-21` is the
 * evening of the 20th west of Greenwich. A form the reading does not take stays as typed.
 */
function readableDate(value: string, locale: string): string | null {
  const typed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?$/.test(typed)) return null;
  const [day, time] = typed.split(/[T ]/);
  const [year, month, date] = (day ?? '').split('-').map(Number);
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  const when = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hours ?? 0, minutes ?? 0));
  if (when.getUTCDate() !== date || when.getUTCMonth() !== (month ?? 1) - 1) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}), timeZone: 'UTC' }).format(when);
  } catch {
    return null;
  }
}

function PropertyValue({ entry, value }: { entry: PropertyEntry; value: (text: string) => ReactNode }) {
  const { strings } = useHost();
  if (entry.shape === 'list') {
    return (
      <span className="prop-tags">
        {entry.values.map((item, index) => (
          <span key={index} className="prop-tag">
            {value(item)}
          </span>
        ))}
      </span>
    );
  }
  const typed = (entry.values[0] ?? '').trim();
  if (entry.shape === 'boolean') return <span title={typed}>{isTrue(typed) ? strings.yes : strings.no}</span>;
  if (entry.shape === 'date') {
    const readable = readableDate(typed, strings.locale);
    if (readable !== null) {
      return (
        <time dateTime={typed} title={typed}>
          {readable}
        </time>
      );
    }
  }
  return <>{value(typed)}</>;
}

/** The reserved keys first, in the order of the specification, then the rest in the order written. */
function ordered(entries: readonly PropertyEntry[]): PropertyEntry[] {
  const rank = (key: string): number => {
    const at = DRAWN_RESERVED_KEYS.indexOf(key);
    return at === -1 ? DRAWN_RESERVED_KEYS.length : at;
  };
  return entries
    .filter((entry) => entry.shape !== 'empty')
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => rank(left.entry.key) - rank(right.entry.key) || left.index - right.index)
    .map(({ entry }) => entry);
}

export function Properties({ properties }: { properties: NoteProperties }) {
  const { strings } = useHost();
  const slot = useSlot('properties');
  const value = useValue();
  if (slot) return drawSlot(slot, { name: properties.name, entries: properties.entries, value });
  const shown = ordered(properties.entries);
  return (
    <>
      {/* The name, always: a note with none says so where its name would be. */}
      <h1 className={properties.name === null ? 'note-title note-unnamed' : 'note-title'}>
        {properties.name ?? strings.unnamedNote}
      </h1>
      {shown.length > 0 && (
        <details className="properties-box" open>
          <summary>{strings.properties}</summary>
          <div className="metadata-container">
            {shown.map((entry, index) => (
              <div key={index} className="metadata-property" data-property-type={iconType(entry)}>
                <span className="metadata-property-key">{entry.key}</span>
                <span className="metadata-property-value">
                  <PropertyValue entry={entry} value={value} />
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
