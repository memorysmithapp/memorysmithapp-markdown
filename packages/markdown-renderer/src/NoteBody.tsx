import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { ICON_EDIT, ICON_VIEW } from './mode-icons.js';
import { drawSlot } from './slots.js';
import { HOST_KEYS, HostProvider, resolveHost, useHost, type NoteHost, type ResolvedHost } from './host.js';
import { planFootnotes } from './footnotes.js';
import { Markdown } from './Markdown.js';
import { readingPlugins } from './reading.js';
import { bodyStart, hideComments, remoteImageHosts, resolveWikilinks } from './markdown.js';
import { readProperties } from './properties.js';
import { Properties } from './PropertiesBlock.js';
import { useTaskSaves } from './task-saves.js';
import { taskBoxes } from './tasklist.js';
import { rootStyle } from './theme.js';
import { Transclusion } from './Transclusion.js';
import { splitEmbeds } from './transclusion.js';
import { wikilinkAddress } from './wikilink-address.js';

export interface NoteBodyProps extends NoteHost {
  /**
   * The note as the host keeps it, frontmatter included. It is drawn from these bytes and never
   * rewritten; the frontmatter is drawn as the theme decides.
   */
  readonly markdown: string;
  /**
   * Whether the note offers the switch to edit it, at its top right (#51). Defaults to `false`:
   * no switch, and the page is the one a reader always had.
   */
  readonly editable?: boolean;
  /** The mode, for a host that controls it; left out, the note keeps its own, starting from `defaultMode`. */
  readonly mode?: NoteMode;
  /** The mode a note that keeps its own starts in. Defaults to `view`. */
  readonly defaultMode?: NoteMode;
  /** The switch was used: the mode the reader asked for. */
  readonly onModeChange?: (mode: NoteMode) => void;
  /**
   * The note after each change made in edit mode, byte for byte the original wherever it was not
   * edited. The package never saves it.
   */
  readonly onChange?: (markdown: string) => void;
  /** Whether the switch shows its icon alone or its icon and its word. Defaults to `label`. */
  readonly modeButton?: 'icon' | 'label';
}

/** Whether a note is read or edited. */
export type NoteMode = 'view' | 'edit';

/** The editor, loaded the first time a note is edited, so a host that only draws never loads it. */
const NoteEditor = lazy(() => import('./edit/NoteEditor.js').then((module) => ({ default: module.NoteEditor })));

/** The switch between reading and editing, drawn by the theme's slot or as the default theme draws it. */
function ModeSwitch({ mode, display, toggle }: { mode: NoteMode; display: 'icon' | 'label'; toggle: () => void }) {
  const host = useHost();
  const slot = host.theme.components?.modeSwitch;
  const label = mode === 'view' ? host.strings.edit : host.strings.view;
  const icon = mode === 'view' ? ICON_EDIT : ICON_VIEW;
  if (slot) return <>{drawSlot(slot, { mode, label, icon, display, toggle })}</>;
  return (
    <button
      type="button"
      className={`mode-switch mode-switch-${display}`}
      data-mode={mode}
      title={label}
      aria-label={display === 'icon' ? label : undefined}
      onClick={toggle}
    >
      {icon}
      {display === 'label' && <span className="mode-switch-label">{label}</span>}
    </button>
  );
}

/**
 * The body of a note, drawn as MemorySmith's reading page draws it.
 *
 * It renders inside `.markdown`, so the stylesheet of the package applies, and asks the host for
 * every piece of notebook data through the props of `NoteHost`.
 */
export function NoteBody({
  editable = false,
  mode,
  defaultMode = 'view',
  onModeChange,
  onChange,
  modeButton = 'label',
  ...rest
}: NoteBodyProps) {
  const [own, setOwn] = useState<NoteMode>(defaultMode);
  const current: NoteMode = editable ? (mode ?? own) : 'view';
  if (!editable) return <NoteView {...rest} />;
  const toggle = () => {
    const next: NoteMode = current === 'view' ? 'edit' : 'view';
    if (mode === undefined) setOwn(next);
    onModeChange?.(next);
  };
  const { writable: _writable, onToggleTask: _toggle, ...host } = rest;
  return (
    <HostOnly host={rest}>
      {(resolved) => {
        const corner = (
          <HostProvider value={resolved}>
            <ModeSwitch mode={current} display={modeButton} toggle={toggle} />
          </HostProvider>
        );
        if (current === 'view') return <NoteView {...rest} corner={corner} />;
        return (
          // While the editor loads, the note stays on the page as it was.
          <Suspense fallback={<NoteView {...rest} corner={corner} />}>
            <NoteEditor {...host} onChange={onChange} corner={corner} autoFocus />
          </Suspense>
        );
      }}
    </HostOnly>
  );
}

/** The host resolved once, for what is drawn around the note. */
function HostOnly({ host, children }: { host: NoteHost; children: (host: ResolvedHost) => ReactNode }) {
  const resolved = useMemo(
    () => resolveHost(host),
    HOST_KEYS.map((key) => host[key]),
  );
  return <>{children(resolved)}</>;
}

/** The note drawn for reading: the page MemorySmith's reading page draws. */
function NoteView({ markdown, writable = false, onToggleTask, corner, ...host }: NoteHost & { markdown: string; corner?: ReactNode }) {
  const resolved = useMemo(
    () => resolveHost(host),
    // Every member of the contract, so a host that passes the same functions keeps the same host.
    HOST_KEYS.map((key) => (host as NoteHost)[key]),
  );
  // The frontmatter is drawn apart from the body, as the theme decides, so the
  // runs start after it. Everything below counts task items from there.
  // Each tick the host answers with a promise locks its item until the save settles.
  const saves = useTaskSaves(onToggleTask);
  const split = bodyStart(markdown);
  const properties = useMemo(() => readProperties(markdown), [markdown]);
  // What a comment holds is never read (§7.6): it leaves before the embeds and the links are found.
  const body = hideComments(markdown.slice(split)).text;

  // The body is cut into runs of text and the embeds between them; each run
  // is parsed on its own, as on MemorySmith's reading page.
  const segments = splitEmbeds(body, resolved.keeps).map((segment) =>
    segment.kind === 'text'
      ? {
          ...segment,
          // One resolver for every run: one note is a link, several are the
          // choice, and none is pending and still asks.
          rendered: resolveWikilinks(segment.text, (name) => wikilinkAddress(resolved, name), resolved.keeps),
        }
      : segment,
  );

  /**
   * Whether a click can be mapped back to the bytes at all.
   *
   * The ordinal is counted over the text the PARSER saw, which is the one with
   * the wikilinks already resolved, and it is applied to the text a write
   * sends, which is the original. Those two agree on how many boxes there are
   * and in what order, almost always — and `- [[x]]` is where they do not,
   * because resolving it produces `- [x](/url)`, which is a task box to any
   * GFM reader. Counting on one side and writing on the other would then
   * toggle a different item, silently, which is the worst defect this surface
   * can have. When the two disagree the boxes are read-only: not writing is
   * always better than writing the wrong one.
   */
  const mappable =
    taskBoxes(body).length ===
    segments.reduce((total, segment) => total + ('rendered' in segment ? taskBoxes(segment.rendered).length : 0), 0);

  // The ordinal a click carries is of the WHOLE note, and each rendered run
  // only knows its own. The count carried across the runs is what bridges
  // the two, and it has to include anything above the body.
  let seen = taskBoxes(markdown.slice(0, split)).length;

  /**
   * Whom this note asked the browser to talk to (§7.10).
   *
   * The specification admits three answers about a remote image and forbids
   * only silence: never fetching, fetching on the reader's action, or fetching
   * and saying so. This surface fetches — the destination reaches `<img src>`,
   * and React even preloads it — so this line is the half that says so, and
   * the reason it has to exist is that this is the one of the three answers a
   * person cannot work out from the page.
   *
   * It appears only where it is true, naming the hosts, because a notice on
   * every note would be a thing to scroll past rather than a thing to read.
   */
  const hosts = resolved.remoteNotice ? remoteImageHosts(body) : [];

  // The footnotes of a note an embed cuts (§7.12): each run is handed the
  // definitions of the others and the numbers of the note, and the note's one
  // section is drawn at its end, below the last embed too. Null, and nothing
  // changes, for a note no embed cuts or with no footnote to carry.
  const runs = segments.flatMap((segment) => ('rendered' in segment ? [segment.rendered] : []));
  const footnotes = useMemo(
    () => planFootnotes(runs, runs.length < segments.length, readingPlugins(() => undefined)),
    // The runs and whether an embed cut them are the whole input.
    [runs.join('\u0000'), runs.length < segments.length],
  );
  let run = 0;

  return (
    <HostProvider value={resolved}>
      {/* The root of the note carries the theme, which is where the stylesheet
          sets its values from the host's custom properties. */}
      <div
        className={`markdown markdown-theme-${resolved.theme.name}${corner ? ' has-mode-switch' : ''}`}
        data-theme={resolved.scheme}
        style={rootStyle(resolved.theme, resolved.scheme)}
      >
        {corner}
        {/* The frontmatter is content: read here, drawn as the theme decides. */}
        <Properties properties={properties} />
        {segments.map((segment, index) => {
          if (!('rendered' in segment)) {
            return <Transclusion key={index} target={segment.target} anchor={segment.anchor} />;
          }
          const base = seen;
          seen += taskBoxes(segment.rendered).length;
          const planned = footnotes?.runs[run++];
          return (
            <Markdown
              key={index}
              // The text the ordinal is counted over, stated rather than left to
              // a default: it is the one the parser reports offsets into, and
              // `mappable` above is what makes it safe to write back through.
              // A planned run is the same text with definitions appended after
              // it, so every box keeps the offset it had.
              source={planned?.text ?? segment.rendered}
              onToggleTask={onToggleTask && ((ordinal, checked) => saves.toggle(base + ordinal, checked))}
              taskSave={(ordinal) => saves.stateOf(base + ordinal)}
              writable={writable && mappable}
              {...(planned ? { footnotes: { refs: planned.refs } } : {})}
            >
              {planned?.text ?? segment.rendered}
            </Markdown>
          );
        })}
        {/* Its boxes, if a footnote holds any, are drawn read-only: they are
            not where the ordinals of the runs count them. */}
        {footnotes && <Markdown footnotes="section">{footnotes.section}</Markdown>}
        {hosts.length > 0 && <p className="remote-notice">{resolved.strings.remoteImages(hosts)}</p>}
        {/* Where a save is said to whoever hears the page: once, politely, never by the item itself. */}
        {writable && onToggleTask && (
          <p className="visually-hidden" role="status" aria-live="polite">
            {saves.announcement && resolved.strings[saves.announcement]}
          </p>
        )}
      </div>
    </HostProvider>
  );
}
