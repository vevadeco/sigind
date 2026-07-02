import { getCronInterval, loadConfig, validateRequiredEnv } from "./config";
import { findByCronInterval, findDuplicates, insertSignal } from "./db/signals";
import { fetchKlines } from "./market-data";
import { calculateIndicators } from "./indicators";
import {
  detectPatterns,
  dominantDirection,
  patternsForDirection,
} from "./patterns";
import { computeScore, rankScoredSymbols } from "./scoring";
import { calculateTradeLevels } from "./trade-levels";
import {
  isTelegramConfigured,
  logTelegramConfigStatus,
  sendSignalsSequentially,
} from "./telegram";
import type { Kline, ScoredSymbol, SignalRecord } from "./types";

export interface ScannerResult {
  signalsGenerated: number;
  skippedIdempotent: boolean;
}

interface Candidate extends ScoredSymbol {
  klines: Kline[];
}

export async function runScanner(cronInterval = getCronInterval()): Promise<ScannerResult> {
  const missing = validateRequiredEnv();
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  logTelegramConfigStatus();
  const existing = await findByCronInterval(cronInterval);
  if (existing.length > 0) {
    return {
      signalsGenerated: existing.filter((signal) => !signal.suppressed).length,
      skippedIdempotent: true,
    };
  }

  const config = loadConfig();
  if (config.watchlist.length === 0) {
    console.warn("[scanner] Watchlist is empty; no symbols to scan.");
    return { signalsGenerated: 0, skippedIdempotent: false };
  }

  const candidates: Candidate[] = [];

  for (const symbol of config.watchlist) {
    const klines = await fetchKlines(symbol, config);
    if (!klines) continue;

    const patterns = detectPatterns(klines);
    if (patterns.length === 0) continue;

    const direction = dominantDirection(patterns);
    if (!direction) continue;

    const alignedPatterns = patternsForDirection(patterns, direction);
    const indicators = calculateIndicators(klines, config);
    const latestClose = klines[klines.length - 1].close;
    const score = computeScore(
      alignedPatterns,
      indicators,
      direction,
      config,
      latestClose
    );

    candidates.push({
      symbol,
      direction,
      patterns: alignedPatterns,
      indicators,
      score,
      latestPatternTimestamp: Math.max(...alignedPatterns.map((p) => p.timestamp)),
      klines,
    });
  }

  const ranked = rankScoredSymbols(candidates, config);
  const rankedWithKlines = ranked.map((item) => {
    const source = candidates.find((candidate) => candidate.symbol === item.symbol);
    return { ...item, klines: source!.klines };
  });

  const persistedSignals: SignalRecord[] = [];
  const telegramSignals: SignalRecord[] = [];

  for (const candidate of rankedWithKlines) {
    const levels = calculateTradeLevels(
      candidate.klines,
      candidate.direction,
      candidate.patterns,
      candidate.indicators.atr,
      config
    );

    if (!levels) continue;

    const duplicates = await findDuplicates(
      candidate.symbol,
      levels.direction,
      config.dedupeWindowHours
    );
    const suppressed = duplicates.length > 0;

    const signal = await insertSignal({
      symbol: candidate.symbol,
      direction: levels.direction,
      entryPrice: levels.entry,
      takeProfit: levels.takeProfit,
      stopLoss: levels.stopLoss,
      patterns: candidate.patterns.map((pattern) => pattern.name),
      score: candidate.score,
      timestamp: new Date(),
      suppressed,
      cronInterval,
    });

    if (!signal) continue;
    persistedSignals.push(signal);
    if (!suppressed && isTelegramConfigured()) {
      telegramSignals.push(signal);
    }
  }

  await sendSignalsSequentially(telegramSignals);

  return {
    signalsGenerated: persistedSignals.filter((signal) => !signal.suppressed).length,
    skippedIdempotent: false,
  };
}
