/**
 * A note's contents drawn (`SPEC.md` §7.17, #173, #175): the lists a `contents` block, or the
 * host's settings, resolve to, in the medium the note is drawn for, and the line under a figure or
 * a table that a list of figures or of tables leads to.
 *
 * Which note is drawn is a context: `NoteBody` provides the note's outline, its figures, tables and
 * attachments, and what each of its blocks resolves to; an embed provides `embedded`, where a block
 * draws nothing, the apparatus of navigation being the open note's alone; and with neither — a run
 * drawn on its own — a block is the code block it is in any other reader.
 *
 * Printed by a host that says so (`printing`), only the print settings are drawn. Otherwise the
 * screen's are drawn, and the print's beside them marked `data-media`, which the stylesheet shows
 * only on paper, so a print the browser makes on its own is the print the settings declared.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { toHast } from 'mdast-util-to-hast';
import type { Nodes as MdastNodes } from 'mdast';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { useHost, type KeptFile } from './host.js';
import { InPageAnchor } from './InPageAnchor.js';
import { samePlan, type ContentsList, type ContentsMedium, type ContentsPlace, type ContentsPlan } from './contents.js';
import type { AttachmentItem, FigureItem, NoteItems, OutlineHeading, OutlineNode, TableEntry } from './outline.js';
import { appendixId } from './appendices.js';

/** What each `contents` block of a note draws, by medium. */
export interface BlockPlans {
  readonly screen: ContentsPlan | null;
  readonly print: ContentsPlan | null;
}

/** In which media a note draws a list of a kind, which is where the line under its items is drawn. */
export type ListedIn = Readonly<Record<ContentsList, { readonly screen: boolean; readonly print: boolean }>>;

/** The note a contents is drawn in. */
export type ContentsScope =
  | {
      readonly kind: 'note';
      readonly headings: readonly OutlineHeading[];
      readonly items: NoteItems;
      /** What each kept file is, as the host said, for a figure's or an attachment's description. */
      readonly files: ReadonlyMap<string, KeptFile | null | undefined>;
      /** What each block of the note draws, by its ordinal. */
      readonly blocks: readonly BlockPlans[];
      readonly listed: ListedIn;
      readonly printing: boolean;
      /** Whether the tables print as appendices, where a table's entry leads instead (#165). */
      readonly appendices: boolean;
    }
  | { readonly kind: 'embedded' };

export const ContentsContext = createContext<ContentsScope | null>(null);

/** The scope of an embedded note, where no contents is drawn. */
export const EMBEDDED: ContentsScope = { kind: 'embedded' };

/** The media each kind is listed in, over every plan a note draws. */
export function listedIn(plans: readonly BlockPlans[]): ListedIn {
  const kinds: ContentsList[] = ['headings', 'figures', 'tables', 'attachments'];
  const has = (medium: ContentsMedium, kind: ContentsList) => plans.some((plan) => plan[medium]?.lists.some((list) => list.kind === kind) ?? false);
  return Object.fromEntries(kinds.map((kind) => [kind, { screen: has('screen', kind), print: has('print', kind) }])) as unknown as ListedIn;
}

/**
 * A `contents` block where it is written: what it draws here in each medium, nothing inside an
 * embed, and its code block where no note's outline is known.
 */
export function ContentsBlock({ ordinal, fallback }: { ordinal: number | null; fallback: ReactNode }) {
  const scope = useContext(ContentsContext);
  if (scope === null) return <>{fallback}</>;
  if (scope.kind === 'embedded') return null;
  const plans = ordinal === null ? undefined : scope.blocks[ordinal];
  if (!plans) return <>{fallback}</>;
  return <ContentsAt plans={plans} place={null} />;
}

/** The contents that resolve to `place` — `null` for where a block is written — in each medium. */
export function ContentsAt({ plans, place }: { plans: BlockPlans; place: ContentsPlace | null }) {
  const scope = useContext(ContentsContext);
  if (scope === null || scope.kind !== 'note') return null;
  const at = (plan: ContentsPlan | null): ContentsPlan | null => (plan && plan.place === place ? plan : null);
  if (scope.printing) {
    const print = at(plans.print);
    return print ? <ContentsNav plan={print} medium={null} /> : null;
  }
  const screen = at(plans.screen);
  const print = at(plans.print);
  if (screen && print && samePlan(screen, print)) return <ContentsNav plan={screen} medium={null} />;
  return (
    <>
      {screen && <ContentsNav plan={screen} medium="screen" />}
      {print && <ContentsNav plan={print} medium="print" />}
    </>
  );
}

interface Branch {
  readonly heading: OutlineHeading;
  readonly children: Branch[];
}

/** The headings within `depth` levels of the highest, nested under the heading above them. */
function branches(headings: readonly OutlineHeading[], depth: number): Branch[] {
  const top = Math.min(...headings.map((heading) => heading.level));
  const roots: Branch[] = [];
  const stack: { level: number; children: Branch[] }[] = [{ level: 0, children: roots }];
  for (const heading of headings) {
    if (heading.level >= top + depth) continue;
    while (stack.length > 1 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
    const branch: Branch = { heading, children: [] };
    stack[stack.length - 1]!.children.push(branch);
    stack.push({ level: heading.level, children: branch.children });
  }
  return roots;
}

/** Inlines of the note, as an entry draws them. */
export function inlines(content: readonly OutlineNode[]): ReactNode {
  const tree = toHast({ type: 'paragraph', children: content } as unknown as MdastNodes);
  const root = tree.type === 'element' ? { type: 'root' as const, children: tree.children } : tree;
  return toJsxRuntime(root as Parameters<typeof toJsxRuntime>[0], { Fragment, jsx, jsxs });
}

function Headings({ branches }: { branches: readonly Branch[] }) {
  return (
    <ol className="contents-entries">
      {branches.map(({ heading, children }) => (
        <li key={heading.id} className="contents-item">
          <InPageAnchor href={`#${heading.id}`} className="contents-entry">
            {heading.number !== null && (
              <>
                <span className="contents-number">{heading.number}</span>{' '}
              </>
            )}
            {inlines(heading.content)}
          </InPageAnchor>
          {children.length > 0 && <Headings branches={children} />}
        </li>
      ))}
    </ol>
  );
}

/**
 * What names a kept file or a remote image: the title written, else the file's description, else
 * its name (#175).
 */
export function FileLabel({ name, title }: { name: string; title: string | null }) {
  const scope = useContext(ContentsContext);
  const file = scope?.kind === 'note' ? scope.files.get(name) : undefined;
  return <>{title || file?.description || name}</>;
}

/** What names a table: its caption, else a block's title or table, else nothing beyond its number. */
function TableLabel({ table }: { table: TableEntry }) {
  if (table.caption) return <>{inlines(table.caption)}</>;
  return <>{table.title ?? ''}</>;
}

function Figures({ figures }: { figures: readonly FigureItem[] }) {
  const { strings } = useHost();
  return (
    <ol className="contents-entries">
      {figures.map((figure) => (
        <li key={figure.id} className="contents-item">
          <InPageAnchor href={`#${figure.id}`} className="contents-entry">
            <span className="contents-number">{strings.figureNumber(figure.number)}</span> <FileLabel name={figure.name} title={figure.title} />
          </InPageAnchor>
        </li>
      ))}
    </ol>
  );
}

function Tables({ tables, appendices }: { tables: readonly TableEntry[]; appendices: boolean }) {
  const { strings } = useHost();
  return (
    <ol className="contents-entries">
      {tables.map((table) => (
        <li key={table.id} className="contents-item">
          <InPageAnchor href={`#${appendices ? appendixId(table.number) : table.id}`} className="contents-entry">
            <span className="contents-number">{strings.tableNumber(table.number)}</span> <TableLabel table={table} />
          </InPageAnchor>
        </li>
      ))}
    </ol>
  );
}

function Attachments({ attachments }: { attachments: readonly AttachmentItem[] }) {
  return (
    <ol className="contents-entries">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="contents-item">
          <InPageAnchor href={`#${attachment.id}`} className="contents-entry">
            <FileLabel name={attachment.name} title={attachment.title} />
          </InPageAnchor>
        </li>
      ))}
    </ol>
  );
}

/** One drawn contents: each of its lists under its title. */
function ContentsNav({ plan, medium }: { plan: ContentsPlan; medium: ContentsMedium | null }) {
  const { strings } = useHost();
  const scope = useContext(ContentsContext);
  if (scope?.kind !== 'note') return null;
  const titles: Record<ContentsList, string> = {
    headings: strings.contentsHeadings,
    figures: strings.contentsFigures,
    tables: strings.contentsTables,
    attachments: strings.contentsAttachments,
  };
  // A figure is known once its file is: until then the contents is busy, and a host that prints waits.
  const busy = scope.items.pending && plan.lists.some((list) => list.kind === 'figures');
  return (
    <nav className="contents" data-media={medium ?? undefined} aria-busy={busy || undefined}>
      {plan.lists.map((list) => {
        const title = list.title ?? titles[list.kind];
        return (
          <section key={list.kind} className="contents-list" data-list={list.kind} aria-label={title}>
            <p className="contents-title">{title}</p>
            {list.kind === 'headings' && scope.headings.length > 0 && <Headings branches={branches(scope.headings, list.depth)} />}
            {list.kind === 'figures' && scope.items.figures.length > 0 && <Figures figures={scope.items.figures} />}
            {list.kind === 'tables' && scope.items.tables.length > 0 && <Tables tables={scope.items.tables} appendices={scope.appendices} />}
            {list.kind === 'attachments' && scope.items.attachments.length > 0 && <Attachments attachments={scope.items.attachments} />}
          </section>
        );
      })}
    </nav>
  );
}

/**
 * The line under a figure or a table (#175): a table's `Table:` caption, always, without its
 * keyword; and the item's number, with a figure's label, in each medium where the note lists that
 * kind, and nowhere else, so a note with no list draws its images and tables as before.
 */
export function Caption({ kind, number, children }: { kind: 'figure' | 'table'; number: number | null; children?: ReactNode }) {
  const scope = useContext(ContentsContext);
  const { strings } = useHost();
  const note = scope?.kind === 'note' ? scope : null;
  const listed = note && number !== null ? note.listed[kind === 'figure' ? 'figures' : 'tables'] : { screen: false, print: false };
  const media: (ContentsMedium | null)[] = note?.printing
    ? listed.print
      ? [null]
      : []
    : listed.screen && listed.print
      ? [null]
      : [...(listed.screen ? ['screen' as const] : []), ...(listed.print ? ['print' as const] : [])];
  const written = Array.isArray(children) ? children.length > 0 : children !== undefined && children !== null && children !== '';
  if (kind === 'table') {
    if (!written && media.length === 0) return null;
    const label = strings.tableNumber(number ?? 0);
    return (
      <p className="table-caption" data-media={!written && media.length === 1 && media[0] ? media[0] : undefined}>
        {media.map((medium) => (
          <span key={medium ?? 'all'} className="caption-number" data-media={medium ?? undefined}>
            {label}
            {written ? ' ' : ''}
          </span>
        ))}
        {children}
      </p>
    );
  }
  if (media.length === 0 || number === null || !note) return null;
  const figure = note.items.figures.find((each) => each.number === number);
  return (
    <>
      {media.map((medium) => (
        <span key={medium ?? 'all'} className="figure-caption" data-media={medium ?? undefined}>
          <span className="caption-number">{strings.figureNumber(number)}</span> {figure && <FileLabel name={figure.name} title={figure.title} />}
        </span>
      ))}
    </>
  );
}
