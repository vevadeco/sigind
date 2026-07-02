import type { IndicatorResults, Kline, ScannerConfig } from "./types";

export function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) {
    return closes.reduce((sum, value) => sum + value, 0) / closes.length;
  }
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < closes.length; i += 1) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateRSI(closes: number[], period: number): number {
  if (closes.length <= period) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function trueRange(current: Kline, previousClose: number): number {
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose)
  );
}

export function calculateATR(klines: Kline[], period: number): number {
  if (klines.length === 0) return 0;
  if (klines.length === 1) return klines[0].high - klines[0].low;

  const ranges: number[] = [];
  for (let i = 1; i < klines.length; i += 1) {
    ranges.push(trueRange(klines[i], klines[i - 1].close));
  }
  if (ranges.length < period) {
    return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
  }

  let atr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < ranges.length; i += 1) {
    atr = (atr * (period - 1) + ranges[i]) / period;
  }
  return atr;
}

function calculateAtrSeries(klines: Kline[], period: number): number[] {
  const values: number[] = [];
  for (let i = period; i <= klines.length; i += 1) {
    values.push(calculateATR(klines.slice(0, i), period));
  }
  return values;
}

function percentileRank(values: number[], current: number): number {
  if (values.length === 0) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex((value) => value >= current);
  if (index === -1) return 1;
  return index / sorted.length;
}

export function calculateIndicators(
  klines: Kline[],
  config: ScannerConfig
): IndicatorResults {
  const closes = klines.map((kline) => kline.close);
  const ema = calculateEMA(closes, config.emaPeriod);
  const rsi = calculateRSI(closes, config.rsiPeriod);
  const atr = calculateATR(klines, config.atrPeriod);
  const avgVolume =
    klines.reduce((sum, kline) => sum + kline.volume, 0) / Math.max(klines.length, 1);
  const latestVolume = klines[klines.length - 1]?.volume ?? 0;
  const volumeSpike = latestVolume >= avgVolume * config.volumeSpikeMultiplier;
  const atrSeries = calculateAtrSeries(klines, config.atrPeriod);
  const atrPercentile = percentileRank(atrSeries, atr);

  return {
    ema,
    rsi,
    atr,
    volumeSpike,
    atrPercentile,
  };
}
