/**
 * The blocks the editor draws in place of their text while the author is not editing it, each
 * drawn by the reading surface's own components so that edit mode looks like the page (ADR-006):
 * a run of notation through `Markdown`, a callout with its type and folding controls, a table
 * whose cells are edited where they stand (#56), and the frontmatter as a form (#58).
 *
 * Every edit they make is a change to the note's bytes, dispatched to the editor; none of them
 * keeps a copy of the note.
 */

import { ChangeSet } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { useHost } from '../host.js';
import { Markdown } from '../Markdown.js';
import { hideComments, resolveWikilinks } from '../markdown.js';
import { isTrue, readProperties } from '../properties.js';
import { Transclusion } from '../Transclusion.js';
import { splitEmbeds } from '../transclusion.js';
import { wikilinkAddress } from '../wikilink-address.js';
import type { Dimensions } from '../image-dimensions.js';
import { ICON_OWN_SIZE, ICON_RATIO_FREE, ICON_RATIO_LOCKED, ICON_RESIZE } from '../mode-icons.js';
import { describeImage, MAX_IMAGE_WIDTH, readImageSize, resizeImage } from './image-size.js';
import {
  addEntry,
  readFrontmatter,
  removeEntry,
  renameKey,
  setList,
  setScalar,
  type Frontmatter,
} from './frontmatter.js';
import {
  addColumn,
  addRow,
  alignColumn,
  columnCount,
  readTable,
  removeColumn,
  removeRow,
  setCell,
  type Alignment,
  type Table,
  type TextChange,
} from './table.js';

/** Whether a block's edit is being applied: the block is drawn anew, and the field it held lets the focus go. */
let writing = false;

/**
 * Applies changes to the note, as one step of its history.
 *
 * An edit draws its block again, and the field that held the focus is taken out of the page while
 * the editor updates; the browser tells it it lost the focus, and it would commit what it holds a
 * second time, inside that update. That second commit is the first one again, so it is dropped —
 * and so is any commit that arrives while the editor is updating for another reason.
 */
function write(view: EditorView, changes: readonly TextChange[] | ChangeSet, event = 'input.form'): void {
  const empty = changes instanceof ChangeSet ? changes.empty : changes.length === 0;
  if (empty || view.state.readOnly || writing) return;
  writing = true;
  try {
    view.dispatch({ changes: changes instanceof ChangeSet ? changes : [...changes], userEvent: event });
  } catch (error) {
    if (!(error instanceof Error && /update is in progress/.test(error.message))) throw error;
  } finally {
    writing = false;
  }
}

/** A run of notation drawn as the reading surface draws it: comments out, wikilinks resolved, embeds expanded. */
export function Snippet({ text }: { text: string }) {
  const host = useHost();
  const body = hideComments(text).text;
  return (
    <>
      {splitEmbeds(body, host.keeps).map((segment, index) =>
        segment.kind === 'text' ? (
          <Markdown key={index}>{resolveWikilinks(segment.text, (name) => wikilinkAddress(host, name), host.keeps)}</Markdown>
        ) : (
          <Transclusion key={index} target={segment.target} anchor={segment.anchor} />
        ),
      )}
    </>
  );
}

/** A small button of the editor's own, outside the note's notation. */
function Control({
  label,
  onClick,
  children,
  pressed,
  disabled,
  focusable = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  /**
   * Whether a press gives it the focus. A control of a block keeps the focus in the text, unless the
   * caret there is far from it: an image's controls take the focus, or the editor, focused, would
   * draw its caret again after the write and scroll the page to it, away from the image (#107).
   */
  focusable?: boolean;
}) {
  return (
    <button
      type="button"
      className="edit-control"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-ms-control=""
      onMouseDown={focusable ? undefined : (event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Callouts ─────────────────────────────────────────────────────────────────

/** The types a callout may take from the toolbar: the families the default theme draws. */
export const CALLOUT_TYPES = [
  'note', 'info', 'todo', 'abstract', 'tip', 'success', 'question', 'warning', 'failure', 'danger', 'bug', 'example', 'quote',
] as const;

/**
 * A callout drawn as the page draws it, with its type and its folding chosen in place: each
 * choice rewrites the marker `[!type]±` of its first line and nothing else (#55).
 */
export function CalloutBlock({ view, text, marker }: { view: EditorView; text: string; marker: { from: number; to: number; type: string; fold: '+' | '-' | null } }) {
  const { strings } = useHost();
  const words = strings.editor;
  const types: string[] = CALLOUT_TYPES.includes(marker.type as (typeof CALLOUT_TYPES)[number]) ? [...CALLOUT_TYPES] : [marker.type, ...CALLOUT_TYPES];
  const rewrite = (type: string, fold: '+' | '-' | null) =>
    write(view, [{ from: marker.from, to: marker.to, insert: `[!${type}]${fold ?? ''}` }]);
  return (
    <div className="edit-block edit-callout">
      <div className="edit-block-controls" data-ms-control="">
        <select
          aria-label={words.calloutType}
          title={words.calloutType}
          value={marker.type}
          onChange={(event) => rewrite(event.target.value, marker.fold)}
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {strings.callouts[type] ?? type}
            </option>
          ))}
        </select>
        <select
          aria-label={words.fold}
          title={words.fold}
          value={marker.fold ?? ''}
          onChange={(event) => rewrite(marker.type, (event.target.value || null) as '+' | '-' | null)}
        >
          <option value="">{words.foldNone}</option>
          <option value="+">{words.foldOpen}</option>
          <option value="-">{words.foldClosed}</option>
        </select>
      </div>
      <Snippet text={text} />
    </div>
  );
}

// ── Images ───────────────────────────────────────────────────────────────────

/** The narrowest an image is sized to, by a field or the handle: something a reader still sees (#105). */
export const MIN_IMAGE_SIZE = 16;

/** How long after a pointer or a touch on its controls a click on the image is not taken as one to edit its source (#107). */
const CONTROLS_GUARD_MS = 800;

/** How long after a control of an image writes the image is held where it was on the screen (#107). */
const SCROLL_HOLD_MS = 600;
/** A move of the image larger than this, in that moment, is the browser's and not the author's. */
const SCROLL_JUMP = 120;

/**
 * Holds the image where it is on the screen while one of its controls writes (#107). The write draws
 * the image again for its new source, which takes the control that had the focus out of the page,
 * and Chrome on a touch screen then scrolls the page a screen or more away, with no script asking
 * it to: the image and its controls were gone from sight (*observed* in the playground, Pixel 7,
 * 2026-10-16). For a moment after the write, a move of the image larger than a jump is undone, by
 * scrolling what the editor scrolls in — a pane of the host, or the window — by as much.
 */
function holdInPlace(view: EditorView, block: HTMLElement, run: () => void): void {
  const top = block.getBoundingClientRect().top;
  let scroller: HTMLElement | null = view.scrollDOM;
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
  const scrolled = () => (scroller ? scroller.scrollTop : window.scrollY);
  const before = scrolled();
  const back = () => {
    // The editor lets go of a block it scrolled out of its viewport: the page goes back to where it was.
    const moved = block.isConnected ? block.getBoundingClientRect().top - top : before - scrolled();
    if (Math.abs(moved) <= SCROLL_JUMP) return;
    if (scroller) scroller.scrollBy(0, moved);
    else window.scrollBy(0, moved);
  };
  run();
  window.addEventListener('scroll', back, true);
  setTimeout(() => window.removeEventListener('scroll', back, true), SCROLL_HOLD_MS);
}

/** The range a field accepts, in its unit. */
interface Range {
  readonly min: number;
  readonly max: number;
}

/** A number as a field holds it: digits and nothing else, or `null`. */
function wholeNumber(text: string): number | null {
  return /^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : null;
}

/**
 * An image drawn in edit mode with what its notation writes set in place (#98, #106): its width and
 * its height with a lock between them — locked, the height follows and only the width is written,
 * `|300`; open, both are, `|300x180` — the width's unit, pixels or a share of the page (`|50%`,
 * #108), its description for a Markdown image, a button back to its own size, and a handle at its
 * corner that drags it, keeping the proportion or, with the lock open or Shift held, not. Each
 * writes the dimensions or the description of its notation, and no other byte.
 *
 * A field selects what it holds when it takes the focus, so typing replaces it, and writes on Enter
 * or when it is left; Escape leaves the note as it is. A value outside the range a reader can see
 * — from 16 pixels to the column or the image's own width, the wider — is refused where it was
 * typed, never brought into the range and written (#105).
 *
 * The controls stand under the picture, never over it, and nothing that starts on them or in the
 * moment after reaches the click that shows the image's source (#107): they are all marked as
 * controls, gaps included, and the frame is marked busy while one of them has the focus, while the
 * handle is dragged and for a moment after a pointer or a touch on them.
 *
 * Sized in place, as a table is edited in place, the image shows its source only from a button among
 * its controls or when the caret reaches it from the keyboard; a click on the picture shows nothing (#112).
 *
 * The controls appear once an image is drawn inside it, so an embed of a file that is not an image,
 * or a host's own drawing without one, offers none.
 */
export function ImageBlock({ view, source, children }: { view: EditorView; source: string; children?: ReactNode }) {
  const words = useHost().strings.editor;
  const frame = useRef<HTMLSpanElement>(null);
  const size = readImageSize(source);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [locked, setLocked] = useState(() => size?.height == null);
  const [unit, setUnit] = useState<'px' | '%'>(() => (size?.percent == null ? 'px' : '%'));
  const [typed, setTyped] = useState<{ width?: string; height?: string; description?: string }>({});
  const [refused, setRefused] = useState<{ field: 'width' | 'height'; range: Range } | null>(null);
  const [dragged, setDragged] = useState<{ width: number; height: number } | null>(null);
  const [shift, setShift] = useState(false);
  const drag = useRef<{ x: number; y: number; width: number; height: number; pointer: number } | null>(null);
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);

  // An embed's image arrives when the host answers; the controls wait for it.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const look = () => setImage(element.querySelector<HTMLImageElement>('img'));
    look();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(look);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!image) return;
    const read = () => setNatural(image.naturalWidth && image.naturalHeight ? { width: image.naturalWidth, height: image.naturalHeight } : null);
    read();
    image.addEventListener('load', read);
    return () => image.removeEventListener('load', read);
  }, [image]);
  useEffect(() => () => {
    if (guard.current) clearTimeout(guard.current);
  }, []);
  // The handle and the controls are placed by the picture itself, not by the frame, which also holds
  // its margins and, in an embed, a paragraph's: its bottom right corner is where the handle goes.
  useEffect(() => {
    const element = frame.current;
    if (!image || !element) return;
    const place = () => {
      const outer = element.getBoundingClientRect();
      const inner = image.getBoundingClientRect();
      element.style.setProperty('--edit-image-bottom', `${Math.round(inner.bottom - outer.top)}px`);
      element.style.setProperty('--edit-image-right', `${Math.round(inner.right - outer.left)}px`);
    };
    place();
    image.addEventListener('load', place);
    if (typeof ResizeObserver === 'undefined') return () => image.removeEventListener('load', place);
    const observer = new ResizeObserver(place);
    observer.observe(image);
    observer.observe(element);
    return () => {
      image.removeEventListener('load', place);
      observer.disconnect();
    };
  }, [image]);

  /** Marks the frame busy for a moment, so the click a touch or a pointer leaves behind reveals nothing (#107). */
  const hold = () => {
    const element = frame.current;
    if (!element) return;
    element.dataset['msBusy'] = '';
    if (guard.current) clearTimeout(guard.current);
    guard.current = setTimeout(() => {
      if (!element.matches(':focus-within') && !drag.current) delete element.dataset['msBusy'];
    }, CONTROLS_GUARD_MS);
  };

  /** The width the note is read at, where the image stands: what a share of the page is a share of. */
  const column = (): number | null => {
    const content = frame.current?.closest<HTMLElement>('.cm-content') ?? null;
    const width = content ? content.clientWidth - parseFloat(getComputedStyle(content).paddingLeft || '0') - parseFloat(getComputedStyle(content).paddingRight || '0') : 0;
    return width > 0 ? Math.round(width) : null;
  };
  /** The image as it is drawn now, or `null` before it is laid out. */
  const drawn = (): { width: number; height: number } | null => {
    const box = image?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  };
  /** Its proportion, height over width: its own, else as it is drawn. */
  const ratio = (): number | null => {
    const shape = natural ?? drawn();
    return shape ? shape.height / shape.width : null;
  };
  /** What a field accepts (#105): a share from 1% to 100%, or pixels a reader sees, up to the column or the image's own size. */
  const rangeOf = (field: 'width' | 'height'): Range => {
    if (field === 'width' && unit === '%') return { min: 1, max: 100 };
    const widest = Math.max(column() ?? 0, natural?.width ?? 0);
    const width = widest > 0 ? widest : MAX_IMAGE_WIDTH;
    if (field === 'width') return { min: MIN_IMAGE_SIZE, max: width };
    const proportion = ratio();
    const tallest = Math.max(proportion === null ? 0 : Math.ceil(width * proportion), natural?.height ?? 0);
    return { min: MIN_IMAGE_SIZE, max: tallest > 0 && widest > 0 ? tallest : MAX_IMAGE_WIDTH };
  };

  const apply = (changes: readonly TextChange[]) => {
    const widget = frame.current?.closest<HTMLElement>('.cm-ms-inline-block, .cm-ms-block');
    if (!widget || changes.length === 0) return;
    const from = view.posAtDOM(widget);
    // The widget stands where its source was: anything else means the note moved under it.
    if (view.state.sliceDoc(from, from + source.length) !== source) return;
    holdInPlace(view, widget, () => write(view, changes.map((change) => ({ ...change, from: change.from + from, to: change.to + from }))));
  };
  const resize = (dimensions: Dimensions | null) => apply(resizeImage(source, 0, dimensions));

  /** The width it is written or drawn at, in pixels, for a height written beside it. */
  const widthNow = (): number | null => size?.width ?? drawn()?.width ?? natural?.width ?? null;

  /** Writes what a field holds, or refuses it in place; `true` when the field may let go of what was typed. */
  const commit = (field: 'width' | 'height'): boolean => {
    const text = typed[field];
    if (text === undefined) return true;
    if (text.trim() === '') {
      // Empty is "not set": no width is its own size, no height a width alone (#106).
      setTyped((now) => ({ ...now, [field]: undefined }));
      setRefused(null);
      if (field === 'width') resize(null);
      else if (size?.width != null) resize({ width: size.width, height: null, percent: null });
      return true;
    }
    const value = wholeNumber(text);
    const range = rangeOf(field);
    if (value === null || value < range.min || value > range.max) {
      setRefused({ field, range });
      return false;
    }
    setRefused(null);
    setTyped((now) => ({ ...now, [field]: undefined }));
    if (field === 'width') {
      if (unit === '%') resize({ width: null, height: null, percent: value });
      else if (locked) resize({ width: value, height: null, percent: null });
      else resize({ width: value, height: size?.height ?? drawn()?.height ?? null, percent: null });
    } else if (locked) {
      // A height typed under the lock sets the width that draws it, and only the width is written.
      const proportion = ratio();
      if (proportion !== null) resize({ width: Math.max(1, Math.round(value / proportion)), height: null, percent: null });
    } else {
      const width = widthNow();
      if (width !== null) resize({ width, height: value, percent: null });
    }
    return true;
  };
  const commitDescription = () => {
    const text = typed.description;
    if (text === undefined) return;
    setTyped((now) => ({ ...now, description: undefined }));
    apply(describeImage(source, 0, text));
  };

  const field = (name: 'width' | 'height' | 'description') => ({
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setTyped((now) => ({ ...now, [name]: value }));
      if (refused?.field === name) setRefused(null);
    },
    // Whatever takes it there — a click, a double click, Tab — the value is selected, so what is typed replaces it (#105).
    onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
    onMouseUp: (event: MouseEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      if (document.activeElement === input && input.selectionStart === input.selectionEnd && typed[name] === undefined) {
        event.preventDefault();
        input.select();
      }
    },
    onDoubleClick: (event: MouseEvent<HTMLInputElement>) => event.currentTarget.select(),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (name === 'description') commitDescription();
        else if (commit(name)) event.currentTarget.select();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setTyped((now) => ({ ...now, [name]: undefined }));
        setRefused(null);
      }
    },
    onBlur: () => {
      if (name === 'description') commitDescription();
      // A value refused is let go when the field is left, and the note keeps what it held.
      else if (!commit(name)) {
        setTyped((now) => ({ ...now, [name]: undefined }));
        setRefused(null);
      }
    },
  });

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    // Locked, the height follows the width: one written beside it goes (#106).
    if (next && size?.height != null && size.width !== null) resize({ width: size.width, height: null, percent: null });
  };
  const chooseUnit = (next: 'px' | '%') => {
    setUnit(next);
    setTyped((now) => ({ ...now, width: undefined }));
    setRefused(null);
    const now = drawn();
    const wide = column();
    // The size it is drawn at, said in the other unit, when it has one.
    if (next === '%' && size?.percent == null && size?.width != null && now && wide) {
      resize({ width: null, height: null, percent: Math.min(100, Math.max(1, Math.round((now.width / wide) * 100))) });
    } else if (next === 'px' && size?.percent != null && now) {
      resize({ width: now.width, height: null, percent: null });
    }
    if (next === '%') setLocked(true);
  };

  const free = (!locked && unit === 'px') || shift;
  const shownWidth = dragged ? (unit === '%' ? percentOf(dragged.width) : dragged.width) : unit === '%' ? size?.percent ?? null : size?.width ?? null;
  const shownHeight = dragged ? dragged.height : size?.height ?? (locked && size?.width != null && ratio() !== null ? Math.round(size.width * ratio()!) : null);
  function percentOf(width: number): number | null {
    const wide = column();
    return wide ? Math.min(100, Math.max(1, Math.round((width / wide) * 100))) : null;
  }

  const endDrag = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    drag.current = null;
    const end = drawn();
    setDragged(null);
    if (image) {
      image.style.width = '';
      image.style.height = '';
      image.style.maxWidth = '';
    }
    hold();
    if (cancelled || !end) return;
    if (Math.abs(end.width - start.width) < 1 && Math.abs(end.height - start.height) < 1) return;
    if (unit === '%') {
      const percent = percentOf(end.width);
      if (percent !== null) resize({ width: null, height: null, percent });
    } else if (free || event.shiftKey) resize({ width: end.width, height: end.height, percent: null });
    else resize({ width: end.width, height: null, percent: null });
  };

  /** Shows the image's notation, as a table's button does: the caret goes before it (#112). */
  const showSource = () => {
    const widget = frame.current?.closest<HTMLElement>('.cm-ms-inline-block, .cm-ms-block');
    if (widget) reveal(view, view.posAtDOM(widget));
  };

  const offered = size !== null && image !== null;
  const unitWord = unit === '%' ? '%' : 'px';
  const invalid = (name: 'width' | 'height') => (refused?.field === name ? { 'aria-invalid': true, title: words.imageOutOfRange(refused.range.min, refused.range.max, name === 'width' ? unitWord : 'px') } : {});
  return (
    <span
      ref={frame}
      className="edit-image"
      data-resizing={dragged === null ? undefined : ''}
      data-ms-in-place={offered ? '' : undefined}
      onFocus={() => frame.current && (frame.current.dataset['msBusy'] = '')}
      onBlur={hold}
      onMouseDown={(event) => {
        // The frame's own area is the space between the picture and its controls: a press there is
        // one meant for them, and shows nothing (#107).
        if (event.target === event.currentTarget) {
          event.preventDefault();
          hold();
        }
      }}
    >
      {children}
      {offered && (
        <>
          <span
            className="edit-image-controls"
            data-ms-control=""
            onPointerDown={hold}
            onTouchStart={hold}
            onMouseDown={(event) => {
              // A press anywhere but on a field, a choice or a button — a gap between them, the
              // padding, a word beside a field — keeps the focus where it is. Its default would put
              // the editor's caret where the press fell, and the image would show its source (#107).
              if (!(event.target as Element).closest('input, select, textarea, button')) event.preventDefault();
            }}
          >
            {size.description ? (
              <input
                className="edit-field edit-image-description"
                type="text"
                aria-label={words.imageDescription}
                title={words.imageDescription}
                placeholder={image.alt}
                value={typed.description ?? size.description.text}
                {...field('description')}
              />
            ) : (
              // An embed writes no description (§5.8): the file's own is shown, and is not edited here.
              <input
                className="edit-field edit-image-description"
                type="text"
                readOnly
                aria-label={words.imageDescription}
                title={words.imageDescription}
                placeholder={image.alt}
                value=""
              />
            )}
            <span className="edit-image-size">
              <input
                className="edit-field edit-image-width"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={words.imageWidth}
                title={words.imageWidth}
                placeholder={unit === '%' ? '' : natural === null ? '' : String(natural.width)}
                value={typed.width ?? (shownWidth === null ? '' : String(shownWidth))}
                {...field('width')}
                {...invalid('width')}
              />
              <select className="edit-image-unit" aria-label={words.imageUnit} title={words.imageUnit} value={unit} onChange={(event) => chooseUnit(event.target.value as 'px' | '%')}>
                <option value="px">px</option>
                <option value="%">%</option>
              </select>
              <Control label={locked ? words.imageKeepRatio : words.imageFreeRatio} onClick={toggleLock} pressed={locked} disabled={unit === '%'} focusable>
                {locked ? ICON_RATIO_LOCKED : ICON_RATIO_FREE}
              </Control>
              <input
                className="edit-field edit-image-height"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={words.imageHeight}
                title={words.imageHeight}
                disabled={unit === '%'}
                placeholder={natural === null || unit === '%' ? '' : String(natural.height)}
                value={unit === '%' ? '' : (typed.height ?? (shownHeight === null ? '' : String(shownHeight)))}
                {...field('height')}
                {...invalid('height')}
              />
              <span className="edit-image-unit-label" aria-hidden="true">
                px
              </span>
              <Control label={words.imageOwnSize} onClick={() => resize(null)} pressed={size.width === null && size.percent === null} focusable>
                {ICON_OWN_SIZE}
              </Control>
              <Control label={words.source} onClick={showSource}>
                {ICONS.source}
              </Control>
            </span>
            {refused && (
              <span className="edit-image-refused" role="status">
                {words.imageOutOfRange(refused.range.min, refused.range.max, refused.field === 'width' ? unitWord : 'px')}
              </span>
            )}
          </span>
          <span
            className="edit-image-handle"
            data-ms-control=""
            data-free={free ? '' : undefined}
            title={free ? words.imageResizeFree : words.imageResizeKeep}
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const now = drawn();
              if (!now) return;
              event.currentTarget.setPointerCapture?.(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, ...now, pointer: event.pointerId };
              if (frame.current) frame.current.dataset['msBusy'] = '';
              setShift(event.shiftKey);
              setDragged(now);
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!image || !start || start.pointer !== event.pointerId) return;
              setShift(event.shiftKey);
              const width = Math.max(MIN_IMAGE_SIZE, Math.round(start.width + event.clientX - start.x));
              image.style.maxWidth = '100%';
              image.style.width = `${width}px`;
              if ((!locked && unit === 'px') || event.shiftKey) {
                image.style.height = `${Math.max(MIN_IMAGE_SIZE, Math.round(start.height + event.clientY - start.y))}px`;
              } else image.style.height = 'auto';
              // What the page lets it be: never wider than the column.
              setDragged(drawn());
            }}
            onPointerUp={(event) => endDrag(event, false)}
            onPointerCancel={(event) => endDrag(event, true)}
          >
            {ICON_RESIZE}
          </span>
        </>
      )}
    </span>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

/** Where the focus goes back to when a table is drawn again after an edit of one of its cells. */
let pendingFocus: { from: number; row: number; column: number } | null = null;
/**
 * The cell a table's controls act on, kept across the table being drawn again: adding a column
 * redraws it, and the alignment chosen next is for the cell the author was in, not the first (#69).
 */
const chosenCells = new WeakMap<EditorView, { from: number; row: number; column: number }>();

/**
 * A table whose cells are edited where they stand. A cell commits its text when it loses the focus,
 * or on Enter (to the cell below) and Tab (to the next one); each commit rewrites that cell's
 * content only. The controls add and remove rows and columns and align the column of the cell last
 * focused.
 */
export function TableBlock({ view, from, to }: { view: EditorView; from: number; to: number }) {
  const { strings } = useHost();
  const words = strings.editor;
  const source = view.state.doc.sliceString(0, view.state.doc.length, '\n');
  const table = readTable(source, from, to);
  const width = columnCount(table);
  const [focus, setFocused] = useState<{ row: number; column: number }>(() => {
    const chosen = chosenCells.get(view);
    return chosen && chosen.from === table.from && chosen.row < table.rows.length && chosen.column < width
      ? { row: chosen.row, column: chosen.column }
      : { row: table.rows.length > 2 ? 2 : 0, column: 0 };
  });
  const setFocus = (cell: { row: number; column: number }) => {
    chosenCells.set(view, { from: table.from, ...cell });
    setFocused(cell);
  };
  // The cell being edited shows its source; every other one is drawn as the page draws it.
  const [editing, setEditing] = useState<{ row: number; column: number } | null>(null);
  const root = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (pendingFocus && pendingFocus.from === table.from) {
      const { row, column } = pendingFocus;
      pendingFocus = null;
      setEditing({ row, column });
      setFocus({ row, column });
    }
  });

  // A cell that starts being edited takes the focus, with the cursor at its end.
  useEffect(() => {
    if (!editing) return;
    const cell = root.current?.querySelector<HTMLElement>(`[data-row="${editing.row}"][data-column="${editing.column}"][contenteditable]`);
    if (!cell || document.activeElement === cell) return;
    cell.focus();
    const selection = window.getSelection();
    selection?.selectAllChildren(cell);
    selection?.collapseToEnd();
  }, [editing]);

  const commit = (row: number, column: number, value: string, next?: { row: number; column: number }, more: readonly TextChange[] = []) => {
    const changes = [...setCell(table, row, column, value), ...more];
    if (next) pendingFocus = { from: table.from, ...next };
    if (changes.length > 0) write(view, changes);
    else if (next) {
      pendingFocus = null;
      setEditing(next);
      setFocus(next);
    } else setEditing(null);
  };

  const onKey = (event: KeyboardEvent<HTMLElement>, row: number, column: number) => {
    const value = event.currentTarget.textContent ?? '';
    if (event.key === 'Enter') {
      event.preventDefault();
      const below = row === 0 ? 2 : row + 1;
      commit(row, column, value, below < table.rows.length ? { row: below, column } : undefined);
      if (below >= table.rows.length) event.currentTarget.blur();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      let nextColumn = column + step;
      let nextRow = row;
      if (nextColumn >= width) {
        nextColumn = 0;
        nextRow = row === 0 ? 2 : row + 1;
      } else if (nextColumn < 0) {
        nextColumn = width - 1;
        nextRow = row === 2 ? 0 : row - 1;
      }
      if (nextRow >= table.rows.length) {
        // Tab past the last cell adds a row and goes on in it, as a table does in a document.
        commit(row, column, value, { row: nextRow, column: 0 }, addRow(table, row));
      } else {
        commit(row, column, value, nextRow >= 0 && nextRow !== 1 ? { row: nextRow, column: nextColumn } : undefined);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.textContent = table.rows[row]?.cells[column]?.text ?? '';
      event.currentTarget.blur();
      view.focus();
    }
  };

  const cell = (row: number, column: number) => {
    const text = table.rows[row]?.cells[column]?.text ?? '';
    const Tag = row === 0 ? 'th' : 'td';
    const style = table.align[column] ? { textAlign: table.align[column] ?? undefined } : undefined;
    if (editing?.row !== row || editing.column !== column || view.state.readOnly) {
      return (
        <Tag key={column} style={style}>
          <span
            className="edit-cell edit-cell-drawn"
            role="button"
            tabIndex={0}
            aria-label={`${row === 0 ? 1 : row} · ${column + 1}`}
            data-row={row}
            data-column={column}
            data-ms-control=""
            onMouseDown={(event) => {
              if (event.metaKey || event.ctrlKey || view.state.readOnly) return;
              event.preventDefault();
              setFocus({ row, column });
              setEditing({ row, column });
            }}
            onFocus={() => setFocus({ row, column })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault();
                setEditing({ row, column });
              }
            }}
          >
            {/* A cell's escaped pipe is a pipe on the page, as GFM reads it. */}
            <Snippet text={text.replace(/\\\|/g, '|')} />
          </span>
        </Tag>
      );
    }
    return (
      <Tag key={column} style={style}>
        <span
          className="edit-cell"
          contentEditable={!view.state.readOnly}
          suppressContentEditableWarning
          role="textbox"
          aria-label={`${row === 0 ? 1 : row} · ${column + 1}`}
          data-row={row}
          data-column={column}
          data-ms-control=""
          onFocus={() => setFocus({ row, column })}
          onBlur={(event) => {
            commit(row, column, event.currentTarget.textContent ?? '');
            setEditing((current) => (current?.row === row && current.column === column ? null : current));
          }}
          onKeyDown={(event) => onKey(event, row, column)}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' '));
          }}
        >
          {text}
        </span>
      </Tag>
    );
  };

  /**
   * What a control of the table does, after the text of the cell being edited: the control keeps
   * the focus where it is, so the cell has not committed, and its text would go with the table
   * drawn again (#69). Both are one change, which one Undo takes back.
   */
  const act = (control: (current: Table) => readonly TextChange[]) => {
    const open = editing && root.current?.querySelector<HTMLElement>(`[data-row="${editing.row}"][data-column="${editing.column}"][contenteditable]`);
    const typed = open && editing ? setCell(table, editing.row, editing.column, open.textContent ?? '') : [];
    setEditing(null);
    if (typed.length === 0) return write(view, control(table));
    const first = view.state.changes([...typed]);
    const next = view.state.update({ changes: first }).state;
    const fresh = readTable(next.doc.sliceString(0, next.doc.length, '\n'), first.mapPos(table.from), first.mapPos(table.to));
    write(view, first.compose(next.changes([...control(fresh)])));
  };
  const align = (alignment: Alignment) => act((current) => alignColumn(current, focus.column, alignment));
  const bodyRows = table.rows.slice(2);

  return (
    <div className="edit-block edit-table">
      <div className="edit-block-controls" data-ms-control="">
        <Control label={words.addRow} onClick={() => act((current) => addRow(current, focus.row))}>
          {ICONS.rowAdd}
        </Control>
        <Control label={words.removeRow} onClick={() => act((current) => removeRow(current, focus.row))}>
          {ICONS.rowRemove}
        </Control>
        <Control label={words.addColumn} onClick={() => act((current) => addColumn(current, focus.column))}>
          {ICONS.columnAdd}
        </Control>
        <Control label={words.removeColumn} onClick={() => act((current) => removeColumn(current, focus.column))}>
          {ICONS.columnRemove}
        </Control>
        <Control label={words.alignLeft} pressed={table.align[focus.column] === 'left'} onClick={() => align(table.align[focus.column] === 'left' ? null : 'left')}>
          {ICONS.alignLeft}
        </Control>
        <Control label={words.alignCenter} pressed={table.align[focus.column] === 'center'} onClick={() => align(table.align[focus.column] === 'center' ? null : 'center')}>
          {ICONS.alignCenter}
        </Control>
        <Control label={words.alignRight} pressed={table.align[focus.column] === 'right'} onClick={() => align(table.align[focus.column] === 'right' ? null : 'right')}>
          {ICONS.alignRight}
        </Control>
        <Control
          label={words.source}
          onClick={() => {
            act(() => []);
            reveal(view, table.from);
          }}
        >
          {ICONS.source}
        </Control>
      </div>
      <div className="markdown">
        <table ref={root}>
          <thead>
            <tr>{Array.from({ length: width }, (_, column) => cell(0, column))}</tr>
          </thead>
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((_, index) => (
                <tr key={index}>{Array.from({ length: width }, (__, column) => cell(index + 2, column))}</tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

/** Shows a block as its text: the cursor goes into it, and the editor draws its source. */
export function reveal(view: EditorView, at: number): void {
  view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
  view.focus();
}

// ── Frontmatter ──────────────────────────────────────────────────────────────

/** A text field that commits on blur and on Enter, and goes back to what was written on Escape. */
function Field({
  value,
  label,
  onCommit,
  className,
  placeholder,
  multiline = false,
  type = 'text',
  size,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: 'text' | 'date';
  /** The width in characters, for a field that should be as wide as what it holds. */
  size?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const common = {
    className: `edit-field ${className ?? ''}`.trim(),
    'aria-label': label,
    title: label,
    placeholder,
    value: draft,
    'data-ms-control': '',
    onBlur: () => draft !== value && onCommit(draft),
  };
  if (multiline) {
    return (
      <textarea
        {...common}
        rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 60)))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(value);
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            (event.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    );
  }
  return (
    <input
      {...common}
      type={type}
      size={size}
      onChange={(event) => {
        setDraft(event.target.value);
        if (type === 'date' && event.target.value !== value && event.target.value !== '') onCommit(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setDraft(value);
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** A list value as chips, each removable, with a field that adds one on Enter. */
/**
 * A list's items as chips and the field that adds the next. `typing` says the author is still in
 * the field — an item added with Enter or a comma, the last taken back with Backspace — so the
 * field keeps the focus once the form is drawn again; an item committed by leaving it does not.
 */
function ListField({ items, label, onCommit }: { items: readonly string[]; label: string; onCommit: (items: string[], typing: boolean) => void }) {
  const { strings } = useHost();
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const add = (typing: boolean) => {
    const item = draft.trim();
    if (item.length === 0) return;
    setDraft('');
    onCommit([...items, item], typing);
  };
  return (
    <span className="prop-tags edit-list">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="prop-tag">
          {item}
          <button
            type="button"
            className="edit-chip-remove"
            data-ms-control=""
            aria-label={`${strings.editor.removeItem} ${item}`}
            title={strings.editor.removeItem}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCommit(items.filter((_, at) => at !== index), false)}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={field}
        className="edit-field edit-list-add"
        aria-label={`${strings.editor.addItem}: ${label}`}
        placeholder={strings.editor.addItem}
        value={draft}
        data-ms-control=""
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => add(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(true);
          }
          if (event.key === 'Backspace' && draft === '' && items.length > 0) onCommit(items.slice(0, -1), true);
        }}
      />
      {/* What is typed becomes an item; with nothing typed, the field takes the focus for it. */}
      <Control label={`${strings.editor.addItem} ${label}`} onClick={() => (draft.trim() === '' ? field.current?.focus() : add(true))}>
        {ICONS.add}
      </Control>
    </span>
  );
}

/** The value of one entry, edited by the shape it was read in (§6.3). */
function ValueField({ view, front, entry, written }: { view: EditorView; front: Frontmatter; entry: { key: string; shape: string; values: readonly string[] }; written: string }) {
  const { strings } = useHost();
  const label = `${strings.editor.propertyValue}: ${entry.key}`;
  if (entry.shape === 'list') {
    return (
      <ListField
        items={entry.values}
        label={entry.key}
        onCommit={(items, typing) => {
          if (typing) focusAfterDraw.set(view, entry.key);
          write(view, setList(front, entry.key, items));
        }}
      />
    );
  }
  if (entry.shape === 'boolean') {
    const value = entry.values[0] ?? 'false';
    // Chosen as reading draws it, Yes or No, and written in the words the author used: `true`/`false` or `yes`/`no`.
    const choose = (on: boolean) => {
      if (on === isTrue(value)) return;
      const yesNo = /^(yes|no)$/i.test(value);
      const word = yesNo ? (on ? 'yes' : 'no') : on ? 'true' : 'false';
      const cased = value === value.toUpperCase() ? word.toUpperCase() : value[0] === value[0]?.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word;
      write(view, setScalar(front, entry.key, cased));
    };
    return (
      <select
        className="edit-boolean"
        value={isTrue(value) ? 'yes' : 'no'}
        aria-label={label}
        title={label}
        data-ms-control=""
        onChange={(event) => choose(event.target.value === 'yes')}
      >
        <option value="yes">{strings.yes}</option>
        <option value="no">{strings.no}</option>
      </select>
    );
  }
  if (entry.shape === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(entry.values[0] ?? '')) {
    return <Field type="date" value={entry.values[0] ?? ''} label={label} onCommit={(value) => write(view, setScalar(front, entry.key, value))} />;
  }
  return (
    <Field
      value={entry.values[0] ?? written}
      label={label}
      multiline={entry.shape === 'prose'}
      onCommit={(value) => write(view, setScalar(front, entry.key, value))}
    />
  );
}

/**
 * The frontmatter as a form, drawn where the default theme draws the title and the properties:
 * the name as the title, then each entry with its key and its value by its shape. Each change
 * rewrites the lines of its entry only; a value the form cannot hold is edited as source.
 */
/** The types a new property is made with, each written as the notation of an empty value (#70). */
type NewPropertyType = 'text' | 'list' | 'boolean' | 'date';

function emptyValue(type: Exclude<NewPropertyType, 'list'>): string {
  if (type === 'boolean') return 'false';
  if (type === 'date') {
    const today = new Date();
    const two = (value: number) => String(value).padStart(2, '0');
    return `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`;
  }
  return '';
}

/** The type a property's value has, as the form offers it. */
function typeOf(shape: string): NewPropertyType {
  return shape === 'list' ? 'list' : shape === 'date' ? 'date' : shape === 'boolean' ? 'boolean' : 'text';
}

/**
 * A property given another type, its value carried over where the new type can hold it: a list's
 * items joined as text, a text split at its commas as a list's items; a value the new type
 * cannot hold becomes that type's empty one. Undo takes it back.
 */
function retype(front: Frontmatter, key: string, read: { shape: string; values: readonly string[] }, to: NewPropertyType): TextChange[] {
  const from = typeOf(read.shape);
  if (from === to) return [];
  const values = read.values.filter((value) => value.length > 0);
  if (to === 'list') {
    // A text splits at its commas, as a list joined as text was written.
    const items = from === 'boolean' ? [] : from === 'text' ? values.flatMap((value) => value.split(',')).map((item) => item.trim()).filter(Boolean) : values;
    return setList(front, key, items);
  }
  if (to === 'boolean') return setScalar(front, key, 'false');
  if (to === 'date') return setScalar(front, key, emptyValue('date'));
  return setScalar(front, key, from === 'list' ? values.join(', ') : '');
}

/**
 * The choice of a property's type, drawn as the icon of its type before its key: a select laid
 * over the icon, so it opens where the author looks and is reached by keyboard and named (#71).
 */
function TypeChoice({ value, label, onChoose }: { value: NewPropertyType; label: string; onChoose: (type: NewPropertyType) => void }) {
  const words = useHost().strings.editor;
  return (
    <>
      <select
        className="edit-type"
        aria-label={label}
        title={label}
        value={value}
        data-ms-control=""
        onChange={(event) => onChoose(event.target.value as NewPropertyType)}
      >
        <option value="text">{words.typeText}</option>
        <option value="list">{words.typeList}</option>
        <option value="boolean">{words.typeBoolean}</option>
        <option value="date">{words.typeDate}</option>
      </select>
      {/* Says the icon is a menu; the select laid over the icon covers it too (#73). */}
      <span className="edit-type-caret" aria-hidden="true">
        {ICONS.caret}
      </span>
    </>
  );
}

/**
 * The property whose value field takes the focus once the form is drawn again, per editor: one
 * just made (#70), or a list the author is adding items to.
 */
const focusAfterDraw = new WeakMap<EditorView, string>();

export function PropertiesBlock({ view, to }: { view: EditorView; to: number }) {
  const { strings } = useHost();
  const words = strings.editor;
  const source = view.state.doc.sliceString(0, view.state.doc.length, '\n');
  const front = readFrontmatter(source);
  const properties = readProperties(source.slice(0, to));
  const [adding, setAdding] = useState('');
  const [type, setType] = useState<NewPropertyType>('text');
  const box = useRef<HTMLDivElement>(null);

  // A property just made, or a list being typed in: its value field takes the focus, a list's the field of its next item.
  // The form is drawn into a widget the editor places after, so the focus waits for it to be there.
  useEffect(() => {
    const key = focusAfterDraw.get(view);
    if (!key || !front?.entries.some((entry) => entry.key === key)) return;
    const names = [`${words.propertyValue}: ${key}`, `${words.addItem}: ${key}`];
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const place = () => {
      const field = [...(box.current?.querySelectorAll<HTMLElement>('[aria-label]') ?? [])].find((each) => names.includes(each.getAttribute('aria-label') ?? ''));
      if (field?.isConnected) {
        focusAfterDraw.delete(view);
        field.focus();
      } else if (++tries < 10) timer = setTimeout(place, 16);
    };
    place();
    return () => clearTimeout(timer);
  });

  if (!front) return null;
  const nameEntry = front.entries.find((entry) => entry.key === 'name');
  const name = nameEntry ? source.slice(nameEntry.valueSpan.from, nameEntry.valueSpan.to).replace(/^(["'])([\s\S]*)\1$/, '$2') : '';
  const add = () => {
    const key = adding.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key)) return;
    setAdding('');
    focusAfterDraw.set(view, key);
    // A list starts inline and empty, so its first item is written as `key: [first]`.
    write(view, addEntry(front, key, type === 'list' ? [] : emptyValue(type)));
  };
  return (
    <div className="edit-block edit-properties" ref={box}>
      <div className="edit-block-controls" data-ms-control="">
        <Control label={words.source} onClick={() => reveal(view, 4)}>
          {ICONS.source}
        </Control>
      </div>
      <Field
        className="note-title edit-title"
        value={name}
        label={words.title}
        placeholder={strings.unnamedNote}
        onCommit={(value) => write(view, value.trim() === '' && nameEntry ? removeEntry(front, 'name') : setScalar(front, 'name', value.trim()))}
      />
      <div className="properties-box">
        <div className="metadata-container">
          {front.entries
            .filter((entry) => entry.key !== 'name')
            .map((entry) => {
              const found = properties.entries.find((each) => each.key === entry.key) ?? { key: entry.key, shape: 'empty', values: [] };
              // A list with no items is empty to the page, which draws nothing; to the form it is still a list.
              const read = found.shape === 'empty' && entry.form !== 'scalar' ? { ...found, shape: 'list' } : found;
              const kind = typeOf(read.shape);
              // The property itself is handled at its key — its type, its removal, its name — and its value at the value.
              return (
                <div key={entry.key} className="metadata-property edit-property" data-property-type={kind === 'boolean' ? 'checkbox' : kind}>
                  <span className="metadata-property-key">
                    <TypeChoice
                      value={kind}
                      label={`${words.propertyType}: ${entry.key}`}
                      onChoose={(to) => {
                        focusAfterDraw.set(view, entry.key);
                        write(view, retype(front, entry.key, read, to));
                      }}
                    />
                    {/* Before the name, so it stands in one column whatever the name's length (#72). */}
                    <Control label={`${words.removeProperty}: ${entry.key}`} onClick={() => write(view, removeEntry(front, entry.key))}>
                      {ICONS.remove}
                    </Control>
                    <Field
                      value={entry.key}
                      label={`${words.propertyKey}: ${entry.key}`}
                      className="edit-key"
                      size={Math.max(4, entry.key.length + 1)}
                      onCommit={(next) => write(view, renameKey(front, entry.key, next.trim()))}
                    />
                  </span>
                  <span className="metadata-property-value">
                    <ValueField view={view} front={front} entry={read} written={source.slice(entry.valueSpan.from, entry.valueSpan.to)} />
                  </span>
                </div>
              );
            })}
          <div className="metadata-property edit-property edit-property-new" data-property-type={type === 'boolean' ? 'checkbox' : type}>
            <span className="metadata-property-key">
              <TypeChoice value={type} label={`${words.propertyType}: ${words.addProperty}`} onChoose={setType} />
              {/* The room of a property's remove button, so the new name lines up with the others. */}
              <span className="edit-control edit-key-spacer" aria-hidden="true">
                {ICONS.remove}
              </span>
              <input
                className="edit-field edit-key"
                size={Math.max(words.addProperty.length, adding.length + 1)}
                aria-label={words.addProperty}
                placeholder={words.addProperty}
                value={adding}
                data-ms-control=""
                onChange={(event) => setAdding(event.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
                onKeyDown={(event) => event.key === 'Enter' && add()}
              />
            </span>
            <span className="metadata-property-value">
              <Control label={words.addProperty} onClick={add}>
                {ICONS.add}
              </Control>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The control a note with no frontmatter shows above its body, which gives it one. */
export function AddProperties({ view }: { view: EditorView }) {
  const { strings } = useHost();
  return (
    <div className="edit-add-properties">
      <button
        type="button"
        className="edit-control edit-control-labelled"
        data-ms-control=""
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => write(view, [{ from: 0, to: 0, insert: '---\n---\n' }])}
      >
        {ICONS.add}
        <span>{strings.editor.addProperties}</span>
      </button>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

/** Lucide's outlines (ISC), drawn in the current colour at the size of the text. */
function icon(...paths: string[]): ReactNode {
  return (
    <svg className="edit-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICONS = {
  add: icon('M5 12h14', 'M12 5v14'),
  remove: icon('M18 6 6 18', 'm6 6 12 12'),
  source: icon('m16 18 6-6-6-6', 'm8 6-6 6 6 6'),
  rowAdd: icon('M3 12h18', 'M3 6h18', 'M12 15v6', 'M9 18h6'),
  rowRemove: icon('M3 12h18', 'M3 6h18', 'M9 18h6'),
  columnAdd: icon('M12 3v18', 'M6 3v18', 'M15 12h6', 'M18 9v6'),
  columnRemove: icon('M12 3v18', 'M6 3v18', 'M15 12h6'),
  alignLeft: icon('M21 6H3', 'M15 12H3', 'M17 18H3'),
  alignCenter: icon('M21 6H3', 'M17 12H7', 'M19 18H5'),
  alignRight: icon('M21 6H3', 'M21 12H9', 'M21 18H7'),
  undo: icon('M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'),
  redo: icon('m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13'),
  bold: icon('M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'),
  italic: icon('M19 4h-9', 'M14 20H5', 'M15 4 9 20'),
  strikethrough: icon('M16 4H9a3 3 0 0 0-2.83 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'),
  highlight: icon('m9 11-6 6v3h9l3-3', 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'),
  code: icon('m18 16 4-4-4-4', 'm6 8-4 4 4 4', 'm14.5 4-5 16'),
  link: icon('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
  wikilink: icon('M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
  bulletList: icon('M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'),
  orderedList: icon('M10 12h11', 'M10 18h11', 'M10 6h11', 'M4 10h2', 'M4 6h1v4', 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'),
  taskList: icon('m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8'),
  quote: icon('M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z', 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z'),
  callout: icon('M12 16v-4', 'M12 8h.01', 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  table: icon('M12 3v18', 'M3 9h18', 'M3 15h18', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
  codeBlock: icon('M10 9.5 8 12l2 2.5', 'm14 9.5 2 2.5-2 2.5', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
  math: icon('M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2'),
  diagram: icon('M5 3h4v4H5z', 'M15 17h4v4h-4z', 'M7 7v4a2 2 0 0 0 2 2h6a2 2 0 0 1 2 2v2'),
  rule: icon('M5 12h14'),
  footnote: icon('M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M19 13v6', 'M17 15l2-2'),
  comment: icon('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'),
  caret: icon('m6 9 6 6 6-6'),
  cut: icon('M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M20 4 8.12 15.88', 'M14.47 14.48 20 20', 'M8.12 8.12 12 12'),
  copy: icon('M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'),
  paste: icon('M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'),
  attach: icon('m16 6-8.414 8.586a2 2 0 0 0 2.829 2.828l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551'),
  revert: icon('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'),
  saving: icon('M21 12a9 9 0 1 1-6.219-8.56'),
  saved: icon('M20 6 9 17l-5-5'),
  notSaved: icon('M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', 'M12 8v4', 'M12 16h.01'),
  alert: icon('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'),
  edit: icon('M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z', 'm15 5 4 4'),
  view: icon('M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
} as const;
