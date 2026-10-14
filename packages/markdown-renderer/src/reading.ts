// The remark plugins of the reading surface, apart from React: the drawing, the footnote plan
// and the diagnostic read a note through the same list, so a notice never disagrees with the page.

import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { remarkCallouts } from './remark-callouts.js';
import { remarkBlockIds, remarkHighlight, remarkMathDollarRule } from './remark-ring.js';

/**
 * The remark plugins of the reading surface, in their order. `planFootnotes` reads a note
 * through the same list, so it counts the references this surface draws and no other.
 */
export function readingPlugins(titleOf: (kind: string) => string | undefined): PluggableList {
  return [
    /**
     * `singleTilde: false` is a decision and not a default.
     *
     * GFM specifies strikethrough as `~~x~~`; GitHub also accepts a
     * single tilde, outside its own specification. Here that extension
     * actively misrenders a notation the specification leaves out:
     * somebody writing `H~2~O` for a subscript would get `H` struck-out
     * `2` `O`, which is a worse answer than nothing. With it off the
     * characters stay on the page, and the author can see they got what
     * the specification says they get, which is nothing.
     */
    [remarkGfm, { singleTilde: false }],
    [remarkCallouts, { titleOf }],
    remarkHighlight,
    remarkBlockIds,
    remarkMath,
    // After remark-math, and it gives back what was never a formula.
    remarkMathDollarRule,
  ];
}
