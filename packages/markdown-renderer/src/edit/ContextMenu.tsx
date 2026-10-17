/**
 * The editor's own menu on a right-click in edit mode (#81): what the toolbar formats and inserts,
 * where the author is, after the clipboard's three verbs. It is a `role="menu"` reached by keyboard,
 * kept inside the window, and closed by Escape, a click outside it, a scroll, or an entry run.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  readonly name: string;
  readonly label: string;
  readonly icon: ReactNode;
  /** The keys that do the same, as CodeMirror writes them: `Mod-b`, `Mod-Shift-x`. */
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

export interface MenuGroup {
  readonly label: string;
  readonly items: readonly MenuItem[];
}

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** A shortcut as the reader's keyboard writes it: `⌘⇧X` on a Mac, `Ctrl+Shift+X` elsewhere. */
export function shortcutText(shortcut: string): string {
  const keys = shortcut.split('-').map((key) => (key.length === 1 ? key.toUpperCase() : key));
  if (MAC) return keys.map((key) => ({ Mod: '⌘', Shift: '⇧', Alt: '⌥' })[key] ?? key).join('');
  return keys.map((key) => ({ Mod: 'Ctrl' })[key] ?? key).join('+');
}

/** The same shortcut as `aria-keyshortcuts` names it. */
function ariaShortcut(shortcut: string): string {
  return shortcut
    .split('-')
    .map((key) => (key === 'Mod' ? (MAC ? 'Meta' : 'Control') : key.length === 1 ? key.toUpperCase() : key))
    .join('+');
}

export function ContextMenu({
  x,
  y,
  label,
  groups,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  groups: readonly MenuGroup[];
  /** The menu closed; `back` says the focus goes back to the text, as after Escape or an entry. */
  onClose: (back: boolean) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x, top: y });
  const close = useRef(onClose);
  close.current = onClose;

  // Kept inside the window: a menu opened near the right or the bottom edge opens the other way.
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const margin = 8;
    const width = window.innerWidth;
    const height = window.innerHeight;
    setPlace({
      left: Math.max(margin, x + box.width + margin > width ? Math.max(margin, x - box.width) : x),
      top: Math.max(margin, y + box.height + margin > height ? Math.max(margin, height - box.height - margin) : y),
    });
    element.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [x, y]);

  useEffect(() => {
    const outside = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close.current(false);
    };
    const scrolled = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close.current(false);
    };
    document.addEventListener('mousedown', outside, true);
    // The click that opened the menu may move the cursor, and the editor scroll it into view: a
    // scroll closes the menu only once that one is over.
    const listen = setTimeout(() => {
      window.addEventListener('scroll', scrolled, true);
      window.addEventListener('resize', scrolled);
    }, 200);
    return () => {
      clearTimeout(listen);
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', scrolled);
    };
  }, []);

  const move = (step: number | 'first' | 'last') => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = step === 'first' ? 0 : step === 'last' ? items.length - 1 : (at + step + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={menu}
      className="edit-menu"
      role="menu"
      aria-label={label}
      style={{ left: place.left, top: place.top }}
      data-ms-control=""
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') move(1);
        else if (event.key === 'ArrowUp') move(-1);
        else if (event.key === 'Home') move('first');
        else if (event.key === 'End') move('last');
        else if (event.key === 'Escape' || event.key === 'Tab') onClose(true);
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {groups.map((group, index) => (
        <div key={group.label} role="group" aria-label={group.label} className="edit-menu-group">
          {index > 0 && <div role="separator" className="edit-menu-separator" />}
          <div className="edit-menu-heading" aria-hidden="true">
            {group.label}
          </div>
          {group.items.map((item) => (
            <button
              key={item.name}
              type="button"
              role="menuitem"
              className="edit-menu-item"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              aria-keyshortcuts={item.shortcut ? ariaShortcut(item.shortcut) : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (item.disabled) return;
                onClose(true);
                item.run();
              }}
            >
              <span className="edit-menu-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="edit-menu-label">{item.label}</span>
              {item.shortcut && <span className="edit-menu-shortcut">{shortcutText(item.shortcut)}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
