-- MEXC Trading Scanner initial schema

CREATE TABLE IF NOT EXISTS "signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "symbol" text NOT NULL,
  "direction" text NOT NULL,
  "entry_price" real NOT NULL,
  "take_profit" real NOT NULL,
  "stop_loss" real NOT NULL,
  "patterns" text[] NOT NULL,
  "score" real NOT NULL,
  "timestamp" timestamptz NOT NULL,
  "suppressed" boolean DEFAULT false NOT NULL,
  "cron_interval" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_signals_timestamp" ON "signals" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_signals_symbol" ON "signals" ("symbol");
CREATE INDEX IF NOT EXISTS "idx_signals_dedupe" ON "signals" ("symbol", "direction", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_signals_cron_interval" ON "signals" ("cron_interval");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
