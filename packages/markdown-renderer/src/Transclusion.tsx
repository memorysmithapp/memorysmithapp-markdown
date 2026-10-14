import { useEffect, useState } from 'react';
import { useHost, type EmbeddedNote } from './host.js';
import { Markdown } from './Markdown.js';
import { drawSlot, useSlot } from './slots.js';
import { bodyStart, hideComments, resolveWikilinks } from './markdown.js';
import { blockOf, demoteEmbeds, isBlockAnchor, sectionOf } from './transclusion.js';
import { wikilinkAddress } from './wikilink-address.js';

/** The shape of what is coming, in the position it will occupy, while the host answers. */
function TransclusionSkeleton({ loading }: { loading: string }) {
  return (
    <div className="skeleton-region" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{loading}</span>
      <figure className="embed embed-skeleton">
        <div className="embed-body">
          <span className="skeleton-text">
            <span className="skeleton" style={{ width: '96%', height: '1rem' }} />
            <span className="skeleton" style={{ width: '58%', height: '1rem' }} />
          </span>
        </div>
        <figcaption className="embed-source">
          <span className="skeleton" style={{ width: '8rem', height: '0.8rem' }} />
        </figcaption>
      </figure>
    </div>
  );
}

type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; note: EmbeddedNote };

/**
 * One transcluded block: the content of another note, shown in place.
 *
 * It always says where it came from. A passage pasted without provenance is
 * indistinguishable from what the author wrote, and a notebook rests on
 * knowing who asserted what.
 */
export function Transclusion({ target, anchor }: { target: string; anchor: string | null }) {
  const host = useHost();
  const { strings } = host;
  const name = target.normalize('NFC');
  // A transclusion expands ONE note, so it expands what a wikilink would
  // navigate to: an ambiguous target is a choice a reader makes and not a
  // passage the page can inline on their behalf.
  const one = host.loadNote !== null && host.reaches(name) === 1;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const slot = useSlot('embed');

  useEffect(() => {
    if (!one || !host.loadNote) return;
    let alive = true;
    setLoaded({ state: 'loading' });
    host.loadNote(name).then(
      (note) => alive && setLoaded(note ? { state: 'ready', note } : { state: 'missing' }),
      () => alive && setLoaded({ state: 'missing' }),
    );
    return () => {
      alive = false;
    };
  }, [one, host, name]);

  // The same pending marker a wikilink uses. A notebook is read most while it
  // is still being written, so a target that does not exist yet is an
  // expected state and never an error that stops the page.
  if (!one || loaded.state === 'missing') {
    const marker = (
      <p className="embed-pending">
        <span className="wikilink-pending" title={strings.pendingLink}>
          {target}
        </span>
      </p>
    );
    return slot ? drawSlot(slot, { state: 'pending', target, anchor, caption: null, children: marker }) : marker;
  }

  if (loaded.state === 'loading') {
    const skeleton = <TransclusionSkeleton loading={strings.loading} />;
    return slot ? drawSlot(slot, { state: 'loading', target, anchor, caption: null, children: skeleton }) : skeleton;
  }

  const { note } = loaded;
  const whole = hideComments(note.markdown.slice(bodyStart(note.markdown))).text;
  // The caption names the note the content came from, and a note may have no
  // name.
  const sourceLabel = note.name ?? strings.unnamedNote;
  // `#^id` addresses a BLOCK and `#Section` a heading. The two are told apart
  // by the marker and not by trying one and falling back to the other, or a
  // section named `^x` and a block called `x` would answer for each other.
  const cut = !anchor ? whole : isBlockAnchor(anchor) ? blockOf(whole, anchor.slice(1)) : sectionOf(whole, anchor);
  const caption = anchor ? `${sourceLabel} › ${anchor}` : sourceLabel;
  const named = note.address === null ? caption : host.renderLink({ href: note.address, children: caption });

  const content =
    cut === null ? (
      <p className="embed-missing">{strings.embedSectionMissing(anchor ?? '')}</p>
    ) : (
      /**
       * Resolved, like every other run of the note. Without this every
       * `[[link]]` inside transcluded content reached the page with its
       * brackets — and the sharpest case is the one the one-level rule
       * creates itself: `demoteEmbeds` turns an embed found in embedded
       * content into a wikilink, and that embed is drawn as A LINK to its
       * target. Raw text is not a link.
       */
      <Markdown>
        {resolveWikilinks(
          demoteEmbeds(cut, host.keeps),
          (each) => wikilinkAddress(host, each),
          host.keeps,
        )}
      </Markdown>
    );

  if (slot) {
    return drawSlot(slot, {
      state: cut === null ? 'section-missing' : 'ready',
      target,
      anchor,
      caption: named,
      children: content,
    });
  }

  return (
    <figure className="embed">
      <div className="embed-body">{content}</div>
      <figcaption className="embed-source">{named}</figcaption>
    </figure>
  );
}
