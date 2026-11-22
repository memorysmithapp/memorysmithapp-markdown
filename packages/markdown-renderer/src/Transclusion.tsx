import { useEffect, useMemo, useState } from 'react';
import { useHost, type EmbeddedNote, type ResolvedHost } from './host.js';
import { Markdown } from './Markdown.js';
import { drawSlot, useSlot } from './slots.js';
import { bodyStart, hideComments, resolveWikilinks } from './source.js';
import { blockOf, demoteEmbeds, isBlockAnchor, sectionOf } from './embeds.js';
import { wikilinkAddress } from './wikilink-address.js';
import { drawing, drawnNote, embedsFile, embedTarget, type EmbedTarget } from './embed-target.js';
import { ContentsContext, EMBEDDED } from './ContentsBlock.js';

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
 * What an embed reaches, or `null` while the host's `choose` is asked. Decided at once in every case
 * but one, so a server's render draws the pending marker of a target nothing answers.
 */
function useDecision(host: ResolvedHost, name: string): EmbedTarget | null {
  const answer = useMemo(() => embedTarget(host, name), [host, name]);
  const [settled, setSettled] = useState<{ answer: Promise<EmbedTarget>; target: EmbedTarget } | null>(null);
  useEffect(() => {
    if (!(answer instanceof Promise)) return;
    let alive = true;
    answer.then(
      (target) => alive && setSettled({ answer, target }),
      () => alive && setSettled({ answer, target: { kind: 'pending' } }),
    );
    return () => {
      alive = false;
    };
  }, [answer]);
  if (!(answer instanceof Promise)) return answer;
  return settled?.answer === answer ? settled.target : null;
}

/**
 * One transcluded block: the content of another note, shown in place.
 *
 * It always says where it came from. A passage pasted without provenance is
 * indistinguishable from what the author wrote, and a notebook rests on
 * knowing who asserted what.
 */
export function Transclusion({ target, anchor, source }: { target: string; anchor: string | null; source?: string }) {
  const host = useHost();
  const { strings } = host;
  const name = target.normalize('NFC');
  // A transclusion expands ONE note, so it expands what a wikilink would
  // navigate to: an ambiguous target is a choice a reader makes and not a
  // passage the page can inline on their behalf. What it reaches is decided
  // at once, unless the note being drawn carries the name and only the host's
  // `choose` can say which other note is left (§5.2, #147).
  const decided = useDecision(host, name);
  const load = decided?.kind === 'note' ? decided.load : null;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const slot = useSlot('embed');

  useEffect(() => {
    if (!load) return;
    let alive = true;
    setLoaded({ state: 'loading' });
    load().then(
      (note) => alive && setLoaded(note ? { state: 'ready', note } : { state: 'missing' }),
      () => alive && setLoaded({ state: 'missing' }),
    );
    return () => {
      alive = false;
    };
  }, [load]);

  // The note itself was the only note its own name matched, and the notebook
  // keeps a file of that name: the embed is the file's, drawn as written.
  if (decided?.kind === 'file') {
    const written = source ?? `![[${target}${anchor ? `#${anchor}` : ''}]]`;
    return <Markdown>{resolveWikilinks(written, (each) => wikilinkAddress(host, each), () => true)}</Markdown>;
  }

  // The same pending marker a wikilink uses. A notebook is read most while it
  // is still being written, so a target that does not exist yet is an
  // expected state and never an error that stops the page.
  if ((decided !== null && !load) || loaded.state === 'missing') {
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

  // Inside the embedded note, an embed of ITS name is read as that note reads it.
  const inner = drawing(host, drawnNote(note.address, note.markdown));
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
      // An embed draws another note's content; the apparatus of navigation is the open note's (#173).
      <ContentsContext.Provider value={EMBEDDED}>
        <Markdown>
          {resolveWikilinks(
            demoteEmbeds(cut, embedsFile(inner)),
            (each) => wikilinkAddress(host, each),
            embedsFile(inner),
          )}
        </Markdown>
      </ContentsContext.Provider>
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
