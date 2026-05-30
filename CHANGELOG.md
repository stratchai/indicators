# Changelog

## [0.1.0] — 2026-05-30 (initial extraction)

Extracted from [@stratchai/core](https://github.com/stratchai/core) — the indicator module is the largest piece of `core` with the cleanest extraction surface (pure functions, zero external imports, fully tested standalone).

### Included

37 indicator functions across trend, momentum, volatility, volume, oscillators, and chart patterns. See README for the full list.

### Tests

177 tests, 100% pass standalone. Lifted directly from `core/tests/indicators.test.js` (the tests were already self-contained and required only an import path change).

### Roadmap

- TypeScript port (`.d.ts` for consumer experience)
- CodeSandbox demo
- ESM dual-export (`exports` field in package.json)
- Possible npm publish once README + examples are polished
