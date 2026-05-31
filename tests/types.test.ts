// Compile-time test: the type signatures emitted to dist/index.d.ts
// are usable by a TypeScript consumer. ts-jest will fail this file if
// any of the type assertions don't compile.

import {
  calcBollingerBands,
  calcSMA,
  calcRSI,
  calcADX,
  calcMACD,
} from "../src";

describe("type signatures (consumer perspective)", () => {
  test("calcSMA returns number | null", () => {
    const result: number | null = calcSMA([1, 2, 3, 4, 5], 3);
    expect(typeof result === "number" || result === null).toBe(true);
  });

  test("calcBollingerBands fields are typed precisely", () => {
    const result = calcBollingerBands([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 20, 2);
    if (result !== null) {
      // TS should know these are numbers
      const middle: number = result.middle;
      const upper: number = result.upper;
      const lower: number = result.lower;
      const std: number = result.std;
      expect(middle).toBeCloseTo(10.5);
      expect(upper).toBeGreaterThan(lower);
      expect(std).toBeGreaterThan(0);
    }
  });

  test("calcMACD fields are typed precisely", () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = calcMACD(prices);
    if (result !== null) {
      const macd: number = result.macd;
      const signal: number = result.signal;
      const histogram: number = result.histogram;
      expect(typeof macd).toBe("number");
      expect(typeof signal).toBe("number");
      expect(typeof histogram).toBe("number");
    }
  });

  test("calcRSI return type is number | null", () => {
    const result: number | null = calcRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14);
    expect(result === null || typeof result === "number").toBe(true);
  });

  test("calcADX returns object with typed fields when sufficient data", () => {
    const highs = Array.from({ length: 50 }, (_, i) => 105 + i);
    const lows  = Array.from({ length: 50 }, (_, i) => 95 + i);
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = calcADX(highs, lows, closes, 14);
    // TS knows the result might be null
    if (result !== null) {
      // and that these fields exist
      expect(typeof result.value === "number" || result.value === null).toBe(true);
    }
  });
});
