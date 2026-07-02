import type {
  DetectedPattern,
  IndicatorResults,
  PatternDirection,
  ScannerConfig,
  ScoredSymbol,
} from "./types";

export interface ScoringWeights {
  pattern: number;
  emaTrend: number;
  rsiCondition: number;
  volumeSpike: number;
  atrCondition: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  pattern: 30,
  emaTrend: 25,
  rsiCondition: 20,
  volumeSpike: 15,
  atrCondition: 10,
};

export function computeScore(
  patterns: DetectedPattern[],
  indicators: IndicatorResults,
  direction: PatternDirection,
  config: ScannerConfig,
  latestClose: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const alignedPatterns = patterns.filter((pattern) => pattern.direction === direction);
  const patternComponent = Math.min(
    weights.pattern,
    alignedPatterns.reduce((sum, pattern) => sum + pattern.strength * 10, 0)
  );

  const emaAligned =
    direction === "bullish" ? latestClose > indicators.ema : latestClose < indicators.ema;
  const emaComponent = emaAligned ? weights.emaTrend : 0;

  const rsiFavorable =
    direction === "bullish"
      ? indicators.rsi <= config.rsiOversold
      : indicators.rsi >= config.rsiOverbought;
  const rsiComponent = rsiFavorable ? weights.rsiCondition : 0;

  const volumeComponent = indicators.volumeSpike ? weights.volumeSpike : 0;
  const atrNormal =
    indicators.atrPercentile >= 0.25 && indicators.atrPercentile <= 0.75;
  const atrComponent = atrNormal ? weights.atrCondition : 0;

  const total =
    patternComponent + emaComponent + rsiComponent + volumeComponent + atrComponent;
  return Math.max(0, Math.min(100, total));
}

export function rankScoredSymbols(
  scored: ScoredSymbol[],
  config: ScannerConfig
): ScoredSymbol[] {
  return [...scored]
    .filter((item) => item.score >= config.minScoreThreshold)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.latestPatternTimestamp - a.latestPatternTimestamp;
    })
    .slice(0, config.topNSignals);
}
