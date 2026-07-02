import { describe, expect, it } from "vitest";
import { expectedKlineCount, loadConfig, parseRiskRewardMultiplier } from "@/lib/config";
import { calculateATR, calculateEMA, calculateRSI } from "@/lib/indicators";
import { detectPatterns } from "@/lib/patterns";
import { computeScore, rankScoredSymbols } from "@/lib/scoring";
import { calculateTradeLevels, mapDirection } from "@/lib/trade-levels";
import type { DetectedPattern, IndicatorResults, Kline, ScannerConfig } from "@/lib/types";

const baseConfig: ScannerConfig = {
  watchlist: ["BTC_USDT"],
  candleInterval: "15m",
  rollingWindowHours: 3,
  minScoreThreshold: 50,
  topNSignals: 5,
  atrMultiplier: 1.5,
  riskRewardRatio: "1:2",
  dedupeWindowHours: 4,
  emaPeriod: 20,
  rsiPeriod: 14,
  atrPeriod: 14,
  volumeSpikeMultiplier: 1.5,
  rsiOversold: 40,
  rsiOverbought: 60,
};

function makeKline(
  index: number,
  open: number,
  close: number,
  high?: number,
  low?: number,
  volume = 100
): Kline {
  return {
    timestamp: index * 60_000,
    open,
    close,
    high: high ?? Math.max(open, close) + 1,
    low: low ?? Math.min(open, close) - 1,
    volume,
  };
}

describe("config", () => {
  it("falls back to defaults for invalid scanner config values", () => {
    process.env.SCANNER_CONFIG = JSON.stringify({
      minScoreThreshold: 500,
      candleInterval: "99m",
      riskRewardRatio: "1:9",
    });
    const config = loadConfig();
    expect(config.minScoreThreshold).toBe(50);
    expect(config.candleInterval).toBe("15m");
    expect(config.riskRewardRatio).toBe("1:2");
  });

  it("calculates expected kline count", () => {
    expect(expectedKlineCount(baseConfig)).toBe(12);
  });

  it("parses risk reward multipliers", () => {
    expect(parseRiskRewardMultiplier("1:1.5")).toBe(1.5);
    expect(parseRiskRewardMultiplier("1:3")).toBe(3);
  });
});

describe("indicators", () => {
  it("computes EMA using recursive formula", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7];
    expect(calculateEMA(closes, 3)).toBeCloseTo(6, 5);
  });

  it("computes RSI in valid range", () => {
    const closes = Array.from({ length: 20 }, (_, index) => 100 + index);
    const rsi = calculateRSI(closes, 14);
    expect(rsi).toBeGreaterThan(50);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("computes ATR from klines", () => {
    const klines = [
      makeKline(0, 10, 11),
      makeKline(1, 11, 12),
      makeKline(2, 12, 11.5),
    ];
    expect(calculateATR(klines, 2)).toBeGreaterThan(0);
  });
});

describe("patterns", () => {
  it("detects doji deterministically", () => {
    const klines = [
      makeKline(0, 10, 9.5, 10.5, 9),
      makeKline(1, 10, 10.01, 10.6, 9.4),
    ];
    const first = detectPatterns(klines.slice(0, 1));
    const second = detectPatterns(klines);
    expect(first).toEqual(second.slice(0, first.length));
    expect(second.some((pattern) => pattern.name === "doji")).toBe(true);
  });
});

describe("scoring", () => {
  it("bounds score between 0 and 100", () => {
    const patterns: DetectedPattern[] = [
      {
        name: "bullish engulfing",
        direction: "bullish",
        strength: 1,
        timestamp: 1,
        isBreakout: true,
      },
    ];
    const indicators: IndicatorResults = {
      ema: 90,
      rsi: 30,
      atr: 2,
      volumeSpike: true,
      atrPercentile: 0.5,
    };
    const score = computeScore(patterns, indicators, "bullish", baseConfig, 100);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("ranks by score and tie-breaks by latest pattern timestamp", () => {
    const ranked = rankScoredSymbols(
      [
        {
          symbol: "A",
          direction: "bullish",
          patterns: [],
          indicators: {} as IndicatorResults,
          score: 80,
          latestPatternTimestamp: 100,
        },
        {
          symbol: "B",
          direction: "bullish",
          patterns: [],
          indicators: {} as IndicatorResults,
          score: 80,
          latestPatternTimestamp: 200,
        },
      ],
      baseConfig
    );
    expect(ranked[0].symbol).toBe("B");
  });
});

describe("trade levels", () => {
  it("maps bullish to long and bearish to short", () => {
    expect(mapDirection("bullish")).toBe("long");
    expect(mapDirection("bearish")).toBe("short");
  });

  it("discards zero-distance stop-loss signals", () => {
    const klines = Array.from({ length: 20 }, (_, index) => makeKline(index, 100, 100, 100, 100));
    const levels = calculateTradeLevels(
      klines,
      "bullish",
      [
        {
          name: "hammer",
          direction: "bullish",
          strength: 0.8,
          timestamp: 1,
          isBreakout: false,
        },
      ],
      0,
      baseConfig
    );
    expect(levels).toBeNull();
  });
});
