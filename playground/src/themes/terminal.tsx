// Level 3: a theme that draws blocks with components of its own. Dark only and monospaced:
// callouts as framed messages with icons from an icon library, task boxes as `[x]`, headings
// with their hashes, a code frame with a prompt line, and wikilinks marked with an arrow. Each
// slot is handed the notation already read; it decides how it looks and nothing else.

import {
  defineTheme,
  type CalloutSlotProps,
  type CodeBlockSlotProps,
  type PropertiesSlotProps,
} from '@memorysmithapp/markdown-renderer';
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardList,
  Flame,
  Info,
  List,
  Pencil,
  Quote,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import './terminal.css';

const ICONS = {
  note: <Pencil />,
  info: <Info />,
  todo: <Info />,
  abstract: <ClipboardList />,
  summary: <ClipboardList />,
  tldr: <ClipboardList />,
  tip: <Flame />,
  hint: <Flame />,
  important: <Flame />,
  success: <CircleCheck />,
  check: <CircleCheck />,
  done: <CircleCheck />,
  question: <CircleHelp />,
  help: <CircleHelp />,
  faq: <CircleHelp />,
  warning: <TriangleAlert />,
  caution: <TriangleAlert />,
  attention: <TriangleAlert />,
  failure: <CircleX />,
  fail: <CircleX />,
  missing: <CircleX />,
  danger: <Zap />,
  error: <Zap />,
  bug: <Zap />,
  example: <List />,
  quote: <Quote />,
  cite: <Quote />,
};

function Callout({ kind, title, icon, children }: CalloutSlotProps) {
  return (
    <section className="term-callout" data-kind={kind}>
      <header>
        <span className="term-callout-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="term-callout-kind">[{kind.toUpperCase()}]</span> {title}
      </header>
      <div className="term-callout-body">{children}</div>
    </section>
  );
}

function CodeBlock({ language, children, copy }: CodeBlockSlotProps) {
  return (
    <div className="term-code">
      <div className="term-code-bar">
        <span>$ cat snippet{language ? `.${language}` : ''}</span>
        {copy}
      </div>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * The frontmatter as the YAML it is, after a prompt: the name is no title here, only its own line.
 * Each value goes through `value`, so a wikilink in it is still a link the host resolved.
 */
function Properties({ name, entries, value }: PropertiesSlotProps) {
  if (name === null && entries.length === 0) return null;
  return (
    <div className="term-front">
      <div className="term-front-prompt">$ head -n {entries.length + (name === null ? 2 : 3)} note.md</div>
      <pre>
        {'---\n'}
        {name !== null && (
          <>
            <span className="term-key">name</span>: <span className="term-name">{name}</span>
            {'\n'}
          </>
        )}
        {entries.map((entry) => (
          <span key={entry.key}>
            <span className="term-key">{entry.key}</span>:{' '}
            {entry.shape === 'list' ? (
              <>
                [
                {entry.values.map((item, index) => (
                  <span key={index}>
                    {index > 0 && ', '}
                    {value(item)}
                  </span>
                ))}
                ]
              </>
            ) : (
              value(entry.values[0] ?? '')
            )}
            {'\n'}
          </span>
        ))}
        {'---'}
      </pre>
    </div>
  );
}

export const terminal = defineTheme({
  name: 'terminal',
  schemes: ['dark'],
  properties: {
    bg: '#0b0f0c',
    surface: '#111812',
    border: '#1f3324',
    text: '#c8f7d0',
    textSoft: '#6fa77a',
    accent: '#7ee787',
    pending: '#4b6b52',
    codeBg: '#0f1611',
    codeColor: '#a5d6ae',
    fontSans: "'JetBrains Mono', ui-monospace, monospace",
    fontHeading: "'JetBrains Mono', ui-monospace, monospace",
    fontDisplay: "'JetBrains Mono', ui-monospace, monospace",
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '0.95rem',
    radius: '0',
    radiusLarge: '0',
    h1Size: '1.35em',
    h2Size: '1.2em',
    h3Size: '1.1em',
    h4Size: '1em',
    h5Size: '1em',
    h6Size: '1em',
    headingColor: '#7ee787',
    quoteBorderColor: '#2f5a38',
    tableBorder: '#1f3324',
    tableHeaderRule: '1px dashed #7ee787',
    tableStripeBg: '#0f1611',
    embedRule: '#2f5a38',
  },
  icons: ICONS,
  components: {
    callout: Callout,
    properties: Properties,
    codeBlock: CodeBlock,
    heading: ({ level, children }) => {
      const Tag = `h${level}` as const;
      return (
        <Tag>
          <span className="term-hashes" aria-hidden="true">
            {'#'.repeat(level)}{' '}
          </span>
          {children}
        </Tag>
      );
    },
    taskBox: ({ checked, enabled, toggle }) => (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        className="term-box"
        disabled={!enabled}
        onClick={toggle}
      >
        [{checked ? 'x' : ' '}]
      </button>
    ),
    wikilink: ({ pending, children, link }) => link(<>{pending ? '?' : '→'} {children}</>),
  },
});
