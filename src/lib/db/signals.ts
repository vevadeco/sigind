import { and, desc, eq, gte, ilike, sql } from "drizzle-orm";
import type { DashboardFilters, PaginatedResult, SignalRecord } from "../types";
import { getDb } from "./index";
import { signals } from "./schema";

function mapSignal(row: typeof signals.$inferSelect): SignalRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction as SignalRecord["direction"],
    entryPrice: row.entryPrice,
    takeProfit: row.takeProfit,
    stopLoss: row.stopLoss,
    patterns: row.patterns,
    score: row.score,
    timestamp: row.timestamp,
    suppressed: row.suppressed,
    cronInterval: row.cronInterval,
    createdAt: row.createdAt,
  };
}

export async function findDuplicates(
  symbol: string,
  direction: string,
  windowHours: number
): Promise<SignalRecord[]> {
  try {
    const db = getDb();
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.symbol, symbol),
          eq(signals.direction, direction as "long" | "short"),
          eq(signals.suppressed, false),
          gte(signals.timestamp, since)
        )
      );
    return rows.map(mapSignal);
  } catch (error) {
    console.warn("[signals] Dedup query failed; treating as no duplicate.", error);
    return [];
  }
}

export async function findByCronInterval(interval: string): Promise<SignalRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(signals)
    .where(eq(signals.cronInterval, interval));
  return rows.map(mapSignal);
}

export async function insertSignal(
  signal: Omit<SignalRecord, "id" | "createdAt">
): Promise<SignalRecord | null> {
  try {
    const db = getDb();
    const [row] = await db
      .insert(signals)
      .values({
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        takeProfit: signal.takeProfit,
        stopLoss: signal.stopLoss,
        patterns: signal.patterns,
        score: signal.score,
        timestamp: signal.timestamp,
        suppressed: signal.suppressed,
        cronInterval: signal.cronInterval,
      })
      .returning();
    return mapSignal(row);
  } catch (error) {
    console.error("[signals] Failed to insert signal", signal.symbol, error);
    return null;
  }
}

export async function queryForDashboard(
  filters: DashboardFilters
): Promise<PaginatedResult<SignalRecord>> {
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 20));
  const page = Math.max(1, filters.page ?? 1);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const db = getDb();

  const conditions = [gte(signals.timestamp, since)];
  if (filters.symbolFilter?.trim()) {
    conditions.push(ilike(signals.symbol, `%${filters.symbolFilter.trim()}%`));
  }

  const whereClause = and(...conditions);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signals)
    .where(whereClause);

  const totalCount = count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select()
    .from(signals)
    .where(whereClause)
    .orderBy(desc(signals.timestamp))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map(mapSignal),
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
