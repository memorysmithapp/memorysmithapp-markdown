import type { AnchorHTMLAttributes, MouseEvent } from 'react';

/**
 * A link to a place in the same note: a footnote and its way back (§7.12), an entry of a contents
 * (§7.17), or an anchor an author wrote.
 *
 * It must not open the whole page in another tab, and a bare hash is not enough either: a host may
 * scroll the note inside a pane of its own rather than the window, and an embedded note renders the
 * same identifiers a second time. So the target is looked up inside the note the link was drawn in,
 * and brought into view in whatever scrolls it; the address of the page does not change, because
 * nothing was navigated.
 *
 * The target is the element of that id, else the heading whose slug it is (`data-heading`): an
 * author writes `#the-section`, and a heading of the note carries it as its id with a prefix,
 * while a heading inside an embed carries no id at all (#173).
 */
export function InPageAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    const target = inPageTarget(event.currentTarget, href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'center' });
  };
  return (
    <a href={href} onClick={follow} {...rest}>
      {children}
    </a>
  );
}

/** The element a link to `#id` drawn at `link` lands on, in the note or the embed it is drawn in. */
export function inPageTarget(link: Element, href: string): HTMLElement | null {
  const id = decodeURIComponent(href.slice(1));
  // The note is the root `NoteBody` draws, since a footnote's way back may cross runs; inside an
  // embed it is the embed's own run. A match inside an embed answers only a link inside that same embed.
  const embed = link.closest('.embed');
  const note = embed ? link.closest('.markdown') : (link.closest('.markdown[data-theme]') ?? link.closest('.markdown'));
  const within = (selector: string): HTMLElement | null =>
    ([...(note?.querySelectorAll(selector) ?? [])].find((candidate) => candidate.closest('.embed') === embed) as HTMLElement | undefined) ?? null;
  return within(`[id="${CSS.escape(id)}"]`) ?? within(`[data-heading="${CSS.escape(id)}"]`);
}
