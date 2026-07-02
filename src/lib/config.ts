import type { CandleInterval, RiskRewardRatio, ScannerConfig } from "./types";

const DEFAULT_CONFIG: ScannerConfig = {
  watchlist: [],
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

function warnFallback(param: string, value: unknown, fallback: unknown) {
  console.warn(
    `[config] Invalid value for ${param}: ${JSON.stringify(value)}. Using default: ${JSON.stringify(fallback)}`
  );
}

function clampNumber(
  value: unknown,
  param: string,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    if (value !== undefined) warnFallback(param, value, fallback);
    return fallback;
  }
  return value;
}

function parseEnum<T extends string>(
  value: unknown,
  param: string,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  if (value !== undefined) warnFallback(param, value, fallback);
  return fallback;
}

function parseWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) warnFallback("watchlist", value, []);
    return [];
  }
  const symbols = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().toUpperCase())
    .slice(0, 50);
  if (value.length > 50) {
    console.warn("[config] Watchlist exceeds 50 symbols; truncating to first 50.");
  }
  return symbols;
}

export function validateRequiredEnv(): string[] {
  const required = [
    "MEXC_API_KEY",
    "MEXC_API_SECRET",
    "CRON_SECRET",
    "ANTHROPIC_API_KEY",
    "APP_USERNAME",
    "APP_PASSWORD",
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (!process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_URL?.trim()) {
    missing.push("DATABASE_URL");
  }
  return missing;
}

export function loadConfig(): ScannerConfig {
  let overrides: Partial<ScannerConfig> = {};
  const rawConfig = process.env.SCANNER_CONFIG?.trim();
  if (rawConfig) {
    try {
      overrides = JSON.parse(rawConfig) as Partial<ScannerConfig>;
    } catch {
      console.warn("[config] SCANNER_CONFIG is not valid JSON; using defaults.");
    }
  }

  return {
    watchlist: parseWatchlist(overrides.watchlist ?? DEFAULT_CONFIG.watchlist),
    candleInterval: parseEnum(
      overrides.candleInterval,
      "candleInterval",
      ["5m", "15m", "30m"] as const,
      DEFAULT_CONFIG.candleInterval
    ),
    rollingWindowHours: clampNumber(
      overrides.rollingWindowHours,
      "rollingWindowHours",
      1,
      48,
      DEFAULT_CONFIG.rollingWindowHours
    ),
    minScoreThreshold: clampNumber(
      overrides.minScoreThreshold,
      "minScoreThreshold",
      0,
      100,
      DEFAULT_CONFIG.minScoreThreshold
    ),
    topNSignals: clampNumber(
      overrides.topNSignals,
      "topNSignals",
      1,
      50,
      DEFAULT_CONFIG.topNSignals
    ),
    atrMultiplier: clampNumber(
      overrides.atrMultiplier,
      "atrMultiplier",
      0.5,
      5,
      DEFAULT_CONFIG.atrMultiplier
    ),
    riskRewardRatio: parseEnum(
      overrides.riskRewardRatio,
      "riskRewardRatio",
      ["1:1.5", "1:2", "1:3"] as const,
      DEFAULT_CONFIG.riskRewardRatio
    ),
    dedupeWindowHours: clampNumber(
      overrides.dedupeWindowHours,
      "dedupeWindowHours",
      1,
      24,
      DEFAULT_CONFIG.dedupeWindowHours
    ),
    emaPeriod: clampNumber(overrides.emaPeriod, "emaPeriod", 2, 200, DEFAULT_CONFIG.emaPeriod),
    rsiPeriod: clampNumber(overrides.rsiPeriod, "rsiPeriod", 2, 100, DEFAULT_CONFIG.rsiPeriod),
    atrPeriod: clampNumber(overrides.atrPeriod, "atrPeriod", 2, 100, DEFAULT_CONFIG.atrPeriod),
    volumeSpikeMultiplier: clampNumber(
      overrides.volumeSpikeMultiplier,
      "volumeSpikeMultiplier",
      1,
      10,
      DEFAULT_CONFIG.volumeSpikeMultiplier
    ),
    rsiOversold: clampNumber(
      overrides.rsiOversold,
      "rsiOversold",
      0,
      100,
      DEFAULT_CONFIG.rsiOversold
    ),
    rsiOverbought: clampNumber(
      overrides.rsiOverbought,
      "rsiOverbought",
      0,
      100,
      DEFAULT_CONFIG.rsiOverbought
    ),
  };
}

export function intervalMinutes(interval: CandleInterval): number {
  return interval === "5m" ? 5 : interval === "15m" ? 15 : 30;
}

export function mapIntervalToMexc(interval: CandleInterval): string {
  return interval === "5m" ? "Min5" : interval === "15m" ? "Min15" : "Min30";
}

export function expectedKlineCount(config: ScannerConfig): number {
  return Math.ceil((config.rollingWindowHours * 60) / intervalMinutes(config.candleInterval));
}

export function parseRiskRewardMultiplier(ratio: RiskRewardRatio): number {
  switch (ratio) {
    case "1:1.5":
      return 1.5;
    case "1:2":
      return 2;
    case "1:3":
      return 3;
  }
}

export function getCronInterval(now = new Date()): string {
  const interval = new Date(now);
  const minutes = Math.floor(interval.getUTCMinutes() / 15) * 15;
  interval.setUTCMinutes(minutes, 0, 0);
  return interval.toISOString();
}
