// Tests for the v0.3.0 series-variant exports.

import {
  calcRSISeries,
  calcSMASeries,
  calcEMASeries,
  calcMFISeries,
  calcAroonSeries,
  calcADXSeries,
  calcSupertrendSeries,
  calcIchimokuSeries,
  calcKeltnerSeries,
  calcOBVSeries,
  calcBollingerBandsSeries,
  calcMACDSeries,
  // v0.4.0
  calcCMFSeries,
  calcStochasticSeries,
  calcMassIndexSeries,
  calcHammerSeries,
  calcDonchianSeries,
  calcRSI,
  calcSMA,
  calcOBV,
  calcIchimoku,
  calcCMF,
  calcStochastic,
  calcMassIndex,
  calcHammer,
  calcDonchian,
} from "../src";

const closes = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24,
];
const highs = closes.map(c => c + 0.5);
const lows = closes.map(c => c - 0.5);
const volumes = closes.map(() => 1000);

describe("series variants — basic shape", () => {
  test("calcRSISeries returns array of length closes.length with nulls before warmup", () => {
    const series = calcRSISeries(closes, 14);
    expect(series.length).toBe(closes.length);
    for (let i = 0; i < 14; i++) expect(series[i]).toBeNull();
    expect(series[14]).not.toBeNull();
  });

  test("calcSMASeries computes correct rolling SMA", () => {
    const series = calcSMASeries(closes, 5);
    expect(series.length).toBe(closes.length);
    expect(series[4]).toBe((10 + 11 + 12 + 13 + 14) / 5);
    expect(series[5]).toBe((11 + 12 + 13 + 14 + 15) / 5);
  });

  test("calcEMASeries length matches input", () => {
    const series = calcEMASeries(closes, 10);
    expect(series.length).toBe(closes.length);
    for (let i = 0; i < 9; i++) expect(series[i]).toBeNull();
    expect(series[9]).not.toBeNull();
  });

  test("calcMFISeries shape", () => {
    const series = calcMFISeries(highs, lows, closes, volumes, 14);
    expect(series.length).toBe(closes.length);
    expect(series[14]).not.toBeNull();
  });

  test("calcAroonSeries returns objects with up/down/oscillator", () => {
    const series = calcAroonSeries(highs, lows, 14);
    expect(series.length).toBe(closes.length);
    const last = series[series.length - 1];
    expect(last).toHaveProperty("up");
    expect(last).toHaveProperty("down");
    expect(last).toHaveProperty("oscillator");
  });

  test("calcADXSeries warmup respected", () => {
    const series = calcADXSeries(highs, lows, closes, 14);
    expect(series.length).toBe(closes.length);
    for (let i = 0; i < 28; i++) expect(series[i]).toBeNull();
  });

  test("calcSupertrendSeries returns bullish/bearish flags", () => {
    const series = calcSupertrendSeries(highs, lows, closes, 10, 3);
    expect(series.length).toBe(closes.length);
    const valid = series.filter(s => s !== null);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid[0]).toHaveProperty("bullish");
    expect(valid[0]).toHaveProperty("bearish");
  });

  test("calcIchimokuSeries shape", () => {
    const series = calcIchimokuSeries(highs, lows, closes, {});
    expect(series.length).toBe(closes.length);
  });

  test("calcKeltnerSeries returns middle/upper/lower", () => {
    const series = calcKeltnerSeries(highs, lows, closes, 20, 10, 2);
    expect(series.length).toBe(closes.length);
    const valid = series.filter(s => s !== null);
    expect(valid.length).toBeGreaterThan(0);
  });

  test("calcOBVSeries cumulative correctly", () => {
    const series = calcOBVSeries(closes, volumes);
    expect(series.length).toBe(closes.length);
    expect(series[0]).toBe(0);
    // closes[1]=11 > closes[0]=10 → OBV +volume = +1000
    expect(series[1]).toBe(1000);
    expect(series[2]).toBe(2000);
  });

  test("calcBollingerBandsSeries shape", () => {
    const series = calcBollingerBandsSeries(closes, 20, 2);
    expect(series.length).toBe(closes.length);
    const valid = series.filter(s => s !== null);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid[0]).toHaveProperty("middle");
    expect(valid[0]).toHaveProperty("upper");
    expect(valid[0]).toHaveProperty("lower");
  });

  test("calcMACDSeries shape", () => {
    const longerCloses = Array.from({ length: 100 }, (_, i) => 100 + i + Math.sin(i * 0.2) * 5);
    const series = calcMACDSeries(longerCloses, 12, 26, 9);
    expect(series.length).toBe(longerCloses.length);
    const valid = series.filter(s => s !== null);
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe("series variants — agreement with scalar latest", () => {
  test("calcRSISeries[i] === calcRSI(closes.slice(0, i+1))", () => {
    const series = calcRSISeries(closes, 14);
    for (let i = 14; i < closes.length; i++) {
      expect(series[i]).toBeCloseTo(calcRSI(closes.slice(0, i + 1), 14)!, 6);
    }
  });

  test("calcSMASeries[i] === calcSMA(closes.slice(0, i+1))", () => {
    const series = calcSMASeries(closes, 5);
    for (let i = 4; i < closes.length; i++) {
      expect(series[i]).toBeCloseTo(calcSMA(closes.slice(0, i + 1), 5)!, 6);
    }
  });

  test("calcOBVSeries last value === calcOBV(closes, volumes).value", () => {
    const series = calcOBVSeries(closes, volumes);
    const scalar = calcOBV(closes, volumes) as { value: number };
    expect(series[series.length - 1]).toBeCloseTo(scalar.value, 6);
  });

  // v0.3.1 regression: calcIchimokuSeries was passing `params` as 4th arg
  // to scalar calcIchimoku, which expects positional (tenkanPeriod, ...).
  // Passing {} corrupted tenkanPeriod → idx - {} → NaN → broken output.
  test("calcIchimokuSeries[last] matches calcIchimoku scalar exactly (v0.3.1)", () => {
    const longHighs = Array.from({ length: 100 }, (_, i) => 100 + i + Math.sin(i * 0.3) * 5 + 0.5);
    const longLows = Array.from({ length: 100 }, (_, i) => 100 + i + Math.sin(i * 0.3) * 5 - 0.5);
    const longCloses = Array.from({ length: 100 }, (_, i) => 100 + i + Math.sin(i * 0.3) * 5);
    const series = calcIchimokuSeries(longHighs, longLows, longCloses, {});
    const scalarFromNoParams = calcIchimoku(longHighs, longLows, longCloses);
    const scalarFromDefaults = calcIchimoku(longHighs, longLows, longCloses, 9, 26, 52, 26);
    expect(JSON.stringify(series[series.length - 1])).toBe(JSON.stringify(scalarFromNoParams));
    expect(JSON.stringify(series[series.length - 1])).toBe(JSON.stringify(scalarFromDefaults));
  });

  test("calcIchimokuSeries warmup boundary is senkouB + displacement (78)", () => {
    const longHighs = Array.from({ length: 100 }, (_, i) => 100 + i);
    const longLows = Array.from({ length: 100 }, (_, i) => 100 + i);
    const longCloses = Array.from({ length: 100 }, (_, i) => 100 + i);
    const series = calcIchimokuSeries(longHighs, longLows, longCloses, {});
    expect(series[76]).toBeNull();
    expect(series[77]).not.toBeNull();
  });

  test("calcIchimokuSeries respects custom params (camelCase + snake_case)", () => {
    const longHighs = Array.from({ length: 80 }, (_, i) => 100 + i);
    const longLows = Array.from({ length: 80 }, (_, i) => 100 + i);
    const longCloses = Array.from({ length: 80 }, (_, i) => 100 + i);
    // Shorter senkouB lets the warmup land inside the array.
    const camelSeries = calcIchimokuSeries(longHighs, longLows, longCloses, {
      tenkanPeriod: 7, kijunPeriod: 22, senkouBPeriod: 44, displacement: 22,
    });
    const snakeSeries = calcIchimokuSeries(longHighs, longLows, longCloses, {
      tenkan_period: 7, kijun_period: 22, senkou_b_period: 44, ichimoku_displacement: 22,
    });
    expect(JSON.stringify(camelSeries[79])).toBe(JSON.stringify(snakeSeries[79]));
    expect(camelSeries[79]).not.toBeNull();
  });
});

describe("v0.4.0 series variants", () => {
  test("calcCMFSeries returns null pre-warmup and matches scalar at the last index", () => {
    const series = calcCMFSeries(highs, lows, closes, volumes, 20);
    expect(series.length).toBe(closes.length);
    for (let i = 0; i < 19; i++) expect(series[i]).toBeNull();
    expect(series[19]).not.toBeNull();
    expect(JSON.stringify(series[series.length - 1])).toBe(
      JSON.stringify(calcCMF(highs, lows, closes, volumes, 20)),
    );
  });

  test("calcStochasticSeries returns array indexable by bar position", () => {
    const series = calcStochasticSeries(highs, lows, closes, 14);
    expect(series.length).toBe(closes.length);
    for (let i = 0; i < 13; i++) expect(series[i]).toBeNull();
    expect(series[13]).not.toBeNull();
    expect(series[series.length - 1]).toBe(calcStochastic(highs, lows, closes, 14));
  });

  test("calcMassIndexSeries respects period*2 + sumPeriod warmup", () => {
    const longHighs = Array.from({ length: 80 }, (_, i) => 100 + i + Math.sin(i) * 5);
    const longLows  = longHighs.map(h => h - 1);
    const series = calcMassIndexSeries(longHighs, longLows, 9, 25, 10);
    expect(series.length).toBe(80);
    // period*2 + sumPeriod = 43, so index 42 is the first non-null
    expect(series[41]).toBeNull();
    expect(series[42]).not.toBeNull();
    expect(JSON.stringify(series[series.length - 1])).toBe(
      JSON.stringify(calcMassIndex(longHighs, longLows, 9, 25, 10)),
    );
  });

  test("calcHammerSeries returns one detection result per bar", () => {
    // Construct a clear hammer at index 5: long lower wick, small body at top
    const opens  = [100, 100, 100, 100, 100, 100, 100];
    const highsH = [101, 101, 101, 101, 101, 101, 101];
    const lowsH  = [99,  99,  99,  99,  99,  90,  99];
    const closesH = [100, 100, 100, 100, 100, 100, 100];
    const series = calcHammerSeries(opens, highsH, lowsH, closesH);
    expect(series.length).toBe(7);
    expect(series[5].isHammer).toBe(true);
    expect(series[0].isHammer).toBe(false);
  });

  test("calcDonchianSeries returns null pre-warmup and a full channel object after", () => {
    const series = calcDonchianSeries(highs, lows, closes, 20);
    expect(series.length).toBe(closes.length);
    expect(series[19]).toBeNull();
    expect(series[20]).not.toBeNull();
    expect(typeof series[20].upper).toBe("number");
    expect(typeof series[20].lower).toBe("number");
    expect(JSON.stringify(series[series.length - 1])).toBe(
      JSON.stringify(calcDonchian(highs, lows, closes, 20)),
    );
  });
});
