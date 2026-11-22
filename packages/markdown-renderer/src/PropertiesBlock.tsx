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

import { createContext, useContext, type ReactNode } from 'react';
import { useHost } from './host.js';
import { MarkdownAnchor } from './Markdown.js';
import { hasParameterReference, splitParameters } from './parameters.js';
import {
  DRAWN_RESERVED_KEYS,
  isTrue,
  VALUE_LINK,
  type NoteProperties,
  type PropertyEntry,
} from './properties.js';
import type { PropertiesPlan } from './properties-block.js';
import type { ContentsMedium } from './contents.js';
import { drawSlot, useSlot } from './slots.js';
import { wikilinkAddress } from './wikilink-address.js';

/**
 * Text as it was typed, with each parameter it writes drawn as one (§7.14): a value of the
 * frontmatter, or the name of a note, in a model.
 */
export function useParameters(): (text: string) => ReactNode {
  const { strings } = useHost();
  return (text) => {
    const pieces = splitParameters(text);
    if (pieces.length === 1 && typeof pieces[0] === 'string') return pieces[0];
    return pieces.map((piece, index) =>
      typeof piece === 'string' ? (
        piece
      ) : (
        <span key={index} className="parameter" data-parameter={piece.name} title={strings.parameter}>
          {text.slice(piece.from, piece.to)}
        </span>
      ),
    );
  };
}

/**
 * A value as the note means it: a wikilink a link to where the host resolved it — the note, the
 * choice, or the pending marker — a Markdown link or a bare address to the web a link to it, each
 * through the anchor the body's links take, so the address filter holds and a theme's `wikilink`
 * slot draws them too; a parameter as a parameter; everything else as text, never as markup.
 */
function useValue(): (text: string) => ReactNode {
  const host = useHost();
  const drawn = useParameters();
  return (text) => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(VALUE_LINK)) {
      const at = match.index ?? 0;
      if (at > cursor) parts.push(drawn(text.slice(cursor, at)));
      const [whole, wikiTarget, wikiLabel, mdLabel, mdUrl, rawUrl] = match;
      if (wikiTarget) {
        const target = wikiTarget.trim();
        const name = target.split('#')[0]?.trim() ?? '';
        // A target that writes a parameter leads nowhere until a notebook is created from the model.
        const address = hasParameterReference(name) ? 'parameter:' : name ? wikilinkAddress(host, name.normalize('NFC')) : null;
        parts.push(
          <MarkdownAnchor key={at} href={address ?? `pending:${encodeURIComponent(name)}`}>
            {drawn(wikiLabel?.trim() || target)}
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
    if (cursor < text.length) parts.push(drawn(text.slice(cursor)));
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

/** The entries a plan draws: the keys it names, in its order, else every entry, the reserved first. */
export function chosenEntries(entries: readonly PropertyEntry[], keys: readonly string[] | null): PropertyEntry[] {
  if (keys === null) return ordered(entries);
  // A key the note does not have is drawn as nothing and raises nothing (#172).
  return keys.flatMap((key) => entries.filter((entry) => entry.key === key && entry.shape !== 'empty'));
}

/**
 * The note's properties as the default theme draws them, or through the theme's `properties` slot:
 * the name as the title, where `withName` says, and the chosen entries in a block that folds (#172).
 */
export function Properties({
  properties,
  plan = null,
  withName = true,
  medium = null,
}: {
  properties: NoteProperties;
  /** Which keys, under which title, folded or open; `null` draws every key, as before. */
  plan?: PropertiesPlan | null;
  /** Whether the name is drawn too: only at the top. */
  withName?: boolean;
  /** The one medium this drawing is for, marked so the stylesheet shows it only there. */
  medium?: ContentsMedium | null;
}) {
  const { strings } = useHost();
  const slot = useSlot('properties');
  const value = useValue();
  const drawn = useParameters();
  const shown = plan === null ? ordered(properties.entries) : chosenEntries(properties.entries, plan.keys);
  if (slot) {
    // A theme that draws nothing still wins: a host that shows the properties elsewhere is never made to draw them twice.
    const slotted = drawSlot(slot, {
      name: withName ? properties.name : null,
      entries: plan === null || plan.keys === null ? properties.entries : shown,
      value,
      part: withName ? (plan === null || shown.length > 0 ? 'whole' : 'name') : 'entries',
      ...(plan?.title ? { title: plan.title } : {}),
      ...(plan?.fold ? { fold: plan.fold } : {}),
    });
    return medium ? <div data-media={medium}>{slotted}</div> : slotted;
  }
  const entries = shown.length > 0 && (
    <details className="properties-box" open={plan?.fold !== 'closed'} data-media={medium ?? undefined}>
      <summary>{plan?.title ?? strings.properties}</summary>
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
  );
  return (
    <>
      {/* The name, always: a note with none says so where its name would be. */}
      {withName && (
        <h1 className={properties.name === null ? 'note-title note-unnamed' : 'note-title'}>
          {properties.name === null ? strings.unnamedNote : drawn(properties.name)}
        </h1>
      )}
      {entries}
    </>
  );
}

/** What each `properties` block of a note draws, by medium, or the host's for a note with none. */
export interface PropertiesPlans {
  readonly screen: PropertiesPlan | null;
  readonly print: PropertiesPlan | null;
}

/** The note whose properties are drawn (#172): its properties and what each block draws. */
export type PropertiesScope =
  | { readonly kind: 'note'; readonly properties: NoteProperties; readonly blocks: readonly PropertiesPlans[]; readonly printing: boolean }
  | { readonly kind: 'embedded' };

export const PropertiesContext = createContext<PropertiesScope | null>(null);

const samePlan = (a: PropertiesPlan | null, b: PropertiesPlan | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The draws of plans that resolve to `place`: one for both media where they agree, else one for each. */
function drawsAt(plans: PropertiesPlans, place: PropertiesPlan['place'], printing: boolean): { plan: PropertiesPlan; medium: ContentsMedium | null }[] {
  const at = (plan: PropertiesPlan | null): PropertiesPlan | null => (plan && plan.place === place ? plan : null);
  if (printing) {
    const print = at(plans.print);
    return print ? [{ plan: print, medium: null }] : [];
  }
  const screen = at(plans.screen);
  const print = at(plans.print);
  if (screen && print && samePlan(screen, print)) return [{ plan: screen, medium: null }];
  return [...(screen ? [{ plan: screen, medium: 'screen' as const }] : []), ...(print ? [{ plan: print, medium: 'print' as const }] : [])];
}

/** The plan that draws the name and nothing else, where the entries are drawn elsewhere. */
const NAME_ONLY: PropertiesPlan = { keys: [], title: null, fold: null, place: 'start' };

/**
 * The top of a note (#172): its name, always, and the entries the plans place at the start, in
 * one drawing with the name where a single one serves both media, as a note was always drawn.
 */
export function PropertiesTop({ properties, plans, printing }: { properties: NoteProperties; plans: readonly PropertiesPlans[]; printing: boolean }) {
  const draws = plans.flatMap((each) => drawsAt(each, 'start', printing));
  const first = draws[0];
  if (draws.length === 1 && first && first.medium === null) return <Properties properties={properties} plan={first.plan} />;
  return (
    <>
      <Properties properties={properties} plan={NAME_ONLY} />
      {draws.map((draw, index) => (
        <Properties key={index} properties={properties} plan={draw.plan} withName={false} medium={draw.medium} />
      ))}
    </>
  );
}

/** The entries the plans place at the end of the note, or where a block is written (`null`). */
export function PropertiesAt({ plans, place }: { plans: PropertiesPlans; place: 'end' | null }) {
  const scope = useContext(PropertiesContext);
  if (scope === null || scope.kind !== 'note') return null;
  return (
    <>
      {drawsAt(plans, place, scope.printing).map((draw, index) => (
        <Properties key={index} properties={scope.properties} plan={draw.plan} withName={false} medium={draw.medium} />
      ))}
    </>
  );
}

/**
 * A `properties` block where it is written (`SPEC.md` §7.18, #172): the entries it draws here in
 * each medium, nothing inside an embed, and its code block where no note is known.
 */
export function PropertiesBlockAt({ ordinal, fallback }: { ordinal: number | null; fallback: ReactNode }) {
  const scope = useContext(PropertiesContext);
  if (scope === null) return <>{fallback}</>;
  if (scope.kind === 'embedded') return null;
  const plans = ordinal === null ? undefined : scope.blocks[ordinal];
  if (!plans) return <>{fallback}</>;
  return <PropertiesAt plans={plans} place={null} />;
}
