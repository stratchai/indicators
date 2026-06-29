#!/usr/bin/env node
/**
 * sr.js — print support/resistance for one or more coins, to eyeball against
 * CoinLore's "Support & Resistance" paragraph.
 *
 *   npm run sr -- AAVE
 *   npm run sr -- AAVE BTC ETH SOL
 *   npm run sr -- AAVE --lookback 150 --window 3 --cluster 1.5
 *
 * Fetches DAILY candles from Coinbase's public API (no key). Requires a build
 * (`npm run build`) so the compiled indicators are present.
 */

let calcSupportResistance, calcPivotPoints;
try {
  ({ calcSupportResistance, calcPivotPoints } = require(".."));
} catch (e) {
  console.error("Build the library first:  npm run build\n  (" + e.message + ")");
  process.exit(1);
}

const args = process.argv.slice(2);
const coins = args.filter((a) => !a.startsWith("-"));
const optNum = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const lookback = optNum("lookback", 150);
const pivotWindow = optNum("window", 3);
const clusterPct = optNum("cluster", 1.5);

if (coins.length === 0) {
  console.log("usage: npm run sr -- AAVE [BTC ETH ...] [--lookback 150 --window 3 --cluster 1.5]");
  process.exit(0);
}

const B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[31m", G = "\x1b[32m", X = "\x1b[0m";
const fmt = (p) =>
  p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p >= 0.01 ? p.toFixed(5) : Number(p).toPrecision(4);

async function candles(product, days = Math.max(220, lookback + 40)) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const url =
    `https://api.coinbase.com/api/v3/brokerage/market/products/${product}/candles` +
    `?start=${start}&end=${end}&granularity=ONE_DAY&limit=${days}`;
  const res = await fetch(url, { headers: { "User-Agent": "@stratchai/indicators sr" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = ((await res.json()).candles || []).sort((a, b) => +a.start - +b.start);
  if (!raw.length) throw new Error("no candles (unknown product?)");
  return { highs: raw.map((c) => +c.high), lows: raw.map((c) => +c.low), closes: raw.map((c) => +c.close) };
}

(async () => {
  for (const c of coins) {
    const product = c.includes("-") ? c.toUpperCase() : c.toUpperCase() + "-USD";
    try {
      const { highs, lows, closes } = await candles(product);
      const px = closes[closes.length - 1];
      const sr = calcSupportResistance(highs, lows, closes, { lookback, pivotWindow, clusterPct });
      const pv = calcPivotPoints(highs, lows, closes);
      console.log(`\n${B}═══ ${product} · price $${fmt(px)} · ${closes.length} daily bars ═══${X}`);
      console.log(`${B}  swing S/R${X} ${D}(calcSupportResistance — where price actually reacted)${X}`);
      for (const r of [...sr.resistances].reverse())
        console.log(`    ${R}res${X}  $${fmt(r.price).padStart(11)}  ${D}${r.touches}x  +${r.distPct}%${X}${r.touches >= 3 ? "  ← strong" : ""}`);
      console.log(`    ${B}px ${X}  $${fmt(px).padStart(11)}`);
      for (const s of sr.supports)
        console.log(`    ${G}sup${X}  $${fmt(s.price).padStart(11)}  ${D}${s.touches}x  -${s.distPct}%${X}${s.touches >= 3 ? "  ← strong" : ""}`);
      console.log(`${B}  classic pivots${X} ${D}(calcPivotPoints — formulaic, near-term)${X}`);
      console.log(`    R2 $${fmt(pv.r2)}  R1 $${fmt(pv.r1)}  PP $${fmt(pv.pivot)}  S1 $${fmt(pv.s1)}  S2 $${fmt(pv.s2)}`);
    } catch (e) {
      console.log(`\n  ${R}${product}: ${e.message}${X}`);
    }
  }
  console.log(`\n  ${D}↳ compare each against CoinLore's "Support & Resistance" paragraph.${X}\n`);
})();
