import { parseRiskRewardMultiplier } from "./config";
import type {
  DetectedPattern,
  Kline,
  PatternDirection,
  ScannerConfig,
  TradeDirection,
  TradeLevels,
} from "./types";

function swingHigh(klines: Kline[]): number {
  return Math.max(...klines.map((kline) => kline.high));
}

function swingLow(klines: Kline[]): number {
  return Math.min(...klines.map((kline) => kline.low));
}

function isBreakoutSetup(patterns: DetectedPattern[]): boolean {
  return patterns.some((pattern) => pattern.isBreakout);
}

function pullbackEntry(klines: Kline[], direction: PatternDirection): number {
  const window = klines.slice(-20);
  const high = swingHigh(window);
  const low = swingLow(window);
  const midpoint = low + (high - low) * 0.5;
  const latestClose = window[window.length - 1].close;
  return direction === "bullish"
    ? Math.min(midpoint, latestClose)
    : Math.max(midpoint, latestClose);
}

export function mapDirection(direction: PatternDirection): TradeDirection {
  return direction === "bullish" ? "long" : "short";
}

export function calculateTradeLevels(
  klines: Kline[],
  direction: PatternDirection,
  patterns: DetectedPattern[],
  atr: number,
  config: ScannerConfig
): TradeLevels | null {
  const tradeDirection = mapDirection(direction);
  const alignedPatterns = patterns.filter((pattern) => pattern.direction === direction);
  const latestClose = klines[klines.length - 1].close;
  const entry = isBreakoutSetup(alignedPatterns)
    ? latestClose
    : pullbackEntry(klines, direction);

  const window = klines.slice(-20);
  const swingStop =
    tradeDirection === "long" ? swingLow(window) : swingHigh(window);
  const atrStop =
    tradeDirection === "long"
      ? entry - config.atrMultiplier * atr
      : entry + config.atrMultiplier * atr;

  const stopLoss =
    tradeDirection === "long"
      ? Math.min(swingStop, atrStop)
      : Math.max(swingStop, atrStop);

  if (stopLoss === entry) return null;

  const distance = Math.abs(entry - stopLoss);
  const multiplier = parseRiskRewardMultiplier(config.riskRewardRatio);
  const takeProfit =
    tradeDirection === "long"
      ? entry + distance * multiplier
      : entry - distance * multiplier;

  return {
    entry,
    stopLoss,
    takeProfit,
    direction: tradeDirection,
    riskRewardRatio: config.riskRewardRatio,
  };
}
