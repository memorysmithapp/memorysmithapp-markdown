/**
 * A note's contents drawn (`SPEC.md` §7.17, #173): the lists a `contents` block, or the host's
 * settings, resolve to, in the medium the note is drawn for.
 *
 * Which note is drawn is a context: `NoteBody` provides the note's outline and what each of its
 * blocks resolves to; an embed provides `embedded`, where a block draws nothing, the apparatus of
 * navigation being the open note's alone; and with neither — a run drawn on its own — a block is
 * the code block it is in any other reader.
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
import { useHost } from './host.js';
import { InPageAnchor } from './InPageAnchor.js';
import { samePlan, type ContentsList, type ContentsMedium, type ContentsPlace, type ContentsPlan } from './contents.js';
import type { OutlineHeading } from './outline.js';

/** What each `contents` block of a note draws, by medium. */
export interface BlockPlans {
  readonly screen: ContentsPlan | null;
  readonly print: ContentsPlan | null;
}

/** The note a contents is drawn in. */
export type ContentsScope =
  | {
      readonly kind: 'note';
      readonly headings: readonly OutlineHeading[];
      /** What each block of the note draws, by its ordinal. */
      readonly blocks: readonly BlockPlans[];
      readonly printing: boolean;
    }
  | { readonly kind: 'embedded' };

export const ContentsContext = createContext<ContentsScope | null>(null);

/** The scope of an embedded note, where no contents is drawn. */
export const EMBEDDED: ContentsScope = { kind: 'embedded' };

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
    return print ? <ContentsNav plan={print} headings={scope.headings} medium={null} /> : null;
  }
  const screen = at(plans.screen);
  const print = at(plans.print);
  if (screen && print && samePlan(screen, print)) return <ContentsNav plan={screen} headings={scope.headings} medium={null} />;
  return (
    <>
      {screen && <ContentsNav plan={screen} headings={scope.headings} medium="screen" />}
      {print && <ContentsNav plan={print} headings={scope.headings} medium="print" />}
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

/** A heading's inlines, as its entry draws them. */
function entryContent(heading: OutlineHeading): ReactNode {
  const tree = toHast({ type: 'paragraph', children: heading.content } as unknown as MdastNodes);
  const inlines = tree.type === 'element' ? { type: 'root' as const, children: tree.children } : tree;
  return toJsxRuntime(inlines as Parameters<typeof toJsxRuntime>[0], { Fragment, jsx, jsxs });
}

function Entries({ branches }: { branches: readonly Branch[] }) {
  return (
    <ol className="contents-entries">
      {branches.map(({ heading, children }) => (
        <li key={heading.id} className="contents-item">
          <InPageAnchor href={`#${heading.id}`} className="contents-entry">
            {entryContent(heading)}
          </InPageAnchor>
          {children.length > 0 && <Entries branches={children} />}
        </li>
      ))}
    </ol>
  );
}

/** One drawn contents: each of its lists under its title. */
function ContentsNav({ plan, headings, medium }: { plan: ContentsPlan; headings: readonly OutlineHeading[]; medium: ContentsMedium | null }) {
  const { strings } = useHost();
  const titles: Record<ContentsList, string> = { headings: strings.contentsHeadings };
  return (
    <nav className="contents" data-media={medium ?? undefined}>
      {plan.lists.map((list) => {
        const title = list.title ?? titles[list.kind];
        return (
          <section key={list.kind} className="contents-list" data-list={list.kind} aria-label={title}>
            <p className="contents-title">{title}</p>
            {list.kind === 'headings' && headings.length > 0 && <Entries branches={branches(headings, list.depth)} />}
          </section>
        );
      })}
    </nav>
  );
}
