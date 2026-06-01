# Changelog

## [0.2.1] — 2026-06-02 (README — drop links to private framework)

### Fixed

- **README references to private parent project removed.** The two `https://github.com/stratchai` links (in the intro paragraph and the "Why another indicator library?" section) implied a public parent repo that doesn't exist publicly. Rephrased to describe the library's pedigree without naming or linking to the private framework. The "battle-tested in production" claim stays — just without the dead-end link.

No code changes. README-only release.

---

## [0.2.0] — 2026-05-31 (TypeScript port)

### Changed

- **TypeScript first-class.** `src/index.js` renamed to `src/index.ts` (git history preserved). All 37 indicator functions now have typed parameter signatures (`number[]`, `number`, optional opts objects). Return types are inferred precisely by TypeScript from literal-object returns — `calcBollingerBands` declares `{ middle: number; upper: number; lower: number; std: number } | null` automatically, `calcMACD` declares `{ macd: number; signal: number; histogram: number } | null`, etc.
- **Build step added.** `npm run build` runs `tsc` and emits to `dist/`:
  - `dist/index.js` — CommonJS output (Node-compatible)
  - `dist/index.d.ts` — TypeScript declarations for consumers
  - Source maps for both
- **`module.exports = {...}` → `export {...}`.** Pure cosmetic on the source; TypeScript with `module: CommonJS` emits identical CJS at build time.
- **`package.json` now points at the built artifact.** `main: dist/index.js`, `types: dist/index.d.ts`, `files: [dist, README.md, LICENSE, CHANGELOG.md]`. Source files are *not* shipped to npm consumers — they get only the compiled JS + .d.ts.
- **`prepublishOnly` hook** ensures a fresh build + green tests run before any `npm publish`.

### Tests

- 177 existing tests still pass (unchanged — they import via `../src` and run against the TypeScript source via `ts-jest`).
- 5 new tests in `tests/types.test.ts` exercise the consumer-side type signatures: verify `calcSMA` returns `number | null`, `calcBollingerBands` returns the typed object, `calcMACD` field types are precise, etc. These will catch any future type regression at test time.
- Total: **182 tests across 2 files, all green.**

### Internal

- `_emaSeries` (the EMA helper) typed and intentionally left out of the public exports list.
- 3 nested helper functions (`smma` in `calcAlligator`, `sma` in `calcAwesomeOscillator`, `wma`/`hmaAt` in `calcHMA`) now have explicit parameter types so the build passes `strict: true`.

### Roadmap

- ESM dual-export (`exports` field in package.json with both `require` and `import`)
- Named interface types for complex returns (e.g., `BollingerBandsResult`, `MACDResult`) — currently anonymous, may be worth exporting for consumer convenience
- CodeSandbox demo
- npm publish (separate explicit step)

---

## [0.1.0] — 2026-05-30 (initial extraction)

Extracted from a parent trading framework — the indicator module was the largest piece with the cleanest extraction surface (pure functions, zero external imports, fully tested standalone).

### Included

37 indicator functions across trend, momentum, volatility, volume, oscillators, and chart patterns. See README for the full list.

### Tests

177 tests, 100% pass standalone. Lifted from the parent framework's test suite (the tests were already self-contained and required only an import path change).
