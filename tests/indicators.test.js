const {
  calcBollingerBands,
  calcVolIndex,
  calcSMA,
  calcRSI,
  calcATR,
  calcEMA,
  calcMACD,
  calcStochastic,
  calcCandlePattern,
  calcFlagPattern,
  calcVWAP,
  calcMassIndex,
  calcAroon,
  calcADX,
  calcSupertrend,
  calcOBV,
  calcParabolicSAR,
  calcAlligator,
  calcAwesomeOscillator,
  calcROC,
  calcKeltner,
  calcMFI,
  calcCMF,
  calcDonchian,
  calcHMA,
  calc52WeekHighLow,
  calcPivotPoints,
  calcFibonacci,
  calcSupportResistance,
  calcIchimoku,
  calcAscendingTriangle,
} = require("../src");

// 20 prices alternating 95/105: mean=100, std=5, upper=110, lower=90
const ALT20 = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 95 : 105));

// ---------------------------------------------------------------------------
describe("calcBollingerBands", () => {
  test("returns null when prices.length < period", () => {
    expect(calcBollingerBands([100, 100], 20)).toBeNull();
  });

  test("std=0, upper=lower=middle for uniform prices", () => {
    const prices = Array(20).fill(100);
    expect(calcBollingerBands(prices, 20, 2)).toEqual({
      middle: 100, upper: 100, lower: 100, std: 0,
    });
  });

  test("computes bands correctly for alternating prices", () => {
    // mean=100, std=5, k=2 → upper=110, lower=90
    const r = calcBollingerBands(ALT20, 20, 2);
    expect(r.middle).toBeCloseTo(100);
    expect(r.upper).toBeCloseTo(110);
    expect(r.lower).toBeCloseTo(90);
    expect(r.std).toBeCloseTo(5);
  });

  test("uses only the last `period` prices, ignores older values", () => {
    const old = Array(10).fill(999);
    const r = calcBollingerBands([...old, ...ALT20], 20, 2);
    expect(r.middle).toBeCloseTo(100);
  });
});

// ---------------------------------------------------------------------------
describe("calcVolIndex", () => {
  test("returns null for empty array", () => {
    expect(calcVolIndex([])).toBeNull();
  });

  test("std=0, vIndex=mean for single price", () => {
    const r = calcVolIndex([100]);
    expect(r).toMatchObject({ mean: 100, std: 0, vIndex: 100 });
  });

  test("vIndex = mean − k×std", () => {
    // [95, 105]: mean=100, std=5, k=1 → vIndex=95
    const r = calcVolIndex([95, 105], 1);
    expect(r.mean).toBeCloseTo(100);
    expect(r.std).toBeCloseTo(5);
    expect(r.vIndex).toBeCloseTo(95);
  });

  test("k=2 doubles the std offset", () => {
    const r = calcVolIndex([95, 105], 2);
    expect(r.vIndex).toBeCloseTo(90); // 100 - 2*5
  });
});

// ---------------------------------------------------------------------------
describe("calcSMA", () => {
  test("returns null when prices.length < period", () => {
    expect(calcSMA([1, 2], 5)).toBeNull();
  });

  test("returns mean of last `period` prices", () => {
    expect(calcSMA([1, 2, 3, 4, 5], 3)).toBeCloseTo(4); // [3,4,5]
  });

  test("ignores prices outside the window", () => {
    expect(calcSMA([999, 1, 2, 3], 3)).toBeCloseTo(2); // [1,2,3]
  });
});

// ---------------------------------------------------------------------------
describe("calcRSI", () => {
  test("returns null when prices.length < period + 1", () => {
    expect(calcRSI([100, 101], 14)).toBeNull();
  });

  test("returns 100 when all moves are gains", () => {
    // 15 prices, each +1 → avgLoss=0 → RSI=100
    const prices = Array.from({ length: 15 }, (_, i) => 100 + i);
    expect(calcRSI(prices, 14)).toBe(100);
  });

  test("returns ~50 for equal gains and losses", () => {
    // 15 prices alternating ±1: 7 gains, 7 losses → RS=1 → RSI=50
    const prices = [100];
    for (let i = 0; i < 14; i++) {
      prices.push(i % 2 === 0 ? prices[prices.length - 1] + 1 : prices[prices.length - 1] - 1);
    }
    expect(calcRSI(prices, 14)).toBeCloseTo(50);
  });
});

// ---------------------------------------------------------------------------
describe("calcATR", () => {
  test("returns null when arrays are shorter than period + 1", () => {
    expect(calcATR([10], [8], [9], 14)).toBeNull();
  });

  test("returns null when any array is falsy", () => {
    expect(calcATR(null, null, null, 14)).toBeNull();
  });

  test("computes ATR for simple candles", () => {
    // 15 candles: h=10, l=8, prevClose=9 → TR=max(2,1,1)=2 for all 14 periods
    const n = 15;
    const highs  = Array(n).fill(10);
    const lows   = Array(n).fill(8);
    const closes = Array(n).fill(9);
    expect(calcATR(highs, lows, closes, 14)).toBeCloseTo(2);
  });
});

// ---------------------------------------------------------------------------
describe("calcEMA", () => {
  test("returns null when prices.length < period", () => {
    expect(calcEMA([1, 2], 5)).toBeNull();
  });

  test("returns seed mean for exactly `period` prices", () => {
    // period=3, prices=[1,2,3]: seed=(1+2+3)/3=2
    expect(calcEMA([1, 2, 3], 3)).toBeCloseTo(2);
  });

  test("applies exponential weighting on subsequent prices", () => {
    // period=2, prices=[2,4,6]: k=2/3, seed=(2+4)/2=3, EMA=6*(2/3)+3*(1/3)=5
    expect(calcEMA([2, 4, 6], 2)).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
describe("calcMACD", () => {
  test("returns null when prices.length < slow + signal", () => {
    expect(calcMACD(Array(10).fill(100))).toBeNull(); // needs 26+9=35
  });

  test("returns object with macd, signal, histogram", () => {
    const prices = Array(40).fill(100);
    const r = calcMACD(prices);
    expect(r).toMatchObject({
      macd: expect.any(Number),
      signal: expect.any(Number),
      histogram: expect.any(Number),
    });
  });

  test("histogram equals macd − signal", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const r = calcMACD(prices);
    expect(r.histogram).toBeCloseTo(r.macd - r.signal, 10);
  });
});

// ---------------------------------------------------------------------------
describe("calcStochastic", () => {
  test("returns null when highs.length < period", () => {
    expect(calcStochastic([10], [5], [8], 5)).toBeNull();
  });

  test("returns 50 when highestHigh === lowestLow", () => {
    const arr = Array(14).fill(10);
    expect(calcStochastic(arr, arr, arr, 14)).toBe(50);
  });

  test("computes correct stochastic: (close−low)/(high−low)×100", () => {
    // h=10, l=5, close=8 → (8−5)/(10−5)*100 = 60
    const h = Array(14).fill(10);
    const l = Array(14).fill(5);
    const c = Array(14).fill(8);
    expect(calcStochastic(h, l, c, 14)).toBeCloseTo(60);
  });
});

// ---------------------------------------------------------------------------
describe("calcCandlePattern", () => {
  // Signature: calcCandlePattern(opens, highs, lows, closes, params = {})
  // Logic: 2-candle pattern — green impulse (strong body, large range) + confirming candle
  //        that closes above the impulse close. confirm_lookback default = 3 → need n >= 5.

  test("returns patternLong: false when fewer than 5 bars", () => {
    const opens  = [100, 101, 102, 103];
    const highs  = [101, 102, 103, 104];
    const lows   = [99,  100, 101, 102];
    const closes = [100.5, 101.5, 102.5, 103.5];
    expect(calcCandlePattern(opens, highs, lows, closes)).toEqual({ patternLong: false });
  });

  test("returns patternLong: true for green impulse + confirming candle", () => {
    // 3 prior bars range=1 each, impulse bar: green, body=2.8/range=3 (93%), large.
    // Confirming candle closes above impulse close.
    const opens  = [100,  100,  100,  100,  103  ];
    const highs  = [101,  101,  101,  103,  103.5];
    const lows   = [100,  100,  100,  100,  102.5];
    const closes = [100.5, 100.5, 100.5, 102.8, 103.2];
    expect(calcCandlePattern(opens, highs, lows, closes)).toEqual({ patternLong: true });
  });

  test("returns patternLong: false when impulse candle is red", () => {
    // impulse open=103 > close=100 → red candle
    const opens  = [100,  100,  100,  103,  103  ];
    const highs  = [101,  101,  101,  103,  103.5];
    const lows   = [100,  100,  100,  100,  102.5];
    const closes = [100.5, 100.5, 100.5, 100,  103.2];
    expect(calcCandlePattern(opens, highs, lows, closes)).toEqual({ patternLong: false });
  });

  test("returns patternLong: false when impulse body is too weak", () => {
    // body=0.1, range=3 → ratio 0.033 < 0.5 threshold
    const opens  = [100,  100,  100,  100,  103  ];
    const highs  = [101,  101,  101,  103,  103.5];
    const lows   = [100,  100,  100,  100,  102.5];
    const closes = [100.5, 100.5, 100.5, 100.1, 103.2];
    expect(calcCandlePattern(opens, highs, lows, closes)).toEqual({ patternLong: false });
  });

  test("returns patternLong: false when confirming candle does not exceed impulse close", () => {
    // confirming close=102.5 < impulse close=102.8
    const opens  = [100,  100,  100,  100,  102  ];
    const highs  = [101,  101,  101,  103,  102.5];
    const lows   = [100,  100,  100,  100,  101  ];
    const closes = [100.5, 100.5, 100.5, 102.8, 102.5];
    expect(calcCandlePattern(opens, highs, lows, closes)).toEqual({ patternLong: false });
  });
});

// ---------------------------------------------------------------------------
// calcFlagPattern helpers
// Build a pole+flag+breakout dataset with configurable params.
// poleLen=5, flagLen=4 → need 10+ bars total (5 pole + 4 flag + 1 breakout)
function makeFlagData({ poleGain = 2, flagRetraceRatio = 0.2, flagRangeRatio = 0.5, breakout = true, withVolume = false, volConfirmed = true } = {}) {
  // Pole: 5 bars rising from 100 to 100*(1+poleGain/100)
  const poleStart = 100;
  const poleEnd   = poleStart * (1 + poleGain / 100);
  const poleStep  = (poleEnd - poleStart) / 5;
  const closes = [], highs = [], lows = [], volumes = [];

  // Pole bars — high volume (1000)
  for (let i = 0; i < 5; i++) {
    const c = poleStart + poleStep * (i + 1);
    closes.push(c); highs.push(c + 0.5); lows.push(c - 0.5);
    volumes.push(1000);
  }

  // Flag: 4 bars of tight consolidation, slight drift down — low volume (200)
  const flagTop  = poleEnd;
  const flagDrop = poleGain * flagRetraceRatio;
  for (let i = 0; i < 4; i++) {
    const c = flagTop - (flagDrop / 4) * (i + 1);
    const r = 0.5 * flagRangeRatio;
    closes.push(c); highs.push(c + r); lows.push(c - r);
    volumes.push(200);
  }

  // Flag high (max of flag highs)
  const flagHigh = Math.max(...highs.slice(5));

  // Breakout bar — volume expands if confirmed (800), stays low if not (100)
  const breakoutClose = breakout ? flagHigh + 0.5 : flagHigh - 0.5;
  closes.push(breakoutClose);
  highs.push(breakoutClose + 0.2);
  lows.push(breakoutClose - 0.2);
  volumes.push(volConfirmed ? 800 : 100);

  return { closes, highs, lows, volumes: withVolume ? volumes : null };
}

describe("calcFlagPattern", () => {
  test("returns null when insufficient bars", () => {
    expect(calcFlagPattern([100, 101], [101, 102], [99, 100])).toBeNull();
  });

  test("returns patternFlag: true for a valid pole + flag + breakout", () => {
    const { closes, highs, lows } = makeFlagData();
    const r = calcFlagPattern(closes, highs, lows);
    expect(r).not.toBeNull();
    expect(r.patternFlag).toBe(true);
    expect(r.poleGainPct).toBeGreaterThan(0);
  });

  test("returns patternFlag: false when pole gain is too small", () => {
    const { closes, highs, lows } = makeFlagData({ poleGain: 0.1 }); // below minPolePct=0.4
    expect(calcFlagPattern(closes, highs, lows).patternFlag).toBe(false);
  });

  test("returns patternFlag: false when no breakout above flag high", () => {
    const { closes, highs, lows } = makeFlagData({ breakout: false });
    expect(calcFlagPattern(closes, highs, lows).patternFlag).toBe(false);
  });

  test("returns patternFlag: false when flag retraces too much of the pole", () => {
    // 80% retrace of pole — exceeds 50% threshold
    const { closes, highs, lows } = makeFlagData({ flagRetraceRatio: 0.8 });
    expect(calcFlagPattern(closes, highs, lows).patternFlag).toBe(false);
  });

  test("returns patternFlag: false when flag is not tight (wide consolidation)", () => {
    // flagRangeRatio=2 makes flag bars wider than pole bars
    const { closes, highs, lows } = makeFlagData({ flagRangeRatio: 2 });
    expect(calcFlagPattern(closes, highs, lows).patternFlag).toBe(false);
  });

  // ── Volume confirmation ────────────────────────────────────────────────────
  test("returns patternFlag: true with valid volume confirmation", () => {
    const { closes, highs, lows, volumes } = makeFlagData({ withVolume: true, volConfirmed: true });
    expect(calcFlagPattern(closes, highs, lows, {}, volumes).patternFlag).toBe(true);
  });

  test("returns patternFlag: false when breakout bar volume does not expand", () => {
    // pole vol=1000, flag vol=200, breakout vol=100 — no burst
    const { closes, highs, lows, volumes } = makeFlagData({ withVolume: true, volConfirmed: false });
    expect(calcFlagPattern(closes, highs, lows, {}, volumes).patternFlag).toBe(false);
  });

  test("ignores volume when volumes array is not provided", () => {
    // Without volumes, a valid price pattern still returns true
    const { closes, highs, lows } = makeFlagData();
    expect(calcFlagPattern(closes, highs, lows, {}, null).patternFlag).toBe(true);
  });
});

describe("calcVWAP", () => {
  // Helper: build uniform bars at a fixed price with 60s spacing
  function makeBars(n, price = 100, startTs = 1_000_000) {
    const closes     = Array(n).fill(price);
    const highs      = Array(n).fill(price + 1);
    const lows       = Array(n).fill(price - 1);
    const timestamps = Array.from({ length: n }, (_, i) => startTs + i * 60_000);
    return { closes, highs, lows, timestamps };
  }

  test("returns null when fewer than 2 bars", () => {
    const { closes, highs, lows, timestamps } = makeBars(1);
    expect(calcVWAP(closes, highs, lows, timestamps)).toBeNull();
  });

  test("returns null when timestamps are missing", () => {
    const { closes, highs, lows } = makeBars(10);
    expect(calcVWAP(closes, highs, lows, null)).toBeNull();
  });

  test("vwap equals typical price for uniform bars", () => {
    // typical price = (high+low+close)/3 = (101+99+100)/3 = 100
    const { closes, highs, lows, timestamps } = makeBars(20);
    const r = calcVWAP(closes, highs, lows, timestamps);
    expect(r).not.toBeNull();
    expect(r.vwap).toBeCloseTo(100);
  });

  test("priceAboveVwap is true when close > vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    // nudge the last close above vwap
    closes[closes.length - 1] = 105;
    const r = calcVWAP(closes, highs, lows, timestamps);
    expect(r.priceAboveVwap).toBe(true);
  });

  test("priceAboveVwap is false when close <= vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    closes[closes.length - 1] = 95;
    const r = calcVWAP(closes, highs, lows, timestamps);
    expect(r.priceAboveVwap).toBe(false);
  });

  test("recentPullback is true when a prior close crossed below vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    // VWAP ≈ 100 (typical price = (101+99+100)/3 = 100); bar 3 bars ago dips below
    closes[closes.length - 3] = 98; // genuinely below vwap
    const r = calcVWAP(closes, highs, lows, timestamps, { pullback_lookback: 5 });
    expect(r.recentPullback).toBe(true);
  });

  test("recentPullback is false when prior closes were near but not below vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    // All closes at or above typical-price VWAP — proximity is not enough
    for (let i = 0; i < closes.length; i++) closes[i] = 100.5;
    const r = calcVWAP(closes, highs, lows, timestamps, { pullback_lookback: 5 });
    expect(r.recentPullback).toBe(false);
  });

  test("recentPullback is false when all prior closes are well above vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    for (let i = 0; i < closes.length; i++) closes[i] = 110;
    const r = calcVWAP(closes, highs, lows, timestamps, { pullback_lookback: 5 });
    expect(r.recentPullback).toBe(false);
  });

  test("reclaimed is true when close is at or above vwap", () => {
    const { closes, highs, lows, timestamps } = makeBars(20, 100);
    const r = calcVWAP(closes, highs, lows, timestamps, { reclaim_tolerance_pct: 0.1 });
    expect(r.reclaimed).toBe(true);
  });

  test("result object has all expected keys", () => {
    const { closes, highs, lows, timestamps } = makeBars(20);
    const r = calcVWAP(closes, highs, lows, timestamps);
    expect(r).toHaveProperty("vwap");
    expect(r).toHaveProperty("priceAboveVwap");
    expect(r).toHaveProperty("vwapSlopeUp");
    expect(r).toHaveProperty("recentPullback");
    expect(r).toHaveProperty("reclaimed");
  });
});

// ---------------------------------------------------------------------------
describe("calcMassIndex", () => {
  // Minimum data needed: period*2 + sumPeriod = 9*2 + 25 = 43 bars
  const N = 50;
  // Uniform range of 2 → all EMA ratios ≈ 1 → MI ≈ sumPeriod = 25
  const uniformHighs  = Array(N).fill(11);
  const uniformLows   = Array(N).fill(9);

  test("returns null when arrays are too short", () => {
    expect(calcMassIndex([10, 10], [8, 8], 9, 25)).toBeNull();
  });

  test("returns null when inputs are falsy", () => {
    expect(calcMassIndex(null, null)).toBeNull();
  });

  test("returns object with value on sufficient data", () => {
    const result = calcMassIndex(uniformHighs, uniformLows);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("value");
    expect(typeof result.value).toBe("number");
  });

  test("uniform range yields MI close to sumPeriod (ratio ≈ 1 each bar)", () => {
    const result = calcMassIndex(uniformHighs, uniformLows, 9, 25);
    // Each ratio ≈ 1, so sum of 25 ratios ≈ 25
    expect(result.value).toBeCloseTo(25, 0);
  });

  test("expanding range produces MI > 25", () => {
    // Gradually increasing range: ratio > 1 → MI grows
    const expandingHighs = Array.from({ length: N }, (_, i) => 10 + i * 0.1);
    const expandingLows  = Array.from({ length: N }, (_, i) => 10 - i * 0.1);
    const result = calcMassIndex(expandingHighs, expandingLows, 9, 25);
    expect(result).not.toBeNull();
    expect(result.value).toBeGreaterThan(25);
  });
});

// ---------------------------------------------------------------------------
describe("calcAroon", () => {
  // Build a 30-bar series where bar 29 (last) is the absolute high/low
  const period = 25;
  const N = period + 1;

  test("returns null when arrays are too short", () => {
    expect(calcAroon([10, 10], [8, 8], 25)).toBeNull();
  });

  test("returns null when inputs are falsy", () => {
    expect(calcAroon(null, null)).toBeNull();
  });

  test("returns { up, down, oscillator } on sufficient data", () => {
    const highs = Array(N).fill(10);
    const lows  = Array(N).fill(5);
    const result = calcAroon(highs, lows, period);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("up");
    expect(result).toHaveProperty("down");
    expect(result).toHaveProperty("oscillator");
  });

  test("up = 100 when current bar is the period high", () => {
    const highs = [...Array(period).fill(10), 20]; // last bar is highest
    const lows  = Array(N).fill(5);
    const result = calcAroon(highs, lows, period);
    expect(result.up).toBe(100);
  });

  test("down = 100 when current bar is the period low", () => {
    const highs = Array(N).fill(10);
    const lows  = [...Array(period).fill(5), 1]; // last bar is lowest
    const result = calcAroon(highs, lows, period);
    expect(result.down).toBe(100);
  });

  test("oscillator = up - down", () => {
    const highs = Array(N).fill(10);
    const lows  = Array(N).fill(5);
    const result = calcAroon(highs, lows, period);
    expect(result.oscillator).toBeCloseTo(result.up - result.down);
  });

  test("up = 0 when period high occurred period bars ago (oldest bar)", () => {
    // First bar is the high, current bar is not the high
    const highs = [20, ...Array(period).fill(10)];
    const lows  = Array(N).fill(5);
    const result = calcAroon(highs, lows, period);
    expect(result.up).toBe(0);
  });

  test("strong uptrend: up > 70 and down < 30", () => {
    // Recent high in last few bars, no recent low
    const highs = [...Array(period - 2).fill(10), 15, 18, 20];
    const lows  = [1, ...Array(period).fill(5)]; // low was at bar 0 (oldest)
    const result = calcAroon(highs, lows, period);
    expect(result.up).toBeGreaterThanOrEqual(70);
    expect(result.down).toBeLessThanOrEqual(30);
    expect(result.oscillator).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calcADX
// ---------------------------------------------------------------------------
describe("calcADX", () => {
  // Generate trending data: monotonically rising closes with expanding range
  function makeTrend(n, start = 100, step = 1) {
    const closes = Array.from({ length: n }, (_, i) => start + i * step);
    const highs  = closes.map(c => c + 2);
    const lows   = closes.map(c => c - 1);
    return { highs, lows, closes };
  }

  test("returns null for insufficient data", () => {
    const { highs, lows, closes } = makeTrend(20);
    expect(calcADX(highs, lows, closes, 14)).toBeNull();
  });

  test("returns object with value, diPlus, diMinus for sufficient data", () => {
    const { highs, lows, closes } = makeTrend(50);
    const result = calcADX(highs, lows, closes, 14);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.diPlus).toBe("number");
    expect(typeof result.diMinus).toBe("number");
  });

  test("ADX is between 0 and 100", () => {
    const { highs, lows, closes } = makeTrend(60);
    const result = calcADX(highs, lows, closes, 14);
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
  });

  test("strong uptrend: diPlus > diMinus", () => {
    const { highs, lows, closes } = makeTrend(60, 100, 2);
    const result = calcADX(highs, lows, closes, 14);
    expect(result.diPlus).toBeGreaterThan(result.diMinus);
  });

  test("strong downtrend: diMinus > diPlus", () => {
    const n = 60;
    const closes = Array.from({ length: n }, (_, i) => 200 - i * 2);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 2);
    const result = calcADX(highs, lows, closes, 14);
    expect(result.diMinus).toBeGreaterThan(result.diPlus);
  });

  test("returns null for null inputs", () => {
    expect(calcADX(null, null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calcSupertrend
// ---------------------------------------------------------------------------
describe("calcSupertrend", () => {
  function makeTrend(n, start = 100, step = 1) {
    const closes = Array.from({ length: n }, (_, i) => start + i * step);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    return { highs, lows, closes };
  }

  test("returns null for insufficient data", () => {
    const { highs, lows, closes } = makeTrend(5);
    expect(calcSupertrend(highs, lows, closes, 10)).toBeNull();
  });

  test("returns object with value, bullish, bearish, distance", () => {
    const { highs, lows, closes } = makeTrend(30);
    const result = calcSupertrend(highs, lows, closes, 10, 3.0);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.bullish).toBe("boolean");
    expect(typeof result.bearish).toBe("boolean");
    expect(typeof result.distance).toBe("number");
  });

  test("bullish and bearish are mutually exclusive", () => {
    const { highs, lows, closes } = makeTrend(30);
    const result = calcSupertrend(highs, lows, closes, 10, 3.0);
    expect(result.bullish).toBe(!result.bearish);
  });

  test("uptrend data produces bullish=true", () => {
    const { highs, lows, closes } = makeTrend(40, 100, 3);
    const result = calcSupertrend(highs, lows, closes, 10, 3.0);
    expect(result.bullish).toBe(true);
  });

  test("downtrend data produces bearish=true", () => {
    const n = 40;
    const closes = Array.from({ length: n }, (_, i) => 300 - i * 3);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    const result = calcSupertrend(highs, lows, closes, 10, 3.0);
    expect(result.bearish).toBe(true);
  });

  test("distance is non-negative", () => {
    const { highs, lows, closes } = makeTrend(30);
    const result = calcSupertrend(highs, lows, closes, 10, 3.0);
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });

  test("returns null for null inputs", () => {
    expect(calcSupertrend(null, null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calcOBV
// ---------------------------------------------------------------------------
describe("calcOBV", () => {
  const closes  = [10, 11, 10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19, 18, 20, 21];
  const volumes = closes.map(() => 100);

  test("returns null for null inputs", () => {
    expect(calcOBV(null, null)).toBeNull();
  });

  test("returns null for insufficient data (< 2 bars)", () => {
    expect(calcOBV([10], [100])).toBeNull();
  });

  test("returns null when closes and volumes lengths differ", () => {
    expect(calcOBV([10, 11, 12], [100, 200])).toBeNull();
  });

  test("returns object with value, rising, smaRatio for sufficient data", () => {
    const result = calcOBV(closes, volumes, 10);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.rising).toBe("boolean");
    expect(typeof result.smaRatio).toBe("number");
  });

  test("OBV increases on up-close", () => {
    const c = [10, 11];
    const v = [100, 200];
    const r = calcOBV(c, v, 1);
    expect(r.value).toBe(200);
  });

  test("OBV decreases on down-close", () => {
    const c = [10, 9];
    const v = [100, 200];
    const r = calcOBV(c, v, 1);
    expect(r.value).toBe(-200);
  });

  test("OBV unchanged on flat close", () => {
    const c = [10, 10];
    const v = [100, 200];
    const r = calcOBV(c, v, 1);
    expect(r.value).toBe(0);
  });

  test("rising=true when OBV above its SMA (consistent uptrend)", () => {
    // All up-closes: OBV always rising, will be above its own SMA
    const upCloses  = Array.from({ length: 25 }, (_, i) => 10 + i);
    const upVolumes = Array(25).fill(100);
    const result = calcOBV(upCloses, upVolumes, 20);
    expect(result.rising).toBe(true);
  });

  test("rising=false when OBV below its SMA (consistent downtrend)", () => {
    // All down-closes: OBV always falling, will be below its own SMA
    const downCloses  = Array.from({ length: 25 }, (_, i) => 100 - i);
    const downVolumes = Array(25).fill(100);
    const result = calcOBV(downCloses, downVolumes, 20);
    expect(result.rising).toBe(false);
  });

  test("returns null rising/smaRatio when fewer bars than smaPeriod", () => {
    const result = calcOBV([10, 11, 12], [100, 100, 100], 20);
    expect(result).not.toBeNull();
    expect(result.rising).toBeNull();
    expect(result.smaRatio).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calcParabolicSAR
// ---------------------------------------------------------------------------
describe("calcParabolicSAR", () => {
  function makeTrend(n, start = 100, step = 1) {
    const closes = Array.from({ length: n }, (_, i) => start + i * step);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcParabolicSAR(null, null, null)).toBeNull();
  });

  test("returns null for fewer than 2 bars", () => {
    expect(calcParabolicSAR([100], [99], [100])).toBeNull();
  });

  test("returns object with value, bullish, bearish", () => {
    const { highs, lows, closes } = makeTrend(20);
    const result = calcParabolicSAR(highs, lows, closes);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.bullish).toBe("boolean");
    expect(typeof result.bearish).toBe("boolean");
  });

  test("bullish and bearish are mutually exclusive", () => {
    const { highs, lows, closes } = makeTrend(20);
    const result = calcParabolicSAR(highs, lows, closes);
    expect(result.bullish).toBe(!result.bearish);
  });

  test("uptrend produces bullish=true", () => {
    const { highs, lows, closes } = makeTrend(30, 100, 2);
    const result = calcParabolicSAR(highs, lows, closes);
    expect(result.bullish).toBe(true);
  });

  test("downtrend produces bearish=true", () => {
    const n = 30;
    const closes = Array.from({ length: n }, (_, i) => 200 - i * 2);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    const result = calcParabolicSAR(highs, lows, closes);
    expect(result.bearish).toBe(true);
  });

  test("SAR is below price in uptrend (bullish)", () => {
    const { highs, lows, closes } = makeTrend(30, 100, 2);
    const result = calcParabolicSAR(highs, lows, closes);
    const lastClose = closes[closes.length - 1];
    expect(result.value).toBeLessThan(lastClose);
  });

  test("SAR is above price in downtrend (bearish)", () => {
    const n = 30;
    const closes = Array.from({ length: n }, (_, i) => 200 - i * 2);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    const result = calcParabolicSAR(highs, lows, closes);
    const lastClose = closes[closes.length - 1];
    expect(result.value).toBeGreaterThan(lastClose);
  });
});

// ---------------------------------------------------------------------------
// calcAlligator
// ---------------------------------------------------------------------------
describe("calcAlligator", () => {
  function uptrend(n) {
    return Array.from({ length: n }, (_, i) => 100 + i * 1);
  }
  function downtrend(n) {
    return Array.from({ length: n }, (_, i) => 200 - i * 1);
  }

  test("returns null for null input", () => {
    expect(calcAlligator(null)).toBeNull();
  });

  test("returns null for insufficient data (< jawPeriod+1)", () => {
    expect(calcAlligator(Array(13).fill(100))).toBeNull();
  });

  test("returns object with jaw, teeth, lips, bullish, bearish, sleeping", () => {
    const result = calcAlligator(uptrend(50));
    expect(result).not.toBeNull();
    expect(typeof result.jaw).toBe("number");
    expect(typeof result.teeth).toBe("number");
    expect(typeof result.lips).toBe("number");
    expect(typeof result.bullish).toBe("boolean");
    expect(typeof result.bearish).toBe("boolean");
    expect(typeof result.sleeping).toBe("boolean");
  });

  test("exactly one of bullish/bearish/sleeping is true", () => {
    const result = calcAlligator(uptrend(50));
    const flags = [result.bullish, result.bearish, result.sleeping].filter(Boolean);
    expect(flags.length).toBe(1);
  });

  test("sleeping = !bullish && !bearish", () => {
    const result = calcAlligator(uptrend(50));
    expect(result.sleeping).toBe(!result.bullish && !result.bearish);
  });

  test("sustained uptrend produces bullish=true (lips > teeth > jaw)", () => {
    const result = calcAlligator(uptrend(100));
    expect(result.bullish).toBe(true);
    expect(result.lips).toBeGreaterThan(result.teeth);
    expect(result.teeth).toBeGreaterThan(result.jaw);
  });

  test("sustained downtrend produces bearish=true (lips < teeth < jaw)", () => {
    const result = calcAlligator(downtrend(100));
    expect(result.bearish).toBe(true);
    expect(result.lips).toBeLessThan(result.teeth);
    expect(result.teeth).toBeLessThan(result.jaw);
  });

  test("lips reacts faster than jaw (lips closer to current price in uptrend)", () => {
    const prices = uptrend(100);
    const last = prices[prices.length - 1];
    const result = calcAlligator(prices);
    expect(Math.abs(result.lips - last)).toBeLessThan(Math.abs(result.jaw - last));
  });
});

// ---------------------------------------------------------------------------
// calcAwesomeOscillator
// ---------------------------------------------------------------------------
describe("calcAwesomeOscillator", () => {
  function makeHL(n, start = 100, step = 1) {
    const highs  = Array.from({ length: n }, (_, i) => start + i * step + 1);
    const lows   = Array.from({ length: n }, (_, i) => start + i * step - 1);
    return { highs, lows };
  }
  function downHL(n) {
    const highs  = Array.from({ length: n }, (_, i) => 200 - i + 1);
    const lows   = Array.from({ length: n }, (_, i) => 200 - i - 1);
    return { highs, lows };
  }

  test("returns null for null inputs", () => {
    expect(calcAwesomeOscillator(null, null)).toBeNull();
  });

  test("returns null when fewer than slowPeriod+1 bars", () => {
    const { highs, lows } = makeHL(34);
    expect(calcAwesomeOscillator(highs, lows)).toBeNull();
  });

  test("returns object with value, positive, negative, rising, falling", () => {
    const { highs, lows } = makeHL(50);
    const result = calcAwesomeOscillator(highs, lows);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.positive).toBe("boolean");
    expect(typeof result.negative).toBe("boolean");
    expect(typeof result.rising).toBe("boolean");
    expect(typeof result.falling).toBe("boolean");
  });

  test("positive and negative are mutually exclusive", () => {
    const { highs, lows } = makeHL(50);
    const result = calcAwesomeOscillator(highs, lows);
    expect(result.positive && result.negative).toBe(false);
  });

  test("uptrend produces positive AO (fast SMA > slow SMA)", () => {
    const { highs, lows } = makeHL(100, 100, 2);
    const result = calcAwesomeOscillator(highs, lows);
    expect(result.positive).toBe(true);
    expect(result.value).toBeGreaterThan(0);
  });

  test("downtrend produces negative AO (fast SMA < slow SMA)", () => {
    const { highs, lows } = downHL(100);
    const result = calcAwesomeOscillator(highs, lows);
    expect(result.negative).toBe(true);
    expect(result.value).toBeLessThan(0);
  });

  test("rising/falling are mutually exclusive", () => {
    const { highs, lows } = makeHL(100, 100, 2);
    const result = calcAwesomeOscillator(highs, lows);
    expect(result.rising && result.falling).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calcROC
// ---------------------------------------------------------------------------
describe("calcROC", () => {
  const uptrend   = (n) => Array.from({ length: n }, (_, i) => 100 + i);
  const downtrend = (n) => Array.from({ length: n }, (_, i) => 200 - i);

  test("returns null for null input", () => {
    expect(calcROC(null)).toBeNull();
  });

  test("returns null for fewer than period+2 bars", () => {
    expect(calcROC(Array(15).fill(100), 14)).toBeNull();
  });

  test("returns object with value, positive, negative, accelerating, decelerating", () => {
    const result = calcROC(uptrend(50));
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.positive).toBe("boolean");
    expect(typeof result.negative).toBe("boolean");
    expect(typeof result.accelerating).toBe("boolean");
    expect(typeof result.decelerating).toBe("boolean");
  });

  test("positive and negative are mutually exclusive", () => {
    const result = calcROC(uptrend(50));
    expect(result.positive && result.negative).toBe(false);
  });

  test("uptrend produces positive ROC", () => {
    const result = calcROC(uptrend(50));
    expect(result.positive).toBe(true);
    expect(result.value).toBeGreaterThan(0);
  });

  test("downtrend produces negative ROC", () => {
    const result = calcROC(downtrend(50));
    expect(result.negative).toBe(true);
    expect(result.value).toBeLessThan(0);
  });

  test("flat prices produce ROC near zero", () => {
    const result = calcROC(Array(50).fill(100));
    expect(result.value).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// calcKeltner
// ---------------------------------------------------------------------------
describe("calcKeltner", () => {
  function makeData(n, start = 100, step = 1) {
    const closes = Array.from({ length: n }, (_, i) => start + i * step);
    const highs  = closes.map(c => c + 2);
    const lows   = closes.map(c => c - 2);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcKeltner(null, null, null)).toBeNull();
  });

  test("returns null for insufficient data", () => {
    const { highs, lows, closes } = makeData(20);
    expect(calcKeltner(highs, lows, closes)).toBeNull();
  });

  test("returns object with upper, middle, lower, priceAbove, priceBelow", () => {
    const { highs, lows, closes } = makeData(50);
    const result = calcKeltner(highs, lows, closes);
    expect(result).not.toBeNull();
    expect(typeof result.upper).toBe("number");
    expect(typeof result.middle).toBe("number");
    expect(typeof result.lower).toBe("number");
    expect(typeof result.priceAbove).toBe("boolean");
    expect(typeof result.priceBelow).toBe("boolean");
  });

  test("upper > middle > lower", () => {
    const { highs, lows, closes } = makeData(50);
    const result = calcKeltner(highs, lows, closes);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  test("priceAbove and priceBelow are mutually exclusive", () => {
    const { highs, lows, closes } = makeData(50);
    const result = calcKeltner(highs, lows, closes);
    expect(result.priceAbove && result.priceBelow).toBe(false);
  });

  test("price well above upper band produces priceAbove=true", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 10);
    const highs  = closes.map(c => c + 2);
    const lows   = closes.map(c => c - 2);
    const result = calcKeltner(highs, lows, closes);
    expect(result.priceAbove).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calcMFI
// ---------------------------------------------------------------------------
describe("calcMFI", () => {
  function makeData(n, start = 100, step = 1) {
    const closes  = Array.from({ length: n }, (_, i) => start + i * step);
    const highs   = closes.map(c => c + 1);
    const lows    = closes.map(c => c - 1);
    const volumes = Array(n).fill(1000);
    return { highs, lows, closes, volumes };
  }

  test("returns null for null inputs", () => {
    expect(calcMFI(null, null, null, null)).toBeNull();
  });

  test("returns null for fewer than period+1 bars", () => {
    const { highs, lows, closes, volumes } = makeData(14);
    expect(calcMFI(highs, lows, closes, volumes)).toBeNull();
  });

  test("returns object with value, overbought, oversold", () => {
    const { highs, lows, closes, volumes } = makeData(30);
    const result = calcMFI(highs, lows, closes, volumes);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.overbought).toBe("boolean");
    expect(typeof result.oversold).toBe("boolean");
  });

  test("value is between 0 and 100", () => {
    const { highs, lows, closes, volumes } = makeData(30);
    const result = calcMFI(highs, lows, closes, volumes);
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
  });

  test("strong uptrend → overbought=true", () => {
    const { highs, lows, closes, volumes } = makeData(30, 100, 5);
    const result = calcMFI(highs, lows, closes, volumes);
    expect(result.overbought).toBe(true);
  });

  test("strong downtrend → oversold=true", () => {
    const closes  = Array.from({ length: 30 }, (_, i) => 300 - i * 5);
    const highs   = closes.map(c => c + 1);
    const lows    = closes.map(c => c - 1);
    const volumes = Array(30).fill(1000);
    const result = calcMFI(highs, lows, closes, volumes);
    expect(result.oversold).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calcCMF
// ---------------------------------------------------------------------------
describe("calcCMF", () => {
  function makeData(n, step = 1) {
    const closes  = Array.from({ length: n }, (_, i) => 100 + i * step);
    const highs   = closes.map(c => c + 2);
    const lows    = closes.map(c => c - 2);
    const volumes = Array(n).fill(1000);
    return { highs, lows, closes, volumes };
  }

  test("returns null for null inputs", () => {
    expect(calcCMF(null, null, null, null)).toBeNull();
  });

  test("returns null for insufficient data", () => {
    const { highs, lows, closes, volumes } = makeData(19);
    expect(calcCMF(highs, lows, closes, volumes)).toBeNull();
  });

  test("returns object with value, bullish, bearish", () => {
    const { highs, lows, closes, volumes } = makeData(30);
    const result = calcCMF(highs, lows, closes, volumes);
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.bullish).toBe("boolean");
    expect(typeof result.bearish).toBe("boolean");
  });

  test("bullish and bearish are mutually exclusive", () => {
    const { highs, lows, closes, volumes } = makeData(30);
    const result = calcCMF(highs, lows, closes, volumes);
    expect(result.bullish && result.bearish).toBe(false);
  });

  test("close near high produces positive CMF (bullish)", () => {
    // Close = high - small offset → positive MFM
    const n = 30;
    const highs   = Array.from({ length: n }, () => 110);
    const lows    = Array.from({ length: n }, () => 90);
    const closes  = Array.from({ length: n }, () => 108); // near high
    const volumes = Array(n).fill(1000);
    const result = calcCMF(highs, lows, closes, volumes);
    expect(result.bullish).toBe(true);
  });

  test("close near low produces negative CMF (bearish)", () => {
    const n = 30;
    const highs   = Array.from({ length: n }, () => 110);
    const lows    = Array.from({ length: n }, () => 90);
    const closes  = Array.from({ length: n }, () => 92); // near low
    const volumes = Array(n).fill(1000);
    const result = calcCMF(highs, lows, closes, volumes);
    expect(result.bearish).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calcDonchian
// ---------------------------------------------------------------------------
describe("calcDonchian", () => {
  function makeData(n, start = 100, step = 1) {
    const closes = Array.from({ length: n }, (_, i) => start + i * step);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcDonchian(null, null, null)).toBeNull();
  });

  test("returns null for insufficient data (< period+1)", () => {
    const { highs, lows, closes } = makeData(20);
    expect(calcDonchian(highs, lows, closes)).toBeNull();
  });

  test("returns object with upper, middle, lower, priceAbove, priceBelow", () => {
    const { highs, lows, closes } = makeData(30);
    const result = calcDonchian(highs, lows, closes);
    expect(result).not.toBeNull();
    expect(typeof result.upper).toBe("number");
    expect(typeof result.middle).toBe("number");
    expect(typeof result.lower).toBe("number");
    expect(typeof result.priceAbove).toBe("boolean");
    expect(typeof result.priceBelow).toBe("boolean");
  });

  test("upper > middle > lower", () => {
    const { highs, lows, closes } = makeData(30);
    const result = calcDonchian(highs, lows, closes);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  test("upper equals prior-period high, lower equals prior-period low", () => {
    const { highs, lows, closes } = makeData(30);
    const result = calcDonchian(highs, lows, closes);
    // Channel is from prior period bars (exclude current bar)
    const expectedUpper = Math.max(...highs.slice(-21, -1));
    const expectedLower = Math.min(...lows.slice(-21, -1));
    expect(result.upper).toBeCloseTo(expectedUpper, 5);
    expect(result.lower).toBeCloseTo(expectedLower, 5);
  });

  test("priceAbove and priceBelow are mutually exclusive", () => {
    const { highs, lows, closes } = makeData(30);
    const result = calcDonchian(highs, lows, closes);
    expect(result.priceAbove && result.priceBelow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calcHMA
// ---------------------------------------------------------------------------
describe("calcHMA", () => {
  const uptrend = (n) => Array.from({ length: n }, (_, i) => 100 + i);

  test("returns null for null input", () => {
    expect(calcHMA(null)).toBeNull();
  });

  test("returns null for insufficient data", () => {
    expect(calcHMA(Array(23).fill(100))).toBeNull();
  });

  test("returns object with value, rising, falling", () => {
    const result = calcHMA(uptrend(60));
    expect(result).not.toBeNull();
    expect(typeof result.value).toBe("number");
    expect(typeof result.rising).toBe("boolean");
    expect(typeof result.falling).toBe("boolean");
  });

  test("rising and falling are mutually exclusive", () => {
    const result = calcHMA(uptrend(60));
    expect(result.rising && result.falling).toBe(false);
  });

  test("sustained uptrend produces rising=true", () => {
    const result = calcHMA(uptrend(60));
    expect(result.rising).toBe(true);
  });

  test("sustained downtrend produces falling=true", () => {
    const prices = Array.from({ length: 60 }, (_, i) => 200 - i);
    const result = calcHMA(prices);
    expect(result.falling).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calc52WeekHighLow
// ---------------------------------------------------------------------------
describe("calc52WeekHighLow", () => {
  test("returns null for null input", () => {
    expect(calc52WeekHighLow(null)).toBeNull();
  });

  test("returns null for fewer than 2 bars", () => {
    expect(calc52WeekHighLow([100])).toBeNull();
  });

  test("returns object with expected fields", () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + i);
    const result = calc52WeekHighLow(prices);
    expect(result).not.toBeNull();
    expect(typeof result.high52).toBe("number");
    expect(typeof result.low52).toBe("number");
    expect(typeof result.pctFromHigh).toBe("number");
    expect(typeof result.pctFromLow).toBe("number");
    expect(typeof result.nearHigh).toBe("boolean");
    expect(typeof result.nearLow).toBe("boolean");
  });

  test("high52 >= low52", () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = calc52WeekHighLow(prices);
    expect(result.high52).toBeGreaterThanOrEqual(result.low52);
  });

  test("price at 52-week high produces nearHigh=true", () => {
    const prices = Array.from({ length: 100 }, () => 100);
    prices[prices.length - 1] = 100; // at the high
    const result = calc52WeekHighLow(prices, 5);
    expect(result.nearHigh).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calcPivotPoints
// ---------------------------------------------------------------------------
describe("calcPivotPoints", () => {
  function makeData(n) {
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const highs  = closes.map(c => c + 5);
    const lows   = closes.map(c => c - 5);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcPivotPoints(null, null, null)).toBeNull();
  });

  test("returns null for fewer than 2 bars", () => {
    expect(calcPivotPoints([110], [90], [100])).toBeNull();
  });

  test("returns object with pivot, r1, r2, s1, s2, abovePivot, belowPivot", () => {
    const { highs, lows, closes } = makeData(10);
    const result = calcPivotPoints(highs, lows, closes);
    expect(result).not.toBeNull();
    expect(typeof result.pivot).toBe("number");
    expect(typeof result.r1).toBe("number");
    expect(typeof result.r2).toBe("number");
    expect(typeof result.s1).toBe("number");
    expect(typeof result.s2).toBe("number");
    expect(typeof result.abovePivot).toBe("boolean");
    expect(typeof result.belowPivot).toBe("boolean");
  });

  test("r1 > pivot > s1", () => {
    const { highs, lows, closes } = makeData(10);
    const result = calcPivotPoints(highs, lows, closes);
    expect(result.r1).toBeGreaterThan(result.pivot);
    expect(result.pivot).toBeGreaterThan(result.s1);
  });

  test("abovePivot and belowPivot are mutually exclusive", () => {
    const { highs, lows, closes } = makeData(10);
    const result = calcPivotPoints(highs, lows, closes);
    expect(result.abovePivot && result.belowPivot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calcFibonacci
// ---------------------------------------------------------------------------
describe("calcFibonacci", () => {
  function makeData(n) {
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const highs  = closes.map(c => c + 1);
    const lows   = closes.map(c => c - 1);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcFibonacci(null, null, null)).toBeNull();
  });

  test("returns null for insufficient data", () => {
    const { highs, lows, closes } = makeData(50);
    expect(calcFibonacci(highs, lows, closes)).toBeNull();
  });

  test("returns object with expected fields", () => {
    const { highs, lows, closes } = makeData(60);
    const result = calcFibonacci(highs, lows, closes);
    expect(result).not.toBeNull();
    expect(typeof result.swingHigh).toBe("number");
    expect(typeof result.swingLow).toBe("number");
    expect(typeof result.level382).toBe("number");
    expect(typeof result.level618).toBe("number");
    expect(typeof result.nearLevel).toBe("boolean");
  });

  test("levels are ordered: swingLow < level786 < level618 < level500 < level382 < level236 < swingHigh", () => {
    const { highs, lows, closes } = makeData(60);
    const r = calcFibonacci(highs, lows, closes);
    expect(r.swingLow).toBeLessThan(r.level786);
    expect(r.level786).toBeLessThan(r.level618);
    expect(r.level618).toBeLessThan(r.level500);
    expect(r.level500).toBeLessThan(r.level382);
    expect(r.level382).toBeLessThan(r.level236);
    expect(r.level236).toBeLessThan(r.swingHigh);
  });
});

// calcIchimoku
// ---------------------------------------------------------------------------
describe("calcIchimoku", () => {
  // Minimum data: senkouBPeriod(52) + displacement(26) = 78 bars
  function makeData(n, startPrice = 100) {
    const closes = Array.from({ length: n }, (_, i) => startPrice + i);
    const highs  = closes.map(c => c + 2);
    const lows   = closes.map(c => c - 2);
    return { highs, lows, closes };
  }

  test("returns null for null inputs", () => {
    expect(calcIchimoku(null, null, null)).toBeNull();
  });

  test("returns null for insufficient data (77 bars < 78 minimum)", () => {
    const { highs, lows, closes } = makeData(77);
    expect(calcIchimoku(highs, lows, closes)).toBeNull();
  });

  test("returns object with all expected fields at minimum data (78 bars)", () => {
    const { highs, lows, closes } = makeData(78);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    expect(typeof r.tenkan).toBe("number");
    expect(typeof r.kijun).toBe("number");
    expect(typeof r.senkouA).toBe("number");
    expect(typeof r.senkouB).toBe("number");
    expect(typeof r.aboveCloud).toBe("boolean");
    expect(typeof r.belowCloud).toBe("boolean");
    expect(typeof r.inCloud).toBe("boolean");
    expect(typeof r.cloudBullish).toBe("boolean");
    expect(typeof r.tkBullish).toBe("boolean");
    expect(typeof r.tkBearish).toBe("boolean");
    expect(typeof r.chikouConfirm).toBe("boolean");
  });

  test("aboveCloud, belowCloud, inCloud are mutually exclusive and exhaustive", () => {
    const { highs, lows, closes } = makeData(100);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    const count = [r.aboveCloud, r.belowCloud, r.inCloud].filter(Boolean).length;
    expect(count).toBe(1);
  });

  test("rising price series: aboveCloud is true (price well above 52-bar midpoint)", () => {
    // 200-bar strongly rising series — latest close is far above all historical midpoints
    const { highs, lows, closes } = makeData(200);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    expect(r.aboveCloud).toBe(true);
  });

  test("cloudBullish reflects senkouA > senkouB", () => {
    const { highs, lows, closes } = makeData(100);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    expect(r.cloudBullish).toBe(r.senkouA > r.senkouB);
  });

  test("chikouConfirm: true when current close > close 26 bars ago (rising series)", () => {
    const { highs, lows, closes } = makeData(100);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    // Rising series: close[99] > close[73] — should be true
    expect(r.chikouConfirm).toBe(true);
  });

  test("chikouConfirm: false when current close < close 26 bars ago (falling series)", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 200 - i); // falling
    const highs  = closes.map(c => c + 2);
    const lows   = closes.map(c => c - 2);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    expect(r.chikouConfirm).toBe(false);
  });

  test("tkBullish and tkBearish are mutually exclusive (not both true)", () => {
    const { highs, lows, closes } = makeData(100);
    const r = calcIchimoku(highs, lows, closes);
    expect(r).not.toBeNull();
    expect(r.tkBullish && r.tkBearish).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("calcAscendingTriangle", () => {
  // Build a 60-bar series with flat resistance ~120 and ascending swing lows.
  // Structure: zigzag pattern — peaks near 120, troughs ascending 100→104→108→112.
  function makeAscendingTriangle() {
    // 14-bar zigzag cycle repeated 4 times, then 2 final bars
    // Each cycle: rise to resistance, pull back to ascending low
    const highs   = [];
    const lows    = [];
    const closes  = [];
    const volumes = [];

    // 4 coiling cycles — ascending troughs: 100, 104, 108, 112
    const troughs = [100, 104, 108, 112];
    for (let c = 0; c < 4; c++) {
      const trough = troughs[c];
      // rising phase: 6 bars up toward ~120
      for (let j = 0; j < 6; j++) {
        const price = trough + (120 - trough) * (j + 1) / 6;
        highs.push(price + 0.5); lows.push(price - 1); closes.push(price); volumes.push(1000);
      }
      // descending phase: 7 bars down to trough (creates the swing low)
      for (let j = 6; j >= 0; j--) {
        const price = trough + (120 - trough) * j / 6;
        highs.push(price + 0.5); lows.push(price - 1); closes.push(price); volumes.push(1000);
      }
    }
    // Last completed bar: below resistance
    highs.push(119.8); lows.push(113); closes.push(116); volumes.push(1000);
    // Current bar: close above resistance with high volume
    highs.push(122); lows.push(119.5); closes.push(121.5); volumes.push(2500);
    return { highs, lows, closes, volumes };
  }

  test("returns EMPTY for insufficient data", () => {
    const r = calcAscendingTriangle([], [], [], []);
    expect(r.isAscendingTriangle).toBe(false);
    expect(r.resistance).toBeNull();
  });

  test("returns shape with all expected fields", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    const r = calcAscendingTriangle(highs, lows, closes, volumes);
    expect(typeof r.isAscendingTriangle).toBe("boolean");
    expect(r.resistance).not.toBeNull();
    expect(r.lowestLow).not.toBeNull();
    expect(r.target).not.toBeNull();
    expect(typeof r.breakoutVolConfirmed).toBe("boolean");
  });

  test("detects breakout: isAscendingTriangle true when close > resistance + vol high", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    const r = calcAscendingTriangle(highs, lows, closes, volumes);
    expect(r.isAscendingTriangle).toBe(true);
    expect(r.breakoutVolConfirmed).toBe(true);
  });

  test("no breakout when current close is below resistance", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    closes[closes.length - 1] = 118; // below resistance ~120
    const r = calcAscendingTriangle(highs, lows, closes, volumes);
    expect(r.isAscendingTriangle).toBe(false);
  });

  test("no breakout when volume is below threshold", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    volumes[volumes.length - 1] = 500; // low volume — below 1.2× avg of 1000
    const r = calcAscendingTriangle(highs, lows, closes, volumes);
    expect(r.isAscendingTriangle).toBe(false);
    expect(r.breakoutVolConfirmed).toBe(false);
  });

  test("target = resistance + (resistance - lowestLow)", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    const r = calcAscendingTriangle(highs, lows, closes, volumes);
    expect(r.isAscendingTriangle).toBe(true);
    expect(r.target).toBeCloseTo(r.resistance + (r.resistance - r.lowestLow), 5);
  });

  test("returns EMPTY when resistance touch count is below threshold", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    // Flatten highs to all the same level — they won't cluster near a ceiling
    for (let i = 0; i < highs.length - 1; i++) highs[i] = 110 + i * 0.5; // strictly rising, no flat ceiling
    const r = calcAscendingTriangle(highs, lows, closes, volumes, { min_resistance_touches: 5 });
    expect(r.isAscendingTriangle).toBe(false);
  });

  test("returns EMPTY when higher-low count is below threshold", () => {
    const { highs, lows, closes, volumes } = makeAscendingTriangle();
    // All lows flat — no ascending support
    for (let i = 0; i < lows.length - 1; i++) lows[i] = 100;
    const r = calcAscendingTriangle(highs, lows, closes, volumes, { min_higher_lows: 5 });
    expect(r.isAscendingTriangle).toBe(false);
  });
});

describe("calcSupportResistance", () => {
  // Build a zigzag whose turning points land at known levels, so swing pivots
  // (and thus S/R zones) are predictable. Lows ~100 (support), highs ~110
  // (resistance), current price ~105 between them.
  function zigzag(levels, barsPerLeg) {
    const closes = [];
    for (let k = 0; k < levels.length - 1; k++) {
      const a = levels[k], b = levels[k + 1];
      for (let i = 0; i < barsPerLeg; i++) closes.push(a + (b - a) * (i / barsPerLeg));
    }
    closes.push(levels[levels.length - 1]);
    const highs = closes.map((c) => c + 0.5);
    const lows  = closes.map((c) => c - 0.5);
    return { highs, lows, closes };
  }

  test("returns null on insufficient / missing data", () => {
    expect(calcSupportResistance(null, null, null)).toBeNull();
    expect(calcSupportResistance([1, 2], [1, 2], [1, 2], { pivotWindow: 3 })).toBeNull();
  });

  test("finds support below and resistance above the current price", () => {
    const { highs, lows, closes } = zigzag([105, 100, 110, 100, 110, 100, 110, 105], 6);
    const sr = calcSupportResistance(highs, lows, closes, { pivotWindow: 3, clusterPct: 2, lookback: 300 });
    expect(sr).not.toBeNull();
    expect(sr.supports.length).toBeGreaterThan(0);
    expect(sr.resistances.length).toBeGreaterThan(0);
    // nearest resistance is the ~110 zone (above price ~105), support the ~100 zone
    expect(sr.nearestResistance).toBeGreaterThan(sr.price);
    expect(sr.nearestResistance).toBeLessThanOrEqual(111);
    expect(sr.nearestSupport).toBeLessThan(sr.price);
    expect(sr.nearestSupport).toBeGreaterThanOrEqual(99);
  });

  test("clusters repeated touches into one zone with a touch count", () => {
    const { highs, lows, closes } = zigzag([105, 100, 110, 100, 110, 100, 110, 105], 6);
    const sr = calcSupportResistance(highs, lows, closes, { pivotWindow: 3, clusterPct: 2, lookback: 300 });
    // the 110 resistance is tested 3x → its nearest-resistance zone has >1 touch
    expect(sr.resistances[0].touches).toBeGreaterThanOrEqual(2);
    expect(sr.resistances[0].distPct).toBeGreaterThan(0);
  });
});
