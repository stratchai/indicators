# @stratchai/indicators

[![npm version](https://img.shields.io/npm/v/@stratchai/indicators.svg)](https://www.npmjs.com/package/@stratchai/indicators)
[![npm downloads](https://img.shields.io/npm/dm/@stratchai/indicators.svg)](https://www.npmjs.com/package/@stratchai/indicators)
[![types](https://img.shields.io/npm/types/@stratchai/indicators.svg)](https://www.typescriptlang.org)
[![license](https://img.shields.io/npm/l/@stratchai/indicators.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@stratchai/indicators.svg)](https://nodejs.org)

**37 technical indicators + 12 series variants for systematic trading.** Trend, momentum, volatility, volume, oscillators, chart patterns — zero runtime dependencies, pure functions, TypeScript-typed.

```ts
import { calcRSI, calcMACD, calcSupertrend, calcBollingerBands } from "@stratchai/indicators";

const rsi = calcRSI(closes, 14);
// number | null

const macd = calcMACD(closes, 12, 26, 9);
// { macd, signal, histogram, bullish, bearish, ... } | null

const st = calcSupertrend(highs, lows, closes, 10, 3);
// { value, bullish, bearish, distance } | null

const bb = calcBollingerBands(closes, 20, 2);
// { middle, upper, lower, std, width, ... } | null
```

## Install

```bash
npm install @stratchai/indicators
```

Works in any Node 16+ environment. No native compilation, no C bindings, no external runtime dependencies.

## Stratchai ecosystem

`@stratchai/indicators` is the foundation that the other two packages build on:

| Package | Purpose |
|---|---|
| **`@stratchai/indicators`** | **37 indicators + 12 series variants (this package)** |
| [`@stratchai/strategy-spec`](https://www.npmjs.com/package/@stratchai/strategy-spec) | Declarative strategy specs → generated JavaScript |
| [`@stratchai/backtest`](https://www.npmjs.com/package/@stratchai/backtest) | Walk-forward audit primitives for OOS validation |

Use `@stratchai/indicators` alone for any kind of signal/research code, or together with the other two for a full spec-build-audit loop.

## Two APIs: scalar vs series

Each indicator comes in two flavors, optimized for different use cases:

### Scalar (latest-value)

Returns one result from a trailing prefix. Use in live agents that call once per bar with the latest data.

```ts
import { calcRSI } from "@stratchai/indicators";

const rsi = calcRSI(closes, 14);
// number | null  — RSI computed at the END of the input array
```

### Series (one-per-bar)

Returns an array of length `closes.length` with the indicator computed at every bar. Use in backtests, charts, or anywhere you need per-bar values.

```ts
import { calcRSISeries } from "@stratchai/indicators";

const rsi = calcRSISeries(closes, 14);
// (number | null)[]  — same length as closes; null for the first 14 warmup bars

for (let i = 14; i < closes.length; i++) {
  if (rsi[i] !== null && rsi[i] < 30) {
    /* oversold signal at bar i */
  }
}
```

Series variants ship for the indicators most commonly used in backtests:
`calcRSISeries`, `calcSMASeries`, `calcEMASeries`, `calcMFISeries`,
`calcAroonSeries`, `calcADXSeries`, `calcSupertrendSeries`,
`calcIchimokuSeries`, `calcKeltnerSeries`, `calcOBVSeries`,
`calcBollingerBandsSeries`, `calcMACDSeries`.

## Available indicators

### Trend / momentum
- `calcSMA(prices, period)` — Simple moving average
- `calcEMA(prices, period)` — Exponential moving average
- `calcMACD(prices, fast, slow, signal)` — Moving Average Convergence Divergence
- `calcADX(highs, lows, closes, period)` — Average Directional Index (Wilder)
- `calcSupertrend(highs, lows, closes, period, mult)` — Supertrend (ATR-based trailing band)
- `calcParabolicSAR(highs, lows, closes, afStep, afMax)` — Parabolic SAR (Wilder)
- `calcAlligator(prices, jaw, teeth, lips)` — Williams Alligator
- `calcAwesomeOscillator(highs, lows, fast, slow)` — Bill Williams Awesome Oscillator
- `calcROC(prices, period)` — Rate of Change
- `calcHMA(prices, period)` — Hull Moving Average
- `calcIchimoku(highs, lows, closes, ...)` — Ichimoku Cloud
- `calcTrendStructure(closes, highs, lows, opts)` — HH/HL trend structure analyzer
- `calc52WeekHighLow(closes, highs, lows)` — Rolling 52-week extremes

### Volatility
- `calcBollingerBands(prices, period, k)` — Bollinger Bands (J. Bollinger)
- `calcATR(highs, lows, closes, period)` — Average True Range
- `calcATRExpansion(highs, lows, closes, period)` — ATR + expansion ratio
- `calcKeltner(highs, lows, closes, period, mult, atrPeriod)` — Keltner Channels
- `calcDonchian(highs, lows, period)` — Donchian Channels (Turtle Trading)
- `calcMassIndex(highs, lows, period, sumPeriod, bulgeLookback)` — Mass Index (reversal pattern)

### Volume / flow
- `calcOBV(closes, volumes, smaPeriod)` — On-Balance Volume
- `calcMFI(highs, lows, closes, volumes, period)` — Money Flow Index
- `calcCMF(highs, lows, closes, volumes, period)` — Chaikin Money Flow
- `calcVWAP(closes, highs, lows, timestamps, params)` — Volume-Weighted Average Price

### Oscillators
- `calcRSI(prices, period)` — Relative Strength Index (Wilder)
- `calcStochastic(highs, lows, closes, period)` — Stochastic %K
- `calcAroon(highs, lows, period)` — Aroon Up/Down/Oscillator
- `calcVolIndex(prices, k)` — In-house volatility index

### Chart patterns
- `calcHammer(opens, highs, lows, closes, opts)` — Hammer candle
- `calcEngulfing(opens, highs, lows, closes, opts)` — Bullish/Bearish Engulfing
- `calcMorningStar(opens, highs, lows, closes, opts)` — Morning Star reversal
- `calcDoubleBottom(closes, highs, lows, opts)` — Double Bottom
- `calcCupAndHandle(closes, highs, lows, opts)` — Cup & Handle (Bulkowski)
- `calcFlagPattern(closes, highs, lows, opts, volumes)` — Flag breakout
- `calcCandlePattern(opens, highs, lows, closes, params)` — 2-candle bullish impulse
- `calcAscendingTriangle(closes, highs, lows, opts)` — Ascending Triangle

### Reference levels
- `calcPivotPoints(high, low, close)` — Floor pivot points
- `calcFibonacci(high, low)` — Fibonacci retracements

## Conventions

**Array order.** All inputs are arrays in chronological order — oldest at index 0, most recent at the end. Scalar functions read the most recent values (e.g., `prices[prices.length - 1]` is the current bar).

**Return shape.** Most indicators return `null` when there aren't enough bars to compute (e.g., `calcRSI(prices, 14)` returns `null` when `prices.length < 15`). Composite indicators return objects with named fields (`{ value, bullish, expansion, ... }`) — see TypeScript types or jsdoc.

**No I/O.** Every function is pure: same inputs → same output. No filesystem, no network, no time dependency. Easy to test, easy to compose.

## Why this library?

Most JavaScript indicator libraries are either old and unmaintained, thin C bindings with platform pain, or return raw numbers without the richer context strategies actually need. Useful patterns — Cup & Handle, Flag, Ascending Triangle, Morning Star — are missing from most libraries entirely.

This library was built to fill three specific gaps:

- **Boolean conveniences** (`adx.trending`, `supertrend.bullish`, `band.aboveUpper`) — most libraries return raw numbers, leaving threshold logic to every consumer
- **Pattern detectors** following technical-analysis literature (Bulkowski, Wilder, Bollinger) — Cup & Handle, Flag, Ascending Triangle, Morning Star
- **No external dependencies** — works in any Node.js environment, no native compilation, no C bindings

## License

[MIT](./LICENSE)
