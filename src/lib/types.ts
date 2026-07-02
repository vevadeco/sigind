export type PatternDirection = "bullish" | "bearish";
export type TradeDirection = "long" | "short";
export type CandleInterval = "5m" | "15m" | "30m";
export type RiskRewardRatio = "1:1.5" | "1:2" | "1:3";

export interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectedPattern {
  name: string;
  direction: PatternDirection;
  strength: number;
  timestamp: number;
  isBreakout: boolean;
}

export interface IndicatorResults {
  ema: number;
  rsi: number;
  atr: number;
  volumeSpike: boolean;
  atrPercentile: number;
}

export interface ScannerConfig {
  watchlist: string[];
  candleInterval: CandleInterval;
  rollingWindowHours: number;
  minScoreThreshold: number;
  topNSignals: number;
  atrMultiplier: number;
  riskRewardRatio: RiskRewardRatio;
  dedupeWindowHours: number;
  emaPeriod: number;
  rsiPeriod: number;
  atrPeriod: number;
  volumeSpikeMultiplier: number;
  rsiOversold: number;
  rsiOverbought: number;
}

export interface ScoredSymbol {
  symbol: string;
  direction: PatternDirection;
  patterns: DetectedPattern[];
  indicators: IndicatorResults;
  score: number;
  latestPatternTimestamp: number;
}

export interface TradeLevels {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  direction: TradeDirection;
  riskRewardRatio: string;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  patterns: string[];
  score: number;
  timestamp: Date;
  suppressed: boolean;
  cronInterval: string;
  createdAt: Date;
}

export interface DashboardFilters {
  symbolFilter?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AnalysisResponse {
  patterns: string;
  trendAssessment: string;
  tradeEvaluation: string;
  summary: string;
}
