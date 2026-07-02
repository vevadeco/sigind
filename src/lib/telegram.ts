import type { SignalRecord } from "./types";

const TELEGRAM_TIMEOUT_MS = 30_000;

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

export function formatTelegramMessage(signal: SignalRecord): string {
  const timestamp = signal.timestamp.toISOString();
  const patterns = signal.patterns.join(", ");
  const riskReward = formatRiskReward(signal);
  return [
    `Symbol: ${signal.symbol}`,
    `Direction: ${signal.direction}`,
    `Patterns: ${patterns}`,
    `Entry: ${signal.entryPrice.toFixed(6)}`,
    `Take Profit: ${signal.takeProfit.toFixed(6)}`,
    `Stop Loss: ${signal.stopLoss.toFixed(6)}`,
    `Risk/Reward: ${riskReward}`,
    `Score: ${signal.score.toFixed(1)}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

function formatRiskReward(signal: SignalRecord): string {
  const risk = Math.abs(signal.entryPrice - signal.stopLoss);
  const reward = Math.abs(signal.takeProfit - signal.entryPrice);
  if (risk === 0) return "N/A";
  const ratio = reward / risk;
  return `1:${ratio.toFixed(2)}`;
}

export async function sendSignal(signal: SignalRecord): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(signal),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[telegram] Failed for ${signal.symbol}: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[telegram] Failed for ${signal.symbol}`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSignalsSequentially(signals: SignalRecord[]): Promise<void> {
  for (const signal of signals) {
    await sendSignal(signal);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function logTelegramConfigStatus(): void {
  if (!isTelegramConfigured()) {
    console.error(
      "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing; skipping Telegram delivery."
    );
  }
}
