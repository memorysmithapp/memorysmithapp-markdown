// The entry point of @memorysmithapp/markdown-spec: the data of the specification, typed.
// The raw JSON stays exported at `./spec.json`, `./conformance.json` and `./schema.json`;
// these are the same files, with the types of `./types`.

import specData from '../spec.json' with { type: 'json' };
import conformanceData from '../tests/conformance.json' with { type: 'json' };
import type { ConformanceCase, ConformanceSuite, Spec } from './types.js';

export type * from './types.js';

/** `spec.json`: every notation the specification declares. */
export const spec: Spec = specData as Spec;

/** `tests/conformance.json`, whole. */
export const conformance: ConformanceSuite = conformanceData as ConformanceSuite;

/** The cases of the conformance suite. */
export const cases: readonly ConformanceCase[] = conformance.cases;
