import { expectedKlineCount, mapIntervalToMexc } from "./config";
import type { Kline, ScannerConfig } from "./types";

const MEXC_BASE = "https://api.mexc.com";
const TIMEOUT_MS = 10_000;

interface MexcKlineResponse {
  success?: boolean;
  data?: {
    time?: number[];
    open?: number[];
    close?: number[];
    high?: number[];
    low?: number[];
    vol?: number[];
  };
}

function parseArrayKlines(data: MexcKlineResponse["data"]): Kline[] | null {
  if (!data?.time?.length) return null;
  const { time, open = [], close = [], high = [], low = [], vol = [] } = data;
  const klines: Kline[] = [];
  for (let i = 0; i < time.length; i += 1) {
    const timestamp = Number(time[i]) * 1000;
    const o = Number(open[i]);
    const h = Number(high[i]);
    const l = Number(low[i]);
    const c = Number(close[i]);
    const v = Number(vol[i]);
    if (
      !Number.isFinite(timestamp) ||
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c) ||
      !Number.isFinite(v)
    ) {
      return null;
    }
    klines.push({ timestamp, open: o, high: h, low: l, close: c, volume: v });
  }
  return klines;
}

async function fetchContractKlines(
  symbol: string,
  interval: string,
  startSec: number,
  endSec: number
): Promise<Kline[] | null> {
  const url = new URL(`${MEXC_BASE}/api/v1/contract/kline/${symbol}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("start", String(startSec));
  url.searchParams.set("end", String(endSec));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as MexcKlineResponse;
    return parseArrayKlines(payload.data);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSpotFallback(
  symbol: string,
  interval: string,
  limit: number
): Promise<Kline[] | null> {
  const spotSymbol = symbol.replace("_", "");
  const intervalMap: Record<string, string> = {
    Min5: "5m",
    Min15: "15m",
    Min30: "30m",
  };
  const spotInterval = intervalMap[interval] ?? "15m";
  const url = new URL(`${MEXC_BASE}/api/v3/klines`);
  url.searchParams.set("symbol", spotSymbol);
  url.searchParams.set("interval", spotInterval);
  url.searchParams.set("limit", String(limit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown[];
    if (!Array.isArray(data)) return null;
    const klines: Kline[] = [];
    for (const row of data) {
      if (!Array.isArray(row) || row.length < 6) return null;
      const timestamp = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        !Number.isFinite(volume)
      ) {
        return null;
      }
      klines.push({ timestamp, open, high, low, close, volume });
    }
    return klines;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchKlines(
  symbol: string,
  config: ScannerConfig
): Promise<Kline[] | null> {
  const expected = expectedKlineCount(config);
  const interval = mapIntervalToMexc(config.candleInterval);
  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - config.rollingWindowHours * 60 * 60;

  let klines =
    (await fetchContractKlines(symbol, interval, startSec, endSec)) ??
    (await fetchSpotFallback(symbol, interval, expected));

  if (!klines || klines.length < expected) {
    console.warn(
      `[market-data] Incomplete data for ${symbol}: got ${klines?.length ?? 0}, expected ${expected}`
    );
    return null;
  }

  klines = klines.sort((a, b) => a.timestamp - b.timestamp).slice(-expected);
  if (klines.length < expected) return null;
  return klines;
}

export { expectedKlineCount };
