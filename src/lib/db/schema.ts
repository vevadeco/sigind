import {
  boolean,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: text("symbol").notNull(),
    direction: text("direction", { enum: ["long", "short"] }).notNull(),
    entryPrice: real("entry_price").notNull(),
    takeProfit: real("take_profit").notNull(),
    stopLoss: real("stop_loss").notNull(),
    patterns: text("patterns").array().notNull(),
    score: real("score").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    suppressed: boolean("suppressed").notNull().default(false),
    cronInterval: text("cron_interval").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    timestampIdx: index("idx_signals_timestamp").on(table.timestamp),
    symbolIdx: index("idx_signals_symbol").on(table.symbol),
    dedupeIdx: index("idx_signals_dedupe").on(
      table.symbol,
      table.direction,
      table.timestamp
    ),
    cronIntervalIdx: index("idx_signals_cron_interval").on(table.cronInterval),
  })
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DbSignal = typeof signals.$inferSelect;
export type NewDbSignal = typeof signals.$inferInsert;
