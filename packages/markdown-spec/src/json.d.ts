// The build compiles without `resolveJsonModule`, so that the data stays at the root of the
// package instead of being copied into `dist/`: the imports of `index.ts` are typed here as
// unknown, and given their types there.
declare module '*.json' {
  const value: unknown;
  export default value;
}
