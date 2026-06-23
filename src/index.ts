//#region ---------- BOLLINGER BANDS ---------

// Defaults period = 20 and k = 2 match the standard
// Bollinger settings used in most breakout strategies.
function calcBollingerBands(prices: number[], period: number = 20, k: number = 2) {
  if (prices.length < period) return null;

  const slice = prices.slice(-period);
  const n = slice.length;
  const mean = slice.reduce((s, p) => s + p, 0) / n;
  const variance = slice.reduce((s, p) => s + (p - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const middle = mean;
  const upper = mean + k * std;
  const lower = mean - k * std;

  return { middle, upper, lower, std };
}

//#endregion
//#region ---------- VOLATILITY INDEXED PRICE ----------
// VI = SMA(price) - k * std(price)

function calcVolIndex(prices: number[], k: number = 1) {
  if (prices.length === 0) return null;
  const n = prices.length;
  const mean = prices.reduce((sum, p) => sum + p, 0) / n;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const vIndex = mean - k * std;
  return { mean, std, vIndex };
}

//#endregion
//#region ---------- TREND SMA ----------

function calcSMA(prices: number[], period: number) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((s, p) => s + p, 0) / slice.length;
}

//#endregion
//#region ---------- RSI -----------

// Wilder-style RSI, returns null until enough data
function calcRSI(prices: number[], period: number = 14) {
  if (!prices || prices.length < period + 1) return null;

  // compute gains/losses for last `period` closes
  let gain = 0;
  let loss = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gain += change;
    else loss -= change; // change is negative, subtract to make positive
  }

  const avgGain = gain / period;
  const avgLoss = loss / period;

  if (avgLoss === 0) {
    // no losses → RSI = 100
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return rsi;
}

//#endregion
//#region ---------- ATR -----------

// Average True Range over `period` candles
function calcATR(highs: number[], lows: number[], closes: number[], period: number = 14) {
  if (!highs || !lows || !closes) return null;
  if (highs.length < period + 1 ||
      lows.length < period + 1 ||
      closes.length < period + 1) {
    return null;
  }

  let trSum = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(
      h - l,
      Math.abs(h - prevClose),
      Math.abs(l - prevClose)
    );
    trSum += tr;
  }

  return trSum / period;
}

// calcATRExpansion — extends calcATR with two derived fields:
//   pct:       ATR as a percentage of current price  (atr / price * 100)
//   expansion: today's price move relative to ATR    ((close - priorClose) / atr)
//              > 1.0 means today moved more than one full ATR — genuine breakout
//              < 0   means price fell (negative expansion)
//
// Used by the spec builder to expose atr.expansion for ATR-breakout entry rules.
function calcATRExpansion(highs: number[], lows: number[], closes: number[], period: number = 14) {
  const atr = calcATR(highs, lows, closes, period);
  if (atr === null) return null;

  const price     = closes[closes.length - 1];
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;

  const pct       = price > 0 ? (atr / price) * 100 : null;
  const expansion = (prevClose !== null && atr > 0)
    ? (price - prevClose) / atr
    : null;

  return { atr, pct, expansion };
}


//#endregion
function _emaSeries(prices: number[], period: number) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  out.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function calcEMA(prices: number[], period: number) {
  if (!prices || prices.length < period) return null;
  const series = _emaSeries(prices, period);
  return series[series.length - 1];
}

function calcMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  if (!prices || prices.length < slow + signal) return null;

  const fastSeries = _emaSeries(prices, fast);
  const slowSeries = _emaSeries(prices, slow);

  const offset = slow - fast;
  const macdSeries = slowSeries.map((s, i) => fastSeries[i + offset] - s);

  if (macdSeries.length < signal) return null;

  const sigK = 2 / (signal + 1);
  let sigEMA = macdSeries.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < macdSeries.length; i++) {
    sigEMA = macdSeries[i] * sigK + sigEMA * (1 - sigK);
  }

  const macdVal = macdSeries[macdSeries.length - 1];
  return { macd: macdVal, signal: sigEMA, histogram: macdVal - sigEMA };
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period: number = 14) {
  if (!highs || highs.length < period) return null;
  const h = highs.slice(-period);
  const l = lows.slice(-period);
  const highestHigh = Math.max(...h);
  const lowestLow = Math.min(...l);
  if (highestHigh === lowestLow) return 50;
  return 100 * (closes[closes.length - 1] - lowestLow) / (highestHigh - lowestLow);
}

//# region ---------- Trend Structure -------------
function calcTrendStructure(closes: number[], highs: number[], lows: number[], params: Record<string, any> = {}) {
  const {
    swing_lookback = 20,
    min_swing_distance_pct = 0.5,
    trend_ma_period = 50,
  } = params;

  const n = closes.length;
  if (n < Math.max(swing_lookback * 2, trend_ma_period)) {
    return null;
  }

  // 1) Compute trend MA
  const ma = calcSMA(closes, trend_ma_period);
  const price = closes[closes.length - 1];
  const priceAboveMa = ma != null ? price > ma : false;

  // 2) Find swing highs/lows over the full series
  const swingHighs = [];
  const swingLows = [];
  const minDist = min_swing_distance_pct / 100; // percent → fraction

  for (let i = swing_lookback; i < n - swing_lookback; i++) {
    const windowHighs = highs.slice(i - swing_lookback, i + swing_lookback + 1);
    const windowLows = lows.slice(i - swing_lookback, i + swing_lookback + 1);
    const hi = highs[i];
    const lo = lows[i];

    const isSwingHigh = hi === Math.max(...windowHighs);
    const isSwingLow = lo === Math.min(...windowLows);

    if (isSwingHigh) {
      swingHighs.push({ index: i, price: hi });
    }
    if (isSwingLow) {
      swingLows.push({ index: i, price: lo });
    }
  }

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return {
      hasUptrend: false,
      lastHigherHigh: false,
      lastHigherLow: false,
      brokeHigherLow: false,
      priceAboveMa,
      lastHigherHighPrice: null,
      lastHigherLowPrice: null,
    };
  }

  // 3) Take last two highs and lows
  const H1 = swingHighs[swingHighs.length - 1];
  const H2 = swingHighs[swingHighs.length - 2];
  const L1 = swingLows[swingLows.length - 1];
  const L2 = swingLows[swingLows.length - 2];

  const lastHigherHigh =
    H1.price > H2.price * (1 + minDist); // require a bit of separation
  const lastHigherLow =
    L1.price > L2.price * (1 + minDist);

  const hasUptrend = lastHigherHigh && lastHigherLow;

  // 4) Structure break: price closes below most recent higher low
  const brokeHigherLow = hasUptrend && price < L1.price;

  return {
    hasUptrend,
    lastHigherHigh,
    lastHigherLow,
    brokeHigherLow,
    priceAboveMa,
    lastHigherHighPrice: H1.price,
    lastHigherLowPrice: L1.price,
  };
}


//# endregion

//#region ---------- FLAG PATTERN ----------
// Detects a bull flag: a strong upward pole followed by tight consolidation,
// with the current bar breaking out above the flag's high on expanding volume.
//
// Options:
//   poleLen    {number} bars to measure the pole              (default 5)
//   flagLen    {number} bars of consolidation before breakout (default 4)
//   minPolePct {number} minimum pole gain % to qualify        (default 0.4)
//
// volumes is optional — when provided, adds volume confirmation:
//   - avg flag volume < avg pole volume (drying up during consolidation)
//   - breakout bar volume > avg flag volume (expansion on breakout)
//
function calcFlagPattern(closes: number[], highs: number[], lows: number[], options: Record<string, any> = {}, volumes: number[] | null = null) {
  const poleLen    = options.poleLen    ?? 5;
  const flagLen    = options.flagLen    ?? 4;
  const minPolePct = options.minPolePct ?? 0.4;

  const n = closes.length;
  if (n < poleLen + flagLen + 1) return null;

  // ── Pole: the poleLen bars immediately before the flag ──────────────────
  const poleStartIdx = n - 1 - flagLen - poleLen;
  const poleEndIdx   = n - 1 - flagLen;

  const poleOpen  = closes[poleStartIdx];
  const poleClose = closes[poleEndIdx];
  const poleGainPct = ((poleClose - poleOpen) / poleOpen) * 100;

  if (poleGainPct < minPolePct) return { patternFlag: false };

  let avgPoleRange = 0;
  let avgPoleVol   = 0;
  for (let i = poleStartIdx; i <= poleEndIdx; i++) {
    avgPoleRange += highs[i] - lows[i];
    if (volumes) avgPoleVol += volumes[i] ?? 0;
  }
  avgPoleRange /= poleLen;
  avgPoleVol   /= poleLen;

  // ── Flag: the flagLen bars before the current bar ────────────────────────
  const flagStartIdx = n - 1 - flagLen;
  const flagEndIdx   = n - 2;

  let flagHigh     = -Infinity;
  let avgFlagRange = 0;
  let avgFlagVol   = 0;
  for (let i = flagStartIdx; i <= flagEndIdx; i++) {
    if (highs[i] > flagHigh) flagHigh = highs[i];
    avgFlagRange += highs[i] - lows[i];
    if (volumes) avgFlagVol += volumes[i] ?? 0;
  }
  avgFlagRange /= flagLen;
  avgFlagVol   /= flagLen;

  // Flag must be tighter than the pole (consolidation, not continuation)
  const isTight = avgFlagRange <= avgPoleRange * 0.75;

  // Flag must not retrace more than 50% of the pole gain
  const retracePct = poleClose > 0
    ? ((poleClose - closes[flagEndIdx]) / poleClose) * 100
    : 0;
  const isHolding = retracePct <= (poleGainPct * 0.5);

  // ── Breakout: current bar closes above the flag's high ───────────────────
  const isBreakout = closes[n - 1] > flagHigh;

  // ── Volume confirmation (when volumes provided) ──────────────────────────
  // Flag volume dries up vs pole; breakout bar expands above flag avg
  let volConfirmed = true;
  if (volumes && avgPoleVol > 0) {
    const flagVolDeclined  = avgFlagVol < avgPoleVol;
    const breakoutVolBurst = (volumes[n - 1] ?? 0) > avgFlagVol;
    volConfirmed = flagVolDeclined && breakoutVolBurst;
  }

  const patternFlag = isTight && isHolding && isBreakout && volConfirmed;

  return { patternFlag, poleGainPct, retracePct };
}
//#region ---------- VWAP ----------
// Approximates VWAP using the simple mean of typical price (H+L+C)/3 over a
// rolling time window (no volume data available in the candle feed).
//
// Returns:
//   vwap               — rolling typical-price mean over vwap_lookback_ms
//   priceAboveVwap     — close > vwap
//   vwapSlopeUp        — current VWAP is higher than VWAP computed 5 bars ago
//   recentPullback     — any close in the last pullback_lookback bars actually
//                        crossed below VWAP (close < vwap). Requires a genuine
//                        pullback through VWAP, not just proximity from above.
//   reclaimed          — close >= vwap * (1 - reclaim_tolerance_pct/100)
function calcVWAP(closes: number[], highs: number[], lows: number[], timestamps: number[], params: Record<string, any> = {}) {
  const {
    vwap_lookback_ms      = 86400000,
    pullback_lookback     = 5,
    pullback_max_pct      = 0.5,
    reclaim_tolerance_pct = 0.1,
  } = params;

  const n = closes.length;
  if (n < 2 || !timestamps || timestamps.length < 2) return null;

  const nowTs = timestamps[timestamps.length - 1];
  const windowStart = nowTs - vwap_lookback_ms;

  // Find start of VWAP window
  let startIdx = 0;
  for (let i = 0; i < n; i++) {
    if (timestamps[i] >= windowStart) { startIdx = i; break; }
  }
  const windowLen = n - startIdx;
  if (windowLen < 2) return null;

  // Compute current VWAP (typical-price mean over window)
  let tpSum = 0;
  for (let i = startIdx; i < n; i++) {
    tpSum += (highs[i] + lows[i] + closes[i]) / 3;
  }
  const vwap = tpSum / windowLen;
  const close = closes[n - 1];

  // Slope: compare current VWAP to VWAP 5 bars ago
  const slopeLookback = 5;
  let vwapSlopeUp = false;
  if (n > slopeLookback + 1 && timestamps.length > slopeLookback + 1) {
    const prevNowIdx   = n - 1 - slopeLookback;
    const prevTs       = timestamps[prevNowIdx];
    const prevWinStart = prevTs - vwap_lookback_ms;
    let prevTpSum = 0, prevCount = 0;
    for (let i = 0; i <= prevNowIdx; i++) {
      if (timestamps[i] >= prevWinStart) {
        prevTpSum += (highs[i] + lows[i] + closes[i]) / 3;
        prevCount++;
      }
    }
    if (prevCount > 0) vwapSlopeUp = vwap > prevTpSum / prevCount;
  }

  // priceAboveVwap
  const priceAboveVwap = close > vwap;

  // recentPullback: any close in the last pullback_lookback bars (excluding current)
  // actually crossed below VWAP. Requires a genuine dip through VWAP, not just
  // proximity from above. pullback_max_pct is no longer used here.
  let recentPullback = false;
  const pbStart = Math.max(0, n - 1 - pullback_lookback);
  for (let i = pbStart; i < n - 1; i++) {
    if (closes[i] < vwap) { recentPullback = true; break; }
  }

  // reclaimed: close is at or above VWAP (with small tolerance for tight stops)
  const reclaimed = close >= vwap * (1 - reclaim_tolerance_pct / 100);

  return { vwap, priceAboveVwap, vwapSlopeUp, recentPullback, reclaimed };
}

//#endregion
//#region ---------- CANDLE PATTERN ----------
// Detects a 2-candle bullish continuation: strong green impulse candle followed
// by a confirming candle that closes above the impulse close and above bb middle.
//
// params:
//   pattern_body_min_pct  — impulse body / range ratio threshold (default 0.5)
//   pattern_range_min_pct — impulse range / avg-prior-range ratio threshold (default 0.8)
//   confirm_lookback      — candles before impulse used to compute avg range (default 3)
//   bbMiddle              — BB middle value; confirming candle must close above it (optional)
function calcCandlePattern(opens: number[], highs: number[], lows: number[], closes: number[], params: Record<string, any> = {}) {
  const {
    pattern_body_min_pct  = 0.5,
    pattern_range_min_pct = 0.8,
    confirm_lookback      = 3,
    bbMiddle              = null,
  } = params;

  const n = closes.length;
  if (n < confirm_lookback + 2) return { patternLong: false };

  // Impulse candle (second to last)
  const iClose = closes[n - 2], iOpen = opens[n - 2];
  const iHigh  = highs[n - 2],  iLow  = lows[n - 2];
  const iRange = iHigh - iLow;
  const iBody  = Math.abs(iClose - iOpen);

  const isGreen      = iClose > iOpen;
  const isStrongBody = iRange > 0 && iBody / iRange >= pattern_body_min_pct;

  // Average range of the N candles immediately before the impulse
  let rangeSum = 0, rangeCount = 0;
  for (let i = n - 2 - confirm_lookback; i < n - 2; i++) {
    if (i >= 0) { rangeSum += highs[i] - lows[i]; rangeCount++; }
  }
  const avgRange    = rangeCount > 0 ? rangeSum / rangeCount : 0;
  const isLargeRange = avgRange > 0 && iRange / avgRange >= pattern_range_min_pct;

  // Confirming candle (last)
  const cClose = closes[n - 1];
  const isAbovePriorClose = cClose > iClose;
  const isAboveMidBand    = bbMiddle == null || cClose > bbMiddle;

  return {
    patternLong: isGreen && isStrongBody && isLargeRange && isAbovePriorClose && isAboveMidBand,
  };
}

//#endregion

//#region ---------- HAMMER PATTERN ----------
// Detects a hammer candlestick: small body in the upper portion of the bar,
// long lower wick (buyers rejected lower prices), little/no upper wick.
//
// Params:
//   wick_ratio     {number} lower wick must be >= N× body length  (default 2.0)
//   upper_wick_max {number} upper wick <= X fraction of total range (default 0.15)
//   body_top_pct   {number} body bottom must be in top X fraction of range (default 0.35)
//
// Returns: { isHammer, lowerWickPct, bodyPct }
//
function calcHammer(opens: number[], highs: number[], lows: number[], closes: number[], params: Record<string, any> = {}) {
  const wickRatio    = params.wick_ratio     ?? 2.0;
  const upperWickMax = params.upper_wick_max ?? 0.15;
  const bodyTopPct   = params.body_top_pct   ?? 0.35;

  const n = closes.length;
  if (n < 1) return { isHammer: false };

  const open  = opens[n - 1];
  const high  = highs[n - 1];
  const low   = lows[n - 1];
  const close = closes[n - 1];

  const range = high - low;
  if (range === 0) return { isHammer: false };

  const bodyTop    = Math.max(open, close);
  const bodyBottom = Math.min(open, close);
  const bodyLen    = bodyTop - bodyBottom;
  const lowerWick  = bodyBottom - low;
  const upperWick  = high - bodyTop;

  // Body bottom must be in the top bodyTopPct of the bar range
  const isBodyHigh = (high - bodyBottom) / range <= bodyTopPct;

  // Lower wick >= N× body (doji body treated as length 1 tick)
  const effectiveBody  = bodyLen > 0 ? bodyLen : range * 0.01;
  const lowerWickLong  = lowerWick >= wickRatio * effectiveBody;

  // Upper wick small relative to total range
  const upperWickSmall = upperWick / range <= upperWickMax;

  return {
    isHammer:     isBodyHigh && lowerWickLong && upperWickSmall,
    lowerWickPct: (lowerWick / range) * 100,
    bodyPct:      (bodyLen   / range) * 100,
  };
}
//#endregion

//#region ---------- BULLISH ENGULFING PATTERN ----------
// Nison: a 2-candle bullish reversal where a strong green candle's body fully
// engulfs the prior bearish candle's body, signalling buyer absorption.
//
// Params:
//   min_body_pct    {number} prior candle body must be >= N fraction of its range (default 0.3)
//   min_engulf_ratio {number} current body must be >= N× prior body — filters weak engulfments (default 1.0)
//
// Returns: { isBullishEngulfing, priorClose }
//
function calcEngulfing(opens: number[], highs: number[], lows: number[], closes: number[], params: Record<string, any> = {}) {
  const minBodyPct     = params.min_body_pct      ?? 0.3;
  const minEngulfRatio = params.min_engulf_ratio  ?? 1.0;

  const n = closes.length;
  if (n < 2) return { isBullishEngulfing: false, priorClose: null };

  // Prior bar: must be bearish with a real body
  const pOpen  = opens[n - 2];
  const pClose = closes[n - 2];
  const pRange = highs[n - 2] - lows[n - 2];
  const pBody  = Math.abs(pClose - pOpen);

  const priorIsBearish = pClose < pOpen;
  const priorHasBody   = pRange > 0 && pBody / pRange >= minBodyPct;

  // Current bar: bullish, opens at or below prior close, closes at or above prior open
  const cOpen  = opens[n - 1];
  const cClose = closes[n - 1];
  const cBody  = Math.abs(cClose - cOpen);

  const currentIsBullish  = cClose > cOpen;
  const engulfsBelow      = cOpen  <= pClose;
  const engulfsAbove      = cClose >= pOpen;
  const engulfRatioMet    = pBody  >  0 ? cBody >= minEngulfRatio * pBody : true;

  return {
    isBullishEngulfing: priorIsBearish && priorHasBody && currentIsBullish && engulfsBelow && engulfsAbove && engulfRatioMet,
    priorClose: pClose,
  };
}
//#endregion

//#region ---------- MORNING STAR PATTERN ----------
// Nison: a 3-candle bullish bottom reversal.
//   Bar n-3 (first):  strong bearish candle — sellers in control
//   Bar n-2 (star):   small body below the first close — indecision at the low
//   Bar n-1 (third):  strong bullish candle that closes at least N% into the first bar's body
//
// Params:
//   first_body_min_pct    {number} first bar body / range floor (default 0.5)
//   star_body_max_pct     {number} star bar body / range ceiling (default 0.3)
//   third_body_min_pct    {number} third bar body / range floor (default 0.4)
//   third_penetration_pct {number} third bar close must reach this far into first bar body (default 0.5)
//
// Returns: { isMorningStar }
//
function calcMorningStar(opens: number[], highs: number[], lows: number[], closes: number[], params: Record<string, any> = {}) {
  const firstBodyMinPct     = params.first_body_min_pct     ?? 0.5;
  const starBodyMaxPct      = params.star_body_max_pct      ?? 0.3;
  const thirdBodyMinPct     = params.third_body_min_pct     ?? 0.4;
  const thirdPenetrationPct = params.third_penetration_pct  ?? 0.5;

  const n = closes.length;
  if (n < 3) return { isMorningStar: false };

  // First bar (n-3): strong bearish
  const fOpen  = opens[n - 3];
  const fClose = closes[n - 3];
  const fRange = highs[n - 3] - lows[n - 3];
  const fBody  = Math.abs(fClose - fOpen);
  const firstIsBearish = fClose < fOpen;
  const firstHasBody   = fRange > 0 && fBody / fRange >= firstBodyMinPct;

  // Star bar (n-2): small body, sits below first bar's close
  const sOpen  = opens[n - 2];
  const sClose = closes[n - 2];
  const sRange = highs[n - 2] - lows[n - 2];
  const sBody  = Math.abs(sClose - sOpen);
  const starIsSmall    = sRange > 0 ? sBody / sRange <= starBodyMaxPct : true;
  const starBelowFirst = Math.max(sOpen, sClose) <= fClose;

  // Third bar (n-1): bullish, closes at least N% into first bar's body
  const tOpen  = opens[n - 1];
  const tClose = closes[n - 1];
  const tRange = highs[n - 1] - lows[n - 1];
  const tBody  = Math.abs(tClose - tOpen);
  const thirdIsBullish = tClose > tOpen;
  const thirdHasBody   = tRange > 0 && tBody / tRange >= thirdBodyMinPct;
  const penetrationLevel = fClose + thirdPenetrationPct * fBody; // fClose is bearish bar's bottom
  const thirdPenetrates  = tClose >= penetrationLevel;

  return {
    isMorningStar: firstIsBearish && firstHasBody && starIsSmall && starBelowFirst &&
                   thirdIsBullish && thirdHasBody && thirdPenetrates,
  };
}
//#endregion

//#region ---------- DOUBLE BOTTOM PATTERN ----------
// Bulkowski: two swing lows at roughly equal price levels separated by a peak
// (neckline). Entry fires when the current close breaks above the neckline.
// Documented success rate ~64%, mean gain ~35% on daily charts.
//
// Params:
//   swing_lookback        {number} bars on each side to confirm a swing low (default 5)
//   trough_tolerance_pct  {number} two troughs must be within N% of each other (default 4)
//   min_trough_separation {number} minimum bars between troughs (default 10)
//   max_trough_separation {number} maximum bars between troughs (default 60)
//
// Returns: { isDoubleBottom, neckline }
//
function calcCupAndHandle(closes: number[], highs: number[], lows: number[], params: Record<string, any> = {}) {
  const cupLenMin         = params.cup_len_min             ?? 20;
  const cupLenMax         = params.cup_len_max             ?? 80;
  const handleLen         = params.handle_len              ?? 5;
  const cupDepthMinPct    = params.cup_depth_min_pct       ?? 10;
  const cupDepthMaxPct    = params.cup_depth_max_pct       ?? 40;
  const rimTolerancePct   = params.rim_tolerance_pct       ?? 8;
  const handleRetracePct  = params.handle_retrace_max_pct  ?? 50;

  const n = closes.length;
  if (n < cupLenMin + handleLen + 2) return { isCupAndHandle: false, pivot: null };

  // ── Handle: the handleLen bars before the current (incomplete) bar ─────────
  const handleEnd   = n - 2;              // last complete bar
  const handleStart = handleEnd - handleLen + 1;
  if (handleStart < 1) return { isCupAndHandle: false, pivot: null };

  let pivot     = -Infinity;  // handle's high = breakout pivot
  let handleLow =  Infinity;
  for (let i = handleStart; i <= handleEnd; i++) {
    if (highs[i] > pivot)     pivot     = highs[i];
    if (lows[i]  < handleLow) handleLow = lows[i];
  }

  // ── Right rim: highest high in the 5 bars ending just before the handle ───
  const rightRimEnd   = handleStart - 1;
  const rightRimStart = Math.max(0, rightRimEnd - 4);
  let rightRimHigh = -Infinity;
  for (let i = rightRimStart; i <= rightRimEnd; i++) {
    if (highs[i] > rightRimHigh) rightRimHigh = highs[i];
  }

  // ── Left rim: highest high in the cup search window ────────────────────────
  const leftSearchEnd   = rightRimEnd - cupLenMin;
  const leftSearchStart = Math.max(0, rightRimEnd - cupLenMax);
  if (leftSearchEnd < leftSearchStart) return { isCupAndHandle: false, pivot: null };

  let leftRimIdx  = leftSearchStart;
  let leftRimHigh = -Infinity;
  for (let i = leftSearchStart; i <= leftSearchEnd; i++) {
    if (highs[i] > leftRimHigh) {
      leftRimHigh = highs[i];
      leftRimIdx  = i;
    }
  }

  // ── Rim symmetry: right rim must be within rimTolerancePct of left rim ─────
  const rimDiffPct = Math.abs(rightRimHigh - leftRimHigh) / leftRimHigh * 100;
  if (rimDiffPct > rimTolerancePct) return { isCupAndHandle: false, pivot: null };

  // ── Cup bottom: lowest low between the two rims ────────────────────────────
  let cupBottom = Infinity;
  for (let i = leftRimIdx; i <= rightRimEnd; i++) {
    if (lows[i] < cupBottom) cupBottom = lows[i];
  }

  // ── Cup depth bounds ───────────────────────────────────────────────────────
  const cupDepthPct = (leftRimHigh - cupBottom) / leftRimHigh * 100;
  if (cupDepthPct < cupDepthMinPct || cupDepthPct > cupDepthMaxPct) return { isCupAndHandle: false, pivot: null };

  // ── Handle retracement: must not exceed handleRetracePct of cup depth ──────
  const cupDepthPrice    = leftRimHigh - cupBottom;
  const handleRetrace    = (rightRimHigh - handleLow) / cupDepthPrice * 100;
  if (handleRetrace > handleRetracePct) return { isCupAndHandle: false, pivot: null };

  // Handle must not re-enter the cup base
  if (handleLow <= cupBottom) return { isCupAndHandle: false, pivot: null };

  // ── Breakout: current close above the handle's high (pivot) ───────────────
  const isCupAndHandle = closes[n - 1] > pivot;

  return { isCupAndHandle, pivot };
}

function calcDoubleBottom(closes: number[], highs: number[], lows: number[], params: Record<string, any> = {}) {
  const swingLookback      = params.swing_lookback         ?? 5;
  const troughTolerancePct = params.trough_tolerance_pct   ?? 4;
  const minTroughSep       = params.min_trough_separation  ?? 10;
  const maxTroughSep       = params.max_trough_separation  ?? 60;

  const n = closes.length;
  if (n < swingLookback * 2 + minTroughSep) return { isDoubleBottom: false, neckline: null };

  // Find all swing lows (exclude the last swingLookback bars — current bar is incomplete)
  const swingLows = [];
  for (let i = swingLookback; i < n - swingLookback; i++) {
    const lo = lows[i];
    let isMin = true;
    for (let j = i - swingLookback; j <= i + swingLookback; j++) {
      if (lows[j] < lo) { isMin = false; break; }
    }
    if (isMin) swingLows.push({ index: i, price: lo });
  }

  if (swingLows.length < 2) return { isDoubleBottom: false, neckline: null };

  // Check the two most recent swing lows
  const L1 = swingLows[swingLows.length - 2];
  const L2 = swingLows[swingLows.length - 1];

  const sep = L2.index - L1.index;
  if (sep < minTroughSep || sep > maxTroughSep) return { isDoubleBottom: false, neckline: null };

  const priceDiffPct = Math.abs(L2.price - L1.price) / L1.price * 100;
  if (priceDiffPct > troughTolerancePct) return { isDoubleBottom: false, neckline: null };

  // Neckline: highest high between the two troughs
  let neckline = -Infinity;
  for (let i = L1.index; i <= L2.index; i++) {
    if (highs[i] > neckline) neckline = highs[i];
  }

  // Breakout: current close above neckline
  const currentClose = closes[n - 1];
  return {
    isDoubleBottom: currentClose > neckline,
    neckline,
  };
}
//#endregion

//#region ---------- MASS INDEX ----------
// Dorsey (1992): detects potential trend reversals by measuring expansion and
// contraction of the high-low range. Classic bulge: MI rises above 27 then
// falls back below 26.5 — range expanding then contracting.
//
// Returns: { value } or null when insufficient data.
function calcMassIndex(highs: number[], lows: number[], period: number = 9, sumPeriod: number = 25, bulgeLookback: number = 10) {
  if (!highs || !lows) return null;
  const minLen = period * 2 + sumPeriod;
  if (highs.length < minLen || lows.length < minLen) return null;

  // Step 1: high-low range series
  const ranges = highs.map((h, i) => h - lows[i]);

  // Step 2: single EMA(period) of range
  const singleEMA = _emaSeries(ranges, period);

  // Step 3: double EMA(period) of singleEMA
  const doubleEMA = _emaSeries(singleEMA, period);

  // Step 4: ratio series (align lengths)
  const offset = singleEMA.length - doubleEMA.length;
  const ratios = doubleEMA.map((d, i) => {
    const s = singleEMA[i + offset];
    return d > 0 ? s / d : 1;
  });

  // Step 5: rolling sum of sumPeriod ratios → full MI series (O(n) sliding window)
  if (ratios.length < sumPeriod) return null;
  const miSeries = [];
  let windowSum = 0;
  for (let i = 0; i < ratios.length; i++) {
    windowSum += ratios[i];
    if (i >= sumPeriod) windowSum -= ratios[i - sumPeriod];
    if (i >= sumPeriod - 1) miSeries.push(windowSum);
  }

  const value = miSeries[miSeries.length - 1];

  // Dorsey bulge: MI rose above 27 within the last bulgeLookback bars (the
  // "expansion" phase) then fell below 26.5 (the "contraction" signal).
  // Requires the two-state sequence — a static MI < 26.5 check is not sufficient.
  const lookback = Math.min(bulgeLookback, miSeries.length - 1);
  const pastWindow = miSeries.slice(-(lookback + 1), -1);
  const hadAbove27 = pastWindow.some(v => v > 27);
  const bulge = hadAbove27 && value < 26.5;

  return { value, bulge };
}
//#endregion

//#region ---------- AROON ----------
// Chande (1995): measures how recently the period-high and period-low occurred.
// Directly answers "how fresh is the trend?" without lagging close-price EMA.
//
// Returns: { up, down, oscillator } (all 0–100; oscillator −100 to +100),
// or null when insufficient data.
function calcAroon(highs: number[], lows: number[], period: number = 25) {
  if (!highs || !lows) return null;
  if (highs.length < period + 1 || lows.length < period + 1) return null;

  const sliceH = highs.slice(-(period + 1));
  const sliceL = lows.slice(-(period + 1));

  // Find index of highest high and lowest low in the window
  let highestIdx = 0;
  let lowestIdx  = 0;
  for (let i = 1; i <= period; i++) {
    if (sliceH[i] > sliceH[highestIdx]) highestIdx = i;
    if (sliceL[i] < sliceL[lowestIdx])  lowestIdx  = i;
  }

  const barsSinceHigh = period - highestIdx;
  const barsSinceLow  = period - lowestIdx;

  const up         = ((period - barsSinceHigh) / period) * 100;
  const down       = ((period - barsSinceLow)  / period) * 100;
  const oscillator = up - down;

  return { up, down, oscillator };
}
//#endregion

//#region ADX (Average Directional Index — Wilder 1978)
/**
 * calcADX — Average Directional Index
 *
 * Measures trend strength (not direction). ADX >= 25 = trending, < 20 = ranging.
 * DI+ / DI- show directional bias.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period  default 14
 * @returns {{ value: number, diPlus: number, diMinus: number } | null}
 */
function calcADX(highs: number[], lows: number[], closes: number[], period: number = 14) {
  if (!highs || !lows || !closes) return null;
  const minLen = period * 2 + 1;
  if (highs.length < minLen || lows.length < minLen || closes.length < minLen) return null;

  // Build TR, DM+, DM- arrays
  const trArr = [];
  const dmPlusArr = [];
  const dmMinusArr = [];

  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low  = lows[i];
    const prevClose = closes[i - 1];
    const prevHigh  = highs[i - 1];
    const prevLow   = lows[i - 1];

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove   = high - prevHigh;
    const downMove = prevLow - low;

    const dmPlus  = (upMove > downMove && upMove > 0) ? upMove : 0;
    const dmMinus = (downMove > upMove && downMove > 0) ? downMove : 0;

    trArr.push(tr);
    dmPlusArr.push(dmPlus);
    dmMinusArr.push(dmMinus);
  }

  // Wilder smooth first `period` bars as seed
  let smoothTR    = trArr.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothPlus  = dmPlusArr.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothMinus = dmMinusArr.slice(0, period).reduce((s, v) => s + v, 0);

  // Continue Wilder smoothing and accumulate DX values
  const dxArr = [];

  for (let i = period; i < trArr.length; i++) {
    smoothTR    = smoothTR    - smoothTR    / period + trArr[i];
    smoothPlus  = smoothPlus  - smoothPlus  / period + dmPlusArr[i];
    smoothMinus = smoothMinus - smoothMinus / period + dmMinusArr[i];

    const diPlus  = smoothTR !== 0 ? (smoothPlus  / smoothTR) * 100 : 0;
    const diMinus = smoothTR !== 0 ? (smoothMinus / smoothTR) * 100 : 0;
    const diSum   = diPlus + diMinus;
    const dx      = diSum !== 0 ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0;
    dxArr.push({ dx, diPlus, diMinus });
  }

  if (dxArr.length < period) return null;

  // Wilder smooth DX into ADX
  let adx = dxArr.slice(0, period).reduce((s, d) => s + d.dx, 0) / period;

  let lastDiPlus  = dxArr[period - 1].diPlus;
  let lastDiMinus = dxArr[period - 1].diMinus;

  for (let i = period; i < dxArr.length; i++) {
    adx = (adx * (period - 1) + dxArr[i].dx) / period;
    lastDiPlus  = dxArr[i].diPlus;
    lastDiMinus = dxArr[i].diMinus;
  }

  return { value: adx, diPlus: lastDiPlus, diMinus: lastDiMinus };
}
//#endregion

//#region Supertrend (ATR-based trend-following band)
/**
 * calcSupertrend — Supertrend indicator
 *
 * ATR-based dynamic support/resistance band that flips on close crossover.
 * bullish=true when price is above the band (uptrend).
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period      ATR period, default 10
 * @param {number}   multiplier  ATR multiplier, default 3.0
 * @returns {{ value: number, bullish: boolean, bearish: boolean, distance: number } | null}
 */
function calcSupertrend(highs: number[], lows: number[], closes: number[], period: number = 10, multiplier: number = 3.0) {
  if (!highs || !lows || !closes) return null;
  if (closes.length < period + 1) return null;

  // Build Wilder ATR series
  const trArr = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    );
    trArr.push(tr);
  }

  // Seed ATR
  let atr = trArr.slice(0, period).reduce((s, v) => s + v, 0) / period;

  // State machine: track upper/lower band and direction
  const hl2_0 = (highs[period] + lows[period]) / 2;
  let upperBand = hl2_0 + multiplier * atr;
  let lowerBand = hl2_0 - multiplier * atr;
  let bullish   = closes[period] > upperBand ? true : closes[period] < lowerBand ? false : true;

  for (let i = period + 1; i < closes.length; i++) {
    atr = (atr * (period - 1) + trArr[i - 1]) / period;

    const hl2 = (highs[i] + lows[i]) / 2;
    const rawUpper = hl2 + multiplier * atr;
    const rawLower = hl2 - multiplier * atr;

    // Band clamping: bands can only move in the direction of the trend
    const newUpper = rawUpper < upperBand || closes[i - 1] > upperBand ? rawUpper : upperBand;
    const newLower = rawLower > lowerBand || closes[i - 1] < lowerBand ? rawLower : lowerBand;

    upperBand = newUpper;
    lowerBand = newLower;

    // Flip direction on crossover
    if (bullish && closes[i] < lowerBand) {
      bullish = false;
    } else if (!bullish && closes[i] > upperBand) {
      bullish = true;
    }
  }

  const lastClose = closes[closes.length - 1];
  const bandValue = bullish ? lowerBand : upperBand;
  const distance  = bullish
    ? ((lastClose - bandValue) / lastClose) * 100
    : ((bandValue - lastClose) / lastClose) * 100;

  return { value: bandValue, bullish, bearish: !bullish, distance };
}
//#endregion

//#region OBV (On Balance Volume — Granville 1963)
/**
 * calcOBV — On Balance Volume
 *
 * Cumulative volume indicator: volume added on up-closes, subtracted on
 * down-closes. When OBV rises alongside price, volume confirms the trend.
 * When price rises but OBV falls, volume is not supporting the move
 * (distribution / divergence).
 *
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {number}   smaPeriod  SMA period for OBV smoothing, default 20
 * @returns {{ value: number, rising: boolean, smaRatio: number } | null}
 *   value    — current raw OBV (cumulative, arbitrary scale)
 *   rising   — true when OBV > SMA(OBV, smaPeriod)  (volume confirming)
 *   smaRatio — OBV / SMA(OBV); > 1 = above average, < 1 = below average
 */
function calcOBV(closes: number[], volumes: number[], smaPeriod: number = 20) {
  if (!closes || !volumes) return null;
  if (closes.length < 2 || volumes.length < 2) return null;
  if (closes.length !== volumes.length) return null;

  // Build OBV series
  const obvArr = [0];
  for (let i = 1; i < closes.length; i++) {
    const prev = obvArr[i - 1];
    if (closes[i] > closes[i - 1]) {
      obvArr.push(prev + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obvArr.push(prev - volumes[i]);
    } else {
      obvArr.push(prev);
    }
  }

  const current = obvArr[obvArr.length - 1];

  if (obvArr.length < smaPeriod) {
    return { value: current, rising: null, smaRatio: null };
  }

  const sma = obvArr.slice(-smaPeriod).reduce((s, v) => s + v, 0) / smaPeriod;
  const rising   = current > sma;
  const smaRatio = sma !== 0 ? current / sma : null;

  return { value: current, rising, smaRatio };
}
//#endregion

//#region Parabolic SAR (Wilder 1978)
/**
 * calcParabolicSAR — Parabolic Stop and Reverse
 *
 * Accelerating trailing stop: AF starts at afStep and increases each time a
 * new extreme point is set, capped at afMax. Flips from bullish to bearish
 * (or vice versa) when price crosses the SAR level.
 *
 * Bullish (uptrend): SAR trails below price, rising as the trend accelerates.
 * Bearish (downtrend): SAR trails above price, falling as the trend accelerates.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   afStep   acceleration factor step, default 0.02
 * @param {number}   afMax    acceleration factor ceiling, default 0.2
 * @returns {{ value: number, bullish: boolean, bearish: boolean } | null}
 */
function calcParabolicSAR(highs: number[], lows: number[], closes: number[], afStep: number = 0.02, afMax: number = 0.2) {
  if (!highs || !lows || !closes) return null;
  if (closes.length < 2) return null;

  // Seed: use first two bars to determine initial direction
  let bullish = closes[1] >= closes[0];
  let sar = bullish ? lows[0] : highs[0];
  let ep  = bullish ? highs[1] : lows[1];
  let af  = afStep;

  let prevLow1  = lows[0];
  let prevLow2  = lows[0];
  let prevHigh1 = highs[0];
  let prevHigh2 = highs[0];

  for (let i = 1; i < closes.length; i++) {
    const high  = highs[i];
    const low   = lows[i];

    // Advance SAR
    sar = sar + af * (ep - sar);

    if (bullish) {
      // SAR must be at or below the two prior lows
      sar = Math.min(sar, prevLow1, prevLow2);
      if (low < sar) {
        // Flip to bearish
        bullish  = false;
        sar      = ep;          // new SAR = prior extreme (the high)
        ep       = low;
        af       = afStep;
      } else {
        if (high > ep) {
          ep = high;
          af = Math.min(af + afStep, afMax);
        }
      }
    } else {
      // SAR must be at or above the two prior highs
      sar = Math.max(sar, prevHigh1, prevHigh2);
      if (high > sar) {
        // Flip to bullish
        bullish  = true;
        sar      = ep;          // new SAR = prior extreme (the low)
        ep       = high;
        af       = afStep;
      } else {
        if (low < ep) {
          ep = low;
          af = Math.min(af + afStep, afMax);
        }
      }
    }

    prevLow2  = prevLow1;
    prevLow1  = low;
    prevHigh2 = prevHigh1;
    prevHigh1 = high;
  }

  return { value: sar, bullish, bearish: !bullish };
}
//#endregion
//#region Williams Alligator (Bill Williams — Trading Chaos, 1995)
/**
 * calcAlligator — Williams Alligator
 *
 * Three Wilder-smoothed moving averages with different periods:
 *   Jaw   (blue)  — SMMA(jawPeriod=13)   — slowest, tracks long-term trend
 *   Teeth (red)   — SMMA(teethPeriod=8)  — medium
 *   Lips  (green) — SMMA(lipsPeriod=5)   — fastest, reacts first
 *
 * When the lines are spread and ordered (lips > teeth > jaw) the alligator
 * is "eating upward" (bullish). When reversed (lips < teeth < jaw) it is
 * "eating downward" (bearish). When intertwined it is "sleeping" (ranging).
 *
 * Note: charting platforms plot each line forward-shifted (jaw+8, teeth+5,
 * lips+3 bars) for visual clarity. The shift is cosmetic — backtest logic
 * uses the unshifted current values.
 *
 * @param {number[]} prices   - closing prices array
 * @param {number}   jawPeriod   - Wilder smoothing period for jaw (default 13)
 * @param {number}   teethPeriod - Wilder smoothing period for teeth (default 8)
 * @param {number}   lipsPeriod  - Wilder smoothing period for lips (default 5)
 * @returns {{ jaw: number, teeth: number, lips: number,
 *             bullish: boolean, bearish: boolean, sleeping: boolean } | null}
 */
function calcAlligator(prices: number[], jawPeriod: number = 13, teethPeriod: number = 8, lipsPeriod: number = 5) {
  if (!prices) return null;
  if (prices.length < jawPeriod + 1) return null;

  // Build Wilder-smoothed (SMMA) value from a SMA seed over `period` bars
  function smma(period: number): number | null {
    if (prices.length < period) return null;
    let val = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
    for (let i = period; i < prices.length; i++) {
      val = (val * (period - 1) + prices[i]) / period;
    }
    return val;
  }

  const jaw   = smma(jawPeriod);
  const teeth = smma(teethPeriod);
  const lips  = smma(lipsPeriod);

  if (jaw == null || teeth == null || lips == null) return null;

  const bullish  = lips > teeth && teeth > jaw;
  const bearish  = lips < teeth && teeth < jaw;
  const sleeping = !bullish && !bearish;

  return { jaw, teeth, lips, bullish, bearish, sleeping };
}
//#endregion

//#region Awesome Oscillator (Bill Williams — Trading Chaos, 1995)
/**
 * calcAwesomeOscillator — Williams Awesome Oscillator
 *
 * Momentum indicator: SMA(5, midpoint) - SMA(34, midpoint) where
 * midpoint = (high + low) / 2. Designed to complement the Alligator —
 * AO above zero = bullish momentum, below zero = bearish momentum.
 *
 * Signals:
 *   positive — AO > 0 (momentum is bullish)
 *   negative — AO < 0 (momentum is bearish)
 *   rising   — current AO > previous AO bar
 *   falling  — current AO < previous AO bar
 *
 * Requires at least slowPeriod bars of high/low data.
 *
 * @param {number[]} highs       - high prices array
 * @param {number[]} lows        - low prices array
 * @param {number}   fastPeriod  - fast SMA period (default 5)
 * @param {number}   slowPeriod  - slow SMA period (default 34)
 * @returns {{ value: number, positive: boolean, negative: boolean,
 *             rising: boolean, falling: boolean } | null}
 */
function calcAwesomeOscillator(highs: number[], lows: number[], fastPeriod: number = 5, slowPeriod: number = 34) {
  if (!highs || !lows) return null;
  if (highs.length < slowPeriod + 1 || lows.length < slowPeriod + 1) return null;

  const midpoints = highs.map((h, i) => (h + lows[i]) / 2);

  function sma(arr: number[], period: number, offset: number = 0): number {
    const slice = arr.slice(arr.length - period - offset, arr.length - offset);
    return slice.reduce((s: number, v: number) => s + v, 0) / period;
  }

  const fastNow  = sma(midpoints, fastPeriod, 0);
  const slowNow  = sma(midpoints, slowPeriod, 0);
  const fastPrev = sma(midpoints, fastPeriod, 1);
  const slowPrev = sma(midpoints, slowPeriod, 1);

  const value     = fastNow - slowNow;
  const prevValue = fastPrev - slowPrev;

  return {
    value,
    positive: value > 0,
    negative: value < 0,
    rising:   value > prevValue,
    falling:  value < prevValue,
  };
}
//#endregion

//#region Rate of Change (ROC — momentum acceleration)
/**
 * calcROC — Rate of Change
 *
 * Measures momentum as the percentage price change over `period` bars:
 *   ROC = (price[now] / price[now - period] - 1) * 100
 *
 * Positive ROC = price higher than n bars ago (bullish momentum).
 * Negative ROC = price lower (bearish / decelerating).
 * Accelerating = ROC is rising (momentum strengthening).
 *
 * @param {number[]} prices  - closing prices array
 * @param {number}   period  - lookback period (default 14)
 * @returns {{ value: number, positive: boolean, negative: boolean,
 *             accelerating: boolean, decelerating: boolean } | null}
 */
function calcROC(prices: number[], period: number = 14) {
  if (!prices || prices.length < period + 2) return null;

  const current  = prices[prices.length - 1];
  const base     = prices[prices.length - 1 - period];
  const prevCur  = prices[prices.length - 2];
  const prevBase = prices[prices.length - 2 - period];

  if (base === 0 || prevBase === 0) return null;

  const value     = (current / base - 1) * 100;
  const prevValue = (prevCur / prevBase - 1) * 100;

  return {
    value,
    positive:     value > 0,
    negative:     value < 0,
    accelerating: value > prevValue,
    decelerating: value < prevValue,
  };
}
//#endregion

//#region Keltner Channels (Chester Keltner 1960, modernized by Linda Raschke)
/**
 * calcKeltner — Keltner Channels
 *
 * Dynamic volatility envelope: EMA(period) ± multiplier × ATR(atrPeriod).
 * Wider than Bollinger Bands during trending markets (ATR expands with
 * true range); tighter during ranges. When BB bands are inside the Keltner
 * channel, the market is in a squeeze (volatility compression before breakout).
 *
 *   upper  = EMA + mult × ATR
 *   middle = EMA
 *   lower  = EMA - mult × ATR
 *
 * Requires max(period, atrPeriod) + 1 bars.
 *
 * @param {number[]} highs      - high prices
 * @param {number[]} lows       - low prices
 * @param {number[]} closes     - close prices
 * @param {number}   period     - EMA period (default 20)
 * @param {number}   multiplier - ATR multiplier (default 1.5)
 * @param {number}   atrPeriod  - ATR period (default 14)
 * @returns {{ upper: number, middle: number, lower: number,
 *             priceAbove: boolean, priceBelow: boolean } | null}
 */
function calcKeltner(highs: number[], lows: number[], closes: number[], period: number = 20, multiplier: number = 1.5, atrPeriod: number = 14) {
  if (!highs || !lows || !closes) return null;
  const minLen = Math.max(period, atrPeriod) + 1;
  if (closes.length < minLen) return null;

  const ema = calcEMA(closes, period);
  const atrData = calcATRExpansion(highs, lows, closes, atrPeriod);
  if (ema == null || !atrData) return null;

  const atr    = atrData.atr;
  const upper  = ema + multiplier * atr;
  const lower  = ema - multiplier * atr;
  const price  = closes[closes.length - 1];

  return {
    upper,
    middle: ema,
    lower,
    priceAbove: price > upper,
    priceBelow: price < lower,
  };
}
//#endregion

//#region MFI — Money Flow Index (volume-weighted RSI)
/**
 * calcMFI — Money Flow Index
 *
 * Volume-weighted oscillator analogous to RSI. Typical price (TP) = (H+L+C)/3.
 * Money flow is positive when TP > prior TP, negative otherwise.
 * MFI = 100 - 100 / (1 + positiveFlow / negativeFlow) over `period` bars.
 *
 * Overbought >= 80, oversold <= 20 (same thresholds as RSI).
 * Requires period + 1 bars of matched highs/lows/closes/volumes.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {number}   period  default 14
 * @returns {{ value: number, overbought: boolean, oversold: boolean } | null}
 */
function calcMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14) {
  if (!highs || !lows || !closes || !volumes) return null;
  if (closes.length < period + 1 || volumes.length < period + 1) return null;

  const start = closes.length - period - 1;
  let posFlow = 0;
  let negFlow = 0;

  for (let i = start + 1; i <= start + period; i++) {
    const tp     = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
    const mf     = tp * volumes[i];
    if (tp > prevTp)      posFlow += mf;
    else if (tp < prevTp) negFlow += mf;
    // tp === prevTp contributes to neither (neutral)
  }

  const value = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
  return {
    value,
    overbought: value >= 80,
    oversold:   value <= 20,
  };
}
//#endregion

//#region CMF — Chaikin Money Flow
/**
 * calcCMF — Chaikin Money Flow
 *
 * Measures the volume-weighted accumulation/distribution pressure over a period.
 * Money Flow Multiplier = (2C - H - L) / (H - L)  [ranges -1 to +1]
 * Money Flow Volume     = MFM × Volume
 * CMF = Sum(MFV, period) / Sum(Volume, period)
 *
 * Positive (> 0) = net buying pressure; negative (< 0) = net selling pressure.
 * Strong signal when |CMF| > 0.1.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {number}   period  default 20
 * @returns {{ value: number, bullish: boolean, bearish: boolean } | null}
 */
function calcCMF(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 20) {
  if (!highs || !lows || !closes || !volumes) return null;
  if (closes.length < period || volumes.length < period) return null;

  const start = closes.length - period;
  let sumMFV = 0;
  let sumVol = 0;

  for (let i = start; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const mfm   = range === 0 ? 0 : (2 * closes[i] - highs[i] - lows[i]) / range;
    sumMFV += mfm * volumes[i];
    sumVol += volumes[i];
  }

  if (sumVol === 0) return null;
  const value = sumMFV / sumVol;
  return {
    value,
    bullish: value > 0,
    bearish: value < 0,
  };
}
//#endregion

//#region Donchian Channels (Richard Donchian — Turtle Trading, 1970s)
/**
 * calcDonchian — Donchian Channels
 *
 * Highest high and lowest low over `period` bars — the foundation of the
 * Turtle Trading system. A close above the upper channel = breakout entry;
 * a close below the lower channel = breakdown / exit signal.
 *
 *   upper  = highest high over period
 *   lower  = lowest low over period
 *   middle = (upper + lower) / 2
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period  default 20
 * @returns {{ upper: number, middle: number, lower: number,
 *             priceAbove: boolean, priceBelow: boolean } | null}
 */
function calcDonchian(highs: number[], lows: number[], closes: number[], period: number = 20) {
  if (!highs || !lows || !closes) return null;
  // Need period prior bars + current bar for breakout detection
  if (closes.length < period + 1) return null;

  // Channel computed from prior `period` bars (exclude current bar) so that
  // today's close can be compared against yesterday's channel for breakout detection.
  const highSlice = highs.slice(-period - 1, -1);
  const lowSlice  = lows.slice(-period - 1, -1);
  const upper  = Math.max(...highSlice);
  const lower  = Math.min(...lowSlice);
  const middle = (upper + lower) / 2;
  const price  = closes[closes.length - 1];

  return {
    upper,
    middle,
    lower,
    priceAbove: price > upper,
    priceBelow: price < lower,
  };
}
//#endregion

//#region HMA — Hull Moving Average (Alan Hull, 2005)
/**
 * calcHMA — Hull Moving Average
 *
 * Low-lag moving average: HMA = WMA(sqrt(period), 2×WMA(period/2) - WMA(period))
 * Significantly reduces lag compared to SMA/EMA while maintaining smoothness.
 *
 * WMA weights: most recent bar = period, prior = period-1, ... oldest = 1.
 *
 * @param {number[]} prices
 * @param {number}   period  default 20
 * @returns {{ value: number, rising: boolean, falling: boolean } | null}
 */
function calcHMA(prices: number[], period: number = 20) {
  if (!prices) return null;
  const sqrtPeriod = Math.round(Math.sqrt(period));
  if (prices.length < period + sqrtPeriod) return null;

  function wma(arr: number[], len: number): number | null {
    if (arr.length < len) return null;
    const slice = arr.slice(-len);
    const denom = (len * (len + 1)) / 2;
    const val = slice.reduce((s: number, p: number, i: number) => s + p * (i + 1), 0) / denom;
    return val;
  }

  // Need two consecutive HMA values to determine direction
  const halfPeriod = Math.round(period / 2);

  function hmaAt(arr: number[]): number | null {
    const wmaFull = wma(arr, period);
    const wmaHalf = wma(arr, halfPeriod);
    if (wmaFull == null || wmaHalf == null) return null;
    // Build the raw HMA series over sqrtPeriod bars
    // We need sqrtPeriod intermediate values
    const raw = [];
    for (let offset = sqrtPeriod - 1; offset >= 0; offset--) {
      const slice = arr.slice(0, arr.length - offset || undefined);
      const f = wma(slice, period);
      const h = wma(slice, halfPeriod);
      if (f == null || h == null) return null;
      raw.push(2 * h - f);
    }
    return wma(raw, sqrtPeriod);
  }

  const value = hmaAt(prices);
  const valuePrev = hmaAt(prices.slice(0, -1));
  if (value == null || valuePrev == null) return null;

  return {
    value,
    rising: value > valuePrev,
    falling: value < valuePrev,
  };
}
//#endregion

//#region 52-Week High/Low
/**
 * calc52WeekHighLow — 52-week high and low proximity
 *
 * Uses up to 252 bars of daily closes (1 trading year) to compute the
 * annual high and low. Returns proximity metrics used for breakout and
 * support/resistance context.
 *
 * @param {number[]} closes
 * @param {number}   nearPct  threshold to flag nearHigh/nearLow (default 5%)
 * @returns {{ high52: number, low52: number, pctFromHigh: number,
 *             pctFromLow: number, nearHigh: boolean, nearLow: boolean } | null}
 */
function calc52WeekHighLow(closes: number[], nearPct: number = 5) {
  if (!closes || closes.length < 2) return null;
  const window = closes.slice(-252);
  const high52 = Math.max(...window);
  const low52  = Math.min(...window);
  const price  = closes[closes.length - 1];

  const pctFromHigh = ((price - high52) / high52) * 100; // negative = below high
  const pctFromLow  = ((price - low52)  / low52)  * 100; // positive = above low

  return {
    high52,
    low52,
    pctFromHigh,
    pctFromLow,
    nearHigh: Math.abs(pctFromHigh) <= nearPct,
    nearLow:  pctFromLow <= nearPct,
  };
}
//#endregion

//#region Pivot Points (classic floor trader pivots)
/**
 * calcPivotPoints — Classic pivot points from prior bar
 *
 * Standard floor-trader formula using the prior bar's high, low, and close:
 *   Pivot = (H + L + C) / 3
 *   R1 = 2×P − L,  R2 = P + (H − L)
 *   S1 = 2×P − H,  S2 = P − (H − L)
 *
 * Used for intraday and daily support/resistance levels. On daily charts,
 * prior bar = yesterday's session.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @returns {{ pivot: number, r1: number, r2: number, s1: number, s2: number,
 *             abovePivot: boolean, belowPivot: boolean } | null}
 */
function calcPivotPoints(highs: number[], lows: number[], closes: number[]) {
  if (!highs || !lows || !closes) return null;
  if (closes.length < 2) return null;

  const prevHigh  = highs[highs.length - 2];
  const prevLow   = lows[lows.length - 2];
  const prevClose = closes[closes.length - 2];
  const price     = closes[closes.length - 1];

  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const r1 = 2 * pivot - prevLow;
  const r2 = pivot + (prevHigh - prevLow);
  const s1 = 2 * pivot - prevHigh;
  const s2 = pivot - (prevHigh - prevLow);

  return {
    pivot,
    r1,
    r2,
    s1,
    s2,
    abovePivot: price > pivot,
    belowPivot: price < pivot,
  };
}
//#endregion

//#region Fibonacci Retracement Levels
/**
 * calcFibonacci — Fibonacci retracement levels
 *
 * Identifies the swing high and swing low over `period` prior bars, then
 * computes the standard Fibonacci retracement levels between them.
 *
 * Levels: 0% (low), 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100% (high)
 *
 * `nearLevel` is true when the current price is within `nearPct`% of any
 * retracement level — useful for detecting pullback entries.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period   lookback for swing high/low (default 50)
 * @param {number}   nearPct  proximity threshold in % (default 2)
 * @returns {{ swingHigh: number, swingLow: number,
 *             level236: number, level382: number, level500: number,
 *             level618: number, level786: number,
 *             nearLevel: boolean } | null}
 */
function calcFibonacci(highs: number[], lows: number[], closes: number[], period: number = 50, nearPct: number = 2) {
  if (!highs || !lows || !closes) return null;
  if (closes.length < period + 1) return null;

  const highSlice = highs.slice(-period - 1, -1);
  const lowSlice  = lows.slice(-period - 1, -1);
  const swingHigh = Math.max(...highSlice);
  const swingLow  = Math.min(...lowSlice);
  const range     = swingHigh - swingLow;
  if (range === 0) return null;

  const price = closes[closes.length - 1];

  const level236 = swingHigh - 0.236 * range;
  const level382 = swingHigh - 0.382 * range;
  const level500 = swingHigh - 0.500 * range;
  const level618 = swingHigh - 0.618 * range;
  const level786 = swingHigh - 0.786 * range;

  const levels = [swingLow, level786, level618, level500, level382, level236, swingHigh];
  const nearLevel = levels.some(l => Math.abs((price - l) / l) * 100 <= nearPct);

  return {
    swingHigh,
    swingLow,
    level236,
    level382,
    level500,
    level618,
    level786,
    nearLevel,
  };
}

//#region calcIchimoku
/**
 * calcIchimoku — Ichimoku Kinko Hyo cloud trend system (Hosoda, 1969)
 *
 * Five-component system providing trend direction, momentum, and S/R in one indicator.
 * In backtesting context Senkou Span A and B are read from current data (no forward projection).
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} tenkanPeriod     — conversion line period (default 9)
 * @param {number} kijunPeriod      — base line period (default 26)
 * @param {number} senkouBPeriod    — Senkou Span B period (default 52)
 * @param {number} displacement     — cloud displacement bars (default 26)
 * @returns {{ tenkan, kijun, senkouA, senkouB, cloudTop, cloudBottom,
 *             aboveCloud, belowCloud, inCloud, cloudBullish,
 *             tkBullish, tkBearish, chikouConfirm } | null}
 */
function calcIchimoku(highs: number[], lows: number[], closes: number[], tenkanPeriod: number = 9, kijunPeriod: number = 26, senkouBPeriod: number = 52, displacement: number = 26) {
  if (!highs || !lows || !closes) return null;
  const minLen = senkouBPeriod + displacement;
  if (closes.length < minLen) return null;

  function midpoint(h: number[], l: number[], period: number, offset: number = 0): number | null {
    const idx = closes.length - 1 - offset;
    if (idx - period + 1 < 0) return null;
    const sliceH = h.slice(idx - period + 1, idx + 1);
    const sliceL = l.slice(idx - period + 1, idx + 1);
    return (Math.max(...sliceH) + Math.min(...sliceL)) / 2;
  }

  const tenkan  = midpoint(highs, lows, tenkanPeriod);
  const kijun   = midpoint(highs, lows, kijunPeriod);
  if (tenkan === null || kijun === null) return null;

  const senkouA = (tenkan + kijun) / 2;
  const senkouB = midpoint(highs, lows, senkouBPeriod, displacement);
  if (senkouB === null) return null;

  const close = closes[closes.length - 1];

  const chikouClose   = closes.length > displacement ? closes[closes.length - 1 - displacement] : null;
  const chikouConfirm = chikouClose !== null && close > chikouClose;

  const cloudTop    = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  const aboveCloud  = close > cloudTop;
  const belowCloud  = close < cloudBottom;
  const inCloud     = !aboveCloud && !belowCloud;
  const cloudBullish = senkouA > senkouB;

  const tkBullish = tenkan > kijun;
  const tkBearish = tenkan < kijun;

  return {
    tenkan,
    kijun,
    senkouA,
    senkouB,
    cloudTop,
    cloudBottom,
    aboveCloud,
    belowCloud,
    inCloud,
    cloudBullish,
    tkBullish,
    tkBearish,
    chikouConfirm,
  };
}
/**
 * calcAscendingTriangle — ascending triangle breakout pattern
 *
 * Bullish continuation pattern:
 *   - Flat horizontal resistance: 2+ highs within resistance_tolerance_pct of the period max
 *   - Ascending support: min_higher_lows consecutive higher swing lows
 *   - Breakout: current close above resistance
 *   - Volume confirmation: current volume > vol_multiplier × avg(volume, vol_avg_period)
 *
 * Returns { isAscendingTriangle, resistance, lowestLow, target, breakoutVolConfirmed }
 */
function calcAscendingTriangle(highs: number[], lows: number[], closes: number[], volumes: number[] | null, params: Record<string, any> = {}) {
  const lookback              = params.lookback                ?? 40;
  const resistanceTolPct      = params.resistance_tolerance_pct ?? 1.5;
  const minResistanceTouches  = params.min_resistance_touches   ?? 2;
  const minHigherLows         = params.min_higher_lows          ?? 2;
  const volMultiplier         = params.vol_multiplier           ?? 1.2;
  const volAvgPeriod          = params.vol_avg_period           ?? 20;

  const n = closes.length;
  const EMPTY = { isAscendingTriangle: false, resistance: null, lowestLow: null, target: null, breakoutVolConfirmed: false };
  if (n < lookback + 2) return EMPTY;

  const current = n - 1;
  const end     = n - 2;   // last completed bar
  const start   = Math.max(0, end - lookback + 1);

  // ── 1. Resistance: max high in window; count touches within tolerance ─────
  let resistance = -Infinity;
  for (let i = start; i <= end; i++) {
    if (highs[i] > resistance) resistance = highs[i];
  }
  let touchCount = 0;
  for (let i = start; i <= end; i++) {
    if ((resistance - highs[i]) / resistance * 100 <= resistanceTolPct) touchCount++;
  }
  if (touchCount < minResistanceTouches) return EMPTY;

  // ── 2. Higher lows: find swing lows, verify ascending sequence ────────────
  const swingLows = [];
  for (let i = start + 1; i < end; i++) {
    if (lows[i] < lows[i - 1] && lows[i] <= lows[i + 1]) {
      swingLows.push(lows[i]);
    }
  }
  let higherLowCount = 0;
  for (let i = 1; i < swingLows.length; i++) {
    if (swingLows[i] > swingLows[i - 1]) higherLowCount++;
  }
  if (higherLowCount < minHigherLows) return EMPTY;

  // ── 3. Lowest low in pattern (for measured-move target) ───────────────────
  let lowestLow = Infinity;
  for (let i = start; i <= end; i++) {
    if (lows[i] < lowestLow) lowestLow = lows[i];
  }

  // ── 4. Volume confirmation on breakout candle ─────────────────────────────
  const volStart = Math.max(0, current - volAvgPeriod);
  let volSum = 0, volCount = 0;
  for (let i = volStart; i < current; i++) {
    if (volumes && volumes[i] != null) { volSum += volumes[i]; volCount++; }
  }
  const volAvg = volCount > 0 ? volSum / volCount : 0;
  const currentVol = (volumes && volumes[current] != null) ? volumes[current] : 0;
  const breakoutVolConfirmed = volAvg > 0 && currentVol > volAvg * volMultiplier;

  // ── 5. Breakout: current close above resistance + volume confirmed ─────────
  const isAscendingTriangle = closes[current] > resistance && breakoutVolConfirmed;

  // ── 6. Measured-move target: resistance + triangle height ─────────────────
  const target = resistance + (resistance - lowestLow);

  return { isAscendingTriangle, resistance, lowestLow, target, breakoutVolConfirmed };
}
//#endregion

//#region ---------- Series variants ----------
//
// v0.3.0: Series variants for backtest scripts.
//
// The existing calc* functions return scalar latest values (designed for live
// agents that call once per bar with trailing data). Backtest scripts need
// per-bar values across the full series. These wrappers walk the input arrays
// and call the scalar function at each bar with a trailing prefix.
//
// Implementation note: this is naive O(n²) — each call materializes a
// slice and re-computes the indicator over the prefix. For the SMA/EMA/RSI
// family this is wasteful; a future v0.4.0 should provide native O(n)
// implementations. For now, correctness over performance.
//
// All Series variants return an array of length closes.length. Indices
// before the indicator's warmup period contain null.

function calcRSISeries(closes: number[], period: number = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    out[i] = calcRSI(closes.slice(0, i + 1), period);
  }
  return out;
}

function calcSMASeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let windowSum = 0;
  for (let i = 0; i < period; i++) windowSum += values[i];
  out[period - 1] = windowSum / period;
  for (let i = period; i < values.length; i++) {
    windowSum += values[i] - values[i - period];
    out[i] = windowSum / period;
  }
  return out;
}

function calcEMASeries(prices: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return out;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function calcMFISeries(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): (any)[] {
  const out: any[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    out[i] = calcMFI(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      volumes.slice(0, i + 1),
      period,
    );
  }
  return out;
}

function calcAroonSeries(highs: number[], lows: number[], period: number = 25): (any)[] {
  const out: any[] = new Array(highs.length).fill(null);
  for (let i = period; i < highs.length; i++) {
    out[i] = calcAroon(highs.slice(0, i + 1), lows.slice(0, i + 1), period);
  }
  return out;
}

function calcADXSeries(highs: number[], lows: number[], closes: number[], period: number = 14): (any)[] {
  const out: any[] = new Array(highs.length).fill(null);
  for (let i = period * 2; i < highs.length; i++) {
    out[i] = calcADX(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1), period);
  }
  return out;
}

function calcSupertrendSeries(highs: number[], lows: number[], closes: number[], period: number = 10, mult: number = 3): (any)[] {
  const out: any[] = new Array(highs.length).fill(null);
  for (let i = period; i < highs.length; i++) {
    out[i] = calcSupertrend(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1), period, mult);
  }
  return out;
}

function calcIchimokuSeries(highs: number[], lows: number[], closes: number[], params: any = {}): (any)[] {
  // v0.3.1: fix two bugs from v0.3.0:
  //   1. params was passed as the 4th positional arg to scalar calcIchimoku,
  //      which expects (highs, lows, closes, tenkanPeriod, kijunPeriod,
  //      senkouBPeriod, displacement). Passing {} corrupted tenkanPeriod
  //      → idx - {} → NaN → silently broken indicator output.
  //   2. warmup started at senkouB (52) but scalar needs senkouB + displacement
  //      (78) for a non-null return.
  // Accepts both camelCase and snake_case key names since the audit scripts
  // use snake_case (matching the strategy spec convention) but the scalar
  // uses camelCase positional args.
  const tenkanPeriod   = params.tenkanPeriod   ?? params.tenkan_period   ?? 9;
  const kijunPeriod    = params.kijunPeriod    ?? params.kijun_period    ?? 26;
  const senkouBPeriod  = params.senkouBPeriod  ?? params.senkou_b_period ?? 52;
  const displacement   = params.displacement   ?? params.ichimoku_displacement ?? 26;

  const out: any[] = new Array(highs.length).fill(null);
  const warmup = senkouBPeriod + displacement;
  for (let i = warmup - 1; i < highs.length; i++) {
    out[i] = calcIchimoku(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      tenkanPeriod,
      kijunPeriod,
      senkouBPeriod,
      displacement,
    );
  }
  return out;
}

function calcKeltnerSeries(highs: number[], lows: number[], closes: number[], emaPeriod: number = 20, atrPeriod: number = 10, mult: number = 2): (any)[] {
  const out: any[] = new Array(highs.length).fill(null);
  const start = Math.max(emaPeriod, atrPeriod);
  for (let i = start; i < highs.length; i++) {
    out[i] = calcKeltner(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1), emaPeriod, atrPeriod, mult);
  }
  return out;
}

function calcOBVSeries(closes: number[], volumes: number[]): (number)[] {
  // OBV is naturally cumulative — compute series in O(n).
  const out: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] - volumes[i];
    else out[i] = out[i - 1];
  }
  return out;
}

function calcBollingerBandsSeries(prices: number[], period: number = 20, mult: number = 2): (any)[] {
  const out: any[] = new Array(prices.length).fill(null);
  for (let i = period; i < prices.length; i++) {
    out[i] = calcBollingerBands(prices.slice(0, i + 1), period, mult);
  }
  return out;
}

function calcMACDSeries(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): (any)[] {
  const out: any[] = new Array(prices.length).fill(null);
  const start = slow + signal;
  for (let i = start; i < prices.length; i++) {
    out[i] = calcMACD(prices.slice(0, i + 1), fast, slow, signal);
  }
  return out;
}

// v0.4.0 — five additional Series variants requested by sigma's walk-forward
// migrations (sigma#41 closeout). All follow the standard scalar-via-slice
// pattern; consumers index by bar position. Earlier indices fill with null
// where the scalar requires more history than the slice provides.

function calcCMFSeries(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 20): (any)[] {
  const out: any[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    out[i] = calcCMF(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      volumes.slice(0, i + 1),
      period,
    );
  }
  return out;
}

function calcStochasticSeries(highs: number[], lows: number[], closes: number[], period: number = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const v = calcStochastic(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      period,
    );
    out[i] = v as number | null;
  }
  return out;
}

function calcMassIndexSeries(highs: number[], lows: number[], period: number = 9, sumPeriod: number = 25, bulgeLookback: number = 10): (any)[] {
  const out: any[] = new Array(highs.length).fill(null);
  // calcMassIndex requires at least period*2 + sumPeriod bars
  const start = period * 2 + sumPeriod;
  for (let i = start - 1; i < highs.length; i++) {
    out[i] = calcMassIndex(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      period,
      sumPeriod,
      bulgeLookback,
    );
  }
  return out;
}

function calcHammerSeries(opens: number[], highs: number[], lows: number[], closes: number[], params: Record<string, any> = {}): (any)[] {
  // Hammer is a single-bar pattern — no historical window beyond the current
  // bar. Loop the full series and run the scalar on a 1-bar slice per index.
  const out: any[] = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    out[i] = calcHammer(
      opens.slice(0, i + 1),
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      params,
    );
  }
  return out;
}

function calcDonchianSeries(highs: number[], lows: number[], closes: number[], period: number = 20): (any)[] {
  const out: any[] = new Array(closes.length).fill(null);
  // calcDonchian needs period + 1 bars (period prior + current)
  for (let i = period; i < closes.length; i++) {
    out[i] = calcDonchian(
      highs.slice(0, i + 1),
      lows.slice(0, i + 1),
      closes.slice(0, i + 1),
      period,
    );
  }
  return out;
}

//#endregion

export {
  calcVolIndex,
  calcBollingerBands,
  calcSMA,
  calcRSI,
  calcATR,
  calcATRExpansion,
  calcEMA,
  calcMACD,
  calcStochastic,
  calcTrendStructure,
  calcCandlePattern,
  calcFlagPattern,
  calcVWAP,
  calcHammer,
  calcEngulfing,
  calcMorningStar,
  calcCupAndHandle,
  calcDoubleBottom,
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
  calcIchimoku,
  calcAscendingTriangle,
  // v0.3.0 series variants for backtest scripts
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
  // v0.4.0 series variants (sigma#41 closeout)
  calcCMFSeries,
  calcStochasticSeries,
  calcMassIndexSeries,
  calcHammerSeries,
  calcDonchianSeries,
};
