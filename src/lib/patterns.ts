import type { DetectedPattern, Kline, PatternDirection } from "./types";

function bodySize(candle: Kline): number {
  return Math.abs(candle.close - candle.open);
}

function rangeSize(candle: Kline): number {
  return candle.high - candle.low;
}

function isBullish(candle: Kline): boolean {
  return candle.close >= candle.open;
}

function upperShadow(candle: Kline): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function lowerShadow(candle: Kline): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function pushPattern(
  results: DetectedPattern[],
  name: string,
  direction: PatternDirection,
  strength: number,
  timestamp: number,
  isBreakout: boolean
) {
  results.push({
    name,
    direction,
    strength: Math.max(0, Math.min(1, strength)),
    timestamp,
    isBreakout,
  });
}

function detectSingleCandlePatterns(klines: Kline[], results: DetectedPattern[]) {
  const candle = klines[klines.length - 1];
  const range = rangeSize(candle);
  if (range <= 0) return;

  const body = bodySize(candle);
  const bodyRatio = body / range;

  if (bodyRatio <= 0.1) {
    const prior = klines.slice(-6, -1);
    const direction: PatternDirection =
      prior.length > 0 && prior[prior.length - 1].close < prior[0].close
        ? "bullish"
        : "bearish";
    pushPattern(results, "doji", direction, 0.5, candle.timestamp, false);
  }

  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);

  if (bodyRatio <= 0.35 && lower >= body * 2 && upper <= body) {
    pushPattern(results, "hammer", "bullish", 0.75, candle.timestamp, false);
  }

  if (bodyRatio <= 0.35 && upper >= body * 2 && lower <= body) {
    if (isBullish(candle)) {
      pushPattern(results, "inverted hammer", "bullish", 0.65, candle.timestamp, false);
    } else {
      pushPattern(results, "shooting star", "bearish", 0.75, candle.timestamp, false);
    }
  }
}

function detectTwoCandlePatterns(klines: Kline[], results: DetectedPattern[]) {
  const first = klines[klines.length - 2];
  const second = klines[klines.length - 1];
  const firstBodyTop = Math.max(first.open, first.close);
  const firstBodyBottom = Math.min(first.open, first.close);
  const secondBodyTop = Math.max(second.open, second.close);
  const secondBodyBottom = Math.min(second.open, second.close);

  const engulfs =
    secondBodyTop >= firstBodyTop && secondBodyBottom <= firstBodyBottom;

  if (engulfs && !isBullish(first) && isBullish(second)) {
    pushPattern(results, "bullish engulfing", "bullish", 0.85, second.timestamp, true);
  }
  if (engulfs && isBullish(first) && !isBullish(second)) {
    pushPattern(results, "bearish engulfing", "bearish", 0.85, second.timestamp, true);
  }

  const midpoint = (first.open + first.close) / 2;
  if (
    !isBullish(first) &&
    isBullish(second) &&
    second.open < first.close &&
    second.close > midpoint &&
    second.close < first.open
  ) {
    pushPattern(results, "piercing line", "bullish", 0.7, second.timestamp, true);
  }

  if (
    isBullish(first) &&
    !isBullish(second) &&
    second.open > first.close &&
    second.close < midpoint &&
    second.close > first.open
  ) {
    pushPattern(results, "dark cloud cover", "bearish", 0.7, second.timestamp, true);
  }
}

function detectThreeCandlePatterns(klines: Kline[], results: DetectedPattern[]) {
  const [first, second, third] = klines.slice(-3);
  const firstBear = !isBullish(first);
  const firstBull = isBullish(first);
  const thirdBull = isBullish(third);
  const thirdBear = !isBullish(third);
  const secondSmall = bodySize(second) <= rangeSize(first) * 0.35;

  if (firstBear && secondSmall && thirdBull && third.close > (first.open + first.close) / 2) {
    pushPattern(results, "morning star", "bullish", 0.8, third.timestamp, true);
  }

  if (firstBull && secondSmall && thirdBear && third.close < (first.open + first.close) / 2) {
    pushPattern(results, "evening star", "bearish", 0.8, third.timestamp, true);
  }

  const lastThree = klines.slice(-3);
  const allBull = lastThree.every(isBullish);
  const allBear = lastThree.every((c) => !isBullish(c));
  const rising =
    allBull &&
    lastThree[1].close > lastThree[0].close &&
    lastThree[2].close > lastThree[1].close;
  const falling =
    allBear &&
    lastThree[1].close < lastThree[0].close &&
    lastThree[2].close < lastThree[1].close;

  if (rising) {
    pushPattern(results, "three white soldiers", "bullish", 0.9, third.timestamp, true);
  }
  if (falling) {
    pushPattern(results, "three black crows", "bearish", 0.9, third.timestamp, true);
  }
}

export function detectPatterns(klines: Kline[]): DetectedPattern[] {
  if (klines.length === 0) return [];
  const results: DetectedPattern[] = [];

  if (klines.length >= 1) detectSingleCandlePatterns(klines, results);
  if (klines.length >= 2) detectTwoCandlePatterns(klines, results);
  if (klines.length >= 3) detectThreeCandlePatterns(klines, results);

  return results;
}

export function dominantDirection(patterns: DetectedPattern[]): PatternDirection | null {
  if (patterns.length === 0) return null;
  const bullish = patterns.filter((p) => p.direction === "bullish");
  const bearish = patterns.filter((p) => p.direction === "bearish");
  if (bullish.length === bearish.length) {
    return patterns[patterns.length - 1].direction;
  }
  return bullish.length > bearish.length ? "bullish" : "bearish";
}

export function patternsForDirection(
  patterns: DetectedPattern[],
  direction: PatternDirection
): DetectedPattern[] {
  return patterns.filter((p) => p.direction === direction);
}
