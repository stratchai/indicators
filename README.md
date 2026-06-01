# @stratchai/indicators

Technical indicators for systematic trading. 37 functions covering trend, momentum, volatility, volume, oscillators, and chart patterns. Zero dependencies, pure functions, written in plain JS.

Battle-tested in a production multi-strategy trading framework where these indicators run a live fleet across crypto and equities.

## Install

```bash
npm install @stratchai/indicators
```

## Quick start

### TypeScript

```ts
import {
  calcBollingerBands,
  calcRSI,
  calcADX,
  calcSupertrend,
  calcMACD,
} from "@stratchai/indicators";

const closes: number[] = [/* ... daily closes ... */];
const highs:  number[] = [/* ... daily highs  ... */];
const lows:   number[] = [/* ... daily lows   ... */];

const bb = calcBollingerBands(closes, 20, 2);
// Inferred: { middle: number; upper: number; lower: number; std: number } | null

const rsi = calcRSI(closes, 14);
// Inferred: number | null

const adx = calcADX(highs, lows, closes, 14);
// Inferred: { value, diPlus, diMinus, trending, bullish, ... } | null
```

### JavaScript (CommonJS)

```js
const { calcBollingerBands, calcRSI, calcADX } = require("@stratchai/indicators");

const bb  = calcBollingerBands(closes, 20, 2);
const rsi = calcRSI(closes, 14);
const adx = calcADX(highs, lows, closes, 14);
```

Every function is typed — your IDE autocompletes the parameter list, infers the return shape, and surfaces the `| null` cases at the point of use.

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

**Array order.** All inputs are arrays in chronological order — oldest at index 0, most recent at the end. The function reads the most recent values (e.g., `prices[prices.length - 1]` is the current bar's close).

**Return shape.** Most indicators return `null` when there aren't enough bars to compute (e.g., `calcRSI(prices, 14)` returns `null` when `prices.length < 15`). Composite indicators return objects with named fields (`{ value, bullish, expansion, ... }`) — see jsdoc or just `console.log` the return.

**No I/O.** Every function is pure: given the same inputs, returns the same output. No filesystem, no network, no time dependency. Easy to test, easy to compose.

## Why another indicator library?

Most existing JS indicator libraries are either old/unmaintained, thin C bindings with platform pain, or return raw numbers without the richer context strategies actually need (`{ value, bullish, expansion }`-shaped returns instead of just a number). Several useful patterns — Cup & Handle, Flag, Ascending Triangle, Morning Star — are missing from most libraries entirely.

This library was built to fill three specific gaps:
- **Boolean conveniences** (`adx.trending`, `supertrend.bullish`, `band.aboveUpper`) — most libraries return raw numbers, leaving the threshold logic to every consumer
- **Pattern detectors** that match technical-analysis literature (Bulkowski, Wilder, Bollinger) — Cup & Handle, Flag, Ascending Triangle, Morning Star
- **No external dependencies** — works in any Node.js environment, no native compilation, no C bindings

## License

MIT
