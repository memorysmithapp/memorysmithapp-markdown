import { useEffect, useId, useState } from 'react';
import { drawSlot, useSlot } from './slots.js';

interface MermaidDiagramProps {
  readonly code: string;
  /** The scheme the note is drawn in, which picks Mermaid's own theme. */
  readonly scheme: 'light' | 'dark';
}

/**
 * A mermaid code block drawn as an SVG diagram (§7.2). The library is heavy, so
 * it is imported lazily, out of the bundle that draws the rest of the note; on
 * any error the code is shown instead, and the error never leaves the diagram.
 *
 * The SVG is the one markup this surface injects, and it is Mermaid's own
 * output, not note-derived HTML: Mermaid renders with its default `strict`
 * security level, which encodes the text of the diagram.
 */
export function MermaidDiagram({ code, scheme }: MermaidDiagramProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let renderId: string | null = null;
    setSvg(null);
    setFailed(false);
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        // Text metrics depend on the webfont; rendering before it loads
        // truncates node labels.
        await document.fonts?.ready;
        mermaid.initialize({
          startOnLoad: false,
          theme: scheme === 'dark' ? 'dark' : 'neutral',
          fontFamily: 'Inter, sans-serif',
          // SVG text labels measure reliably; HTML labels clip inside nodes
          // when the webfont metrics differ from the fallback.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        /**
         * A diagram Mermaid cannot read is shown as its code without drawing
         * it. Drawing it anyway failed in the right place, the code, and left
         * the scratch container Mermaid draws into — its error bomb included —
         * at the end of <body>, under the whole page.
         */
        if ((await mermaid.parse(code, { suppressErrors: true })) === false) {
          if (alive) setFailed(true);
          return;
        }
        renderId = `mmd-${id}-${Date.now()}`;
        const rendered = await mermaid.render(renderId, code);
        if (alive) setSvg(rendered.svg);
      } catch {
        // And should drawing still fail, what it left behind goes with it.
        if (renderId) document.getElementById(`d${renderId}`)?.remove();
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, id, scheme]);

  const slot = useSlot('diagram');
  const state = failed ? 'failed' : svg ? 'ready' : 'loading';
  const drawn =
    state === 'failed' ? (
      <pre>
        <code>{code}</code>
      </pre>
    ) : state === 'ready' ? (
      <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg ?? '' }} />
    ) : (
      <div className="mermaid-diagram mermaid-loading" />
    );
  return slot ? drawSlot(slot, { source: code, state, children: drawn }) : drawn;
}
