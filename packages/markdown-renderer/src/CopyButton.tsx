import { useEffect, useRef, useState } from 'react';

/**
 * Copying to the clipboard, in the one way that works everywhere a note is
 * opened.
 *
 * The async clipboard API can stay pending forever in embedded or automated
 * contexts, so the promise is raced against a short timeout and the legacy
 * path takes over when it does not settle.
 */
export async function copyText(text: string): Promise<void> {
  const viaApi = navigator.clipboard
    ?.writeText(text)
    .then(() => true)
    .catch(() => false);
  const done = await Promise.race([
    viaApi ?? Promise.resolve(false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 350)),
  ]);
  if (done) return;

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.style.position = 'fixed';
  scratch.style.opacity = '0';
  document.body.appendChild(scratch);
  scratch.select();
  document.execCommand('copy');
  scratch.remove();
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function CopyIcon() {
  return (
    <svg {...ICON}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * The verb beside a block of code, which carries it somewhere else. It says
 * *Copied* with the check for two seconds and goes back.
 *
 * The word is dropped at phone width and the icon stays, so the label lives in
 * `aria-label` and `title` too: whoever hears the page still hears *Copy*.
 *
 * The text is asked for at the moment of the click, because a block is copied
 * from what is on the page and not from a string held since it was drawn.
 */
export function CopyButton({
  text,
  label,
  done,
  className = '',
}: {
  text: () => string;
  /** The verb, in the reader's language. */
  label: string;
  /** What it says once the text is copied. */
  done: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await copyText(text());
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={`button is-small copy-action ${className}`.trim()}
      onClick={() => void copy()}
      aria-label={label}
      title={copied ? done : label}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="copy-action-label">{copied ? done : label}</span>
    </button>
  );
}
