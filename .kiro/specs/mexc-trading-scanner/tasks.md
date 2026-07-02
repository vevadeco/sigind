# Implementation Plan: MEXC Trading Scanner

## Overview

This plan implements a Next.js 14+ App Router application with two core features: an automated MEXC futures trading scanner (cron-triggered pipeline for pattern detection, scoring, and Telegram delivery) and a manual chart analyzer (Claude Vision-powered screenshot analysis). The implementation proceeds from foundational setup through core computation modules, integration layers, and finally UI pages.

## Tasks

- [ ] 1. Project setup and core infrastructure
  - [-] 1.1 Initialize Next.js 14+ project with TypeScript, Tailwind CSS, and App Router
    - Create the Next.js project with `create-next-app` using App Router
    - Configure `tsconfig.json` with strict mode
    - Install core dependencies: `drizzle-orm`, `@neondatabase/serverless`, `fast-check`, `vitest`, `@anthropic-ai/sdk`
    - Install dev dependencies: `drizzle-kit`, `msw`, `@testing-library/react`
    - Create `vercel.json` with cron schedule configuration (every 15 minutes targeting `/api/cron`)
    - _Requirements: 10.5, 10.6_

  - [~] 1.2 Implement configuration module (`lib/config.ts`)
    - Define `ScannerConfig` interface with all parameters and their types
    - Implement `loadConfig()` function that reads from environment variables and `SCANNER_CONFIG` JSON
    - Implement validation logic: range checks, type checks, enum validation for each parameter
    - Fall back to documented defaults when values are invalid, log warnings for each fallback
    - Validate required env vars (MEXC_API_KEY, MEXC_API_SECRET, DATABASE_URL, CRON_SECRET, ANTHROPIC_API_KEY) and log errors for missing ones
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 1.3 Write property test for configuration validation
    - **Property 24: Configuration Validation with Fallback**
    - **Validates: Requirements 10.3, 10.4**

  - [~] 1.4 Set up database schema and Drizzle ORM configuration (`lib/db/schema.ts`)
    - Define `signals` table with columns: id, symbol, direction, entry_price, take_profit, stop_loss, patterns (text array), score, timestamp, suppressed, cron_interval, created_at
    - Define `sessions` table with columns: id, token, expires_at, created_at
    - Add indexes: timestamp, symbol, dedupe composite (symbol + direction + timestamp), cron_interval
    - Configure Drizzle with Neon serverless driver
    - Create `drizzle.config.ts` for migrations
    - _Requirements: 6.1, 6.4, 6.5_

- [~] 2. Checkpoint - Ensure project builds and schema is valid
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement market data service
  - [~] 3.1 Create market data service (`lib/market-data.ts`)
    - Define `Kline` interface with timestamp, open, high, low, close, volume fields
    - Implement `fetchKlines(symbol, interval, limit)` function calling MEXC Futures REST API
    - Map interval config values ('5m', '15m', '30m') to MEXC API params ('Min5', 'Min15', 'Min30')
    - Calculate correct `start`/`end` timestamps based on rolling window duration and interval
    - Implement 10-second timeout with AbortController
    - Return `null` on error (timeout, HTTP error, insufficient data, missing fields)
    - Validate response: check record count matches expected, check all required fields present
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write property test for kline request count calculation
    - **Property 4: Kline Request Count Matches Configuration**
    - **Validates: Requirements 2.2**

  - [ ]* 3.3 Write property test for incomplete data rejection
    - **Property 5: Incomplete Data Rejection**
    - **Validates: Requirements 2.6**

- [ ] 4. Implement pattern detection engine
  - [~] 4.1 Create pattern detection module (`lib/patterns.ts`)
    - Define `PatternDirection` type and `DetectedPattern` interface
    - Implement detection functions for all 12 patterns with quantifiable rules:
      - Single-candle: hammer, inverted hammer, shooting star, doji (body ≤ 10% of range)
      - Two-candle: bullish/bearish engulfing (second body contains first), piercing line, dark cloud cover
      - Three-candle: morning star, evening star, three white soldiers, three black crows
    - Implement minimum candle count guards per pattern type
    - Return array of `DetectedPattern` with name, direction, strength (0-1), and timestamp
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write property test for pattern detection determinism
    - **Property 6: Pattern Detection Determinism**
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 4.3 Write property test for pattern output validity
    - **Property 7: Pattern Output Validity**
    - **Validates: Requirements 3.2**

  - [ ]* 4.4 Write property test for minimum candle guard
    - **Property 8: Minimum Candle Guard**
    - **Validates: Requirements 3.3, 3.5**

- [ ] 5. Implement technical indicators module
  - [~] 5.1 Create technical indicators module (`lib/indicators.ts`)
    - Implement `calculateEMA(closes, period)` using recursive formula: `price × k + prevEMA × (1-k)` where `k = 2/(period+1)`
    - Implement `calculateRSI(closes, period)` using standard formula: `100 - 100/(1 + avgGain/avgLoss)`
    - Implement `calculateATR(klines, period)` using smoothed average of true ranges
    - Implement volume spike detection: compare latest candle volume to rolling window average × multiplier
    - Implement ATR percentile calculation within the rolling window
    - Implement `calculateIndicators(klines, config)` combining all indicators into `IndicatorResults`
    - _Requirements: 4.1_

  - [ ]* 5.2 Write property test for technical indicator mathematical correctness
    - **Property 9: Technical Indicator Mathematical Correctness**
    - **Validates: Requirements 4.1**

- [ ] 6. Implement scoring engine
  - [~] 6.1 Create scoring module (`lib/scoring.ts`)
    - Define `ScoringWeights` interface with defaults (pattern: 30, emaTrend: 25, rsiCondition: 20, volumeSpike: 15, atrCondition: 10)
    - Implement `computeScore(patterns, indicators, direction, config, weights?)` function
    - Pattern component: sum pattern strengths, cap at max weight (30)
    - EMA trend: full points if price aligns with signal direction (above EMA for bullish, below for bearish)
    - RSI: full points if in favorable zone (below oversold threshold for bullish, above overbought for bearish)
    - Volume spike: full points if volume exceeds threshold
    - ATR: full points if ATR within 25th-75th percentile range
    - Ensure final score is clamped to [0, 100]
    - _Requirements: 4.2, 4.3_

  - [~] 6.2 Implement signal ranking and selection (`lib/scoring.ts`)
    - Sort scored symbols by Signal_Score descending
    - Apply tiebreaker: most recent pattern detection timestamp first
    - Select top N symbols above minimum score threshold
    - Return empty array if no symbols exceed threshold
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 6.3 Write property test for score bounded and deterministic
    - **Property 10: Signal Score Bounded and Deterministic**
    - **Validates: Requirements 4.2**

  - [ ]* 6.4 Write property test for pattern score component cap
    - **Property 11: Pattern Score Component Capped**
    - **Validates: Requirements 4.3**

  - [ ]* 6.5 Write property test for signal ranking correctness
    - **Property 12: Signal Ranking Correctness**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [ ] 7. Implement trade level calculator
  - [~] 7.1 Create trade level calculator (`lib/trade-levels.ts`)
    - Implement entry price calculation: current close for breakout patterns, 50% retracement of last 20-candle swing for pullback patterns
    - Implement stop-loss calculation: wider of (swing high/low from last 20 candles) or (entry ± ATR multiplier × ATR)
    - Implement take-profit calculation: `entry + direction_sign × |entry - stopLoss| × ratio_multiplier`
    - Map pattern direction to trade direction: bullish → long, bearish → short
    - Return `null` if stop-loss equals entry (zero distance)
    - Parse Risk_Reward_Ratio string to numeric multiplier (1:1.5 → 1.5, 1:2 → 2, 1:3 → 3)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 7.2 Write property test for entry price calculation
    - **Property 13: Entry Price Calculation**
    - **Validates: Requirements 5.1**

  - [ ]* 7.3 Write property test for stop-loss wider-of rule
    - **Property 14: Stop-Loss Wider-Of Rule**
    - **Validates: Requirements 5.2**

  - [ ]* 7.4 Write property test for take-profit formula
    - **Property 15: Take-Profit Formula**
    - **Validates: Requirements 5.3**

  - [ ]* 7.5 Write property test for direction mapping
    - **Property 16: Direction Mapping**
    - **Validates: Requirements 5.6**

  - [ ]* 7.6 Write property test for zero-distance stop-loss discard
    - **Property 17: Zero-Distance Stop-Loss Discards Signal**
    - **Validates: Requirements 5.7**

- [~] 8. Checkpoint - Ensure all core computation modules pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement signal persistence and deduplication
  - [~] 9.1 Create signal repository (`lib/db/signals.ts`)
    - Implement `findDuplicates(symbol, direction, windowHours)` querying non-suppressed signals within the dedupe window
    - Implement `findByCronInterval(interval)` for idempotency checks
    - Implement `insert(signal)` to persist signal records
    - Implement `queryForDashboard(filters)` with pagination, symbol filter (case-insensitive partial match), 7-day window, and timestamp descending order
    - Handle database write failures: log error, return null to indicate failure
    - Handle database read failures on dedup query: log warning, treat as no duplicate
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 9.2 Write property test for signal deduplication logic
    - **Property 18: Signal Deduplication**
    - **Validates: Requirements 6.2, 6.3**

- [ ] 10. Implement Telegram notifier
  - [~] 10.1 Create Telegram notifier (`lib/telegram.ts`)
    - Implement `isConfigured()` checking TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID presence
    - Implement `sendSignal(signal)` formatting and sending messages via Telegram Bot API
    - Format message with: symbol, direction, pattern names, entry, TP, SL, R:R ratio, score, UTC ISO 8601 timestamp
    - Implement sequential delivery with 1-second delay between messages
    - Implement 30-second timeout per message
    - Log errors with symbol details on failure, skip without retry, continue
    - Log missing config at startup and skip all Telegram for the run
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.2 Write property test for Telegram message completeness
    - **Property 19: Telegram Message Completeness**
    - **Validates: Requirements 7.2**

- [ ] 11. Implement cron handler and scanner pipeline orchestration
  - [~] 11.1 Create cron route handler (`app/api/cron/route.ts`)
    - Implement GET handler with CRON_SECRET validation (return 401 if invalid)
    - Orchestrate full pipeline: load config → fetch watchlist → process symbols → score → rank → calculate levels → deduplicate → persist → notify
    - Implement idempotency: check `findByCronInterval` before processing
    - Wrap execution in try/catch: return 500 on unhandled exception with no Telegram delivery
    - Return 200 with `{ success: true, signalsGenerated: count }` on success
    - Ensure sequential symbol processing stays within 60-second function limit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 11.2 Write property test for cron authentication correctness
    - **Property 1: Cron Authentication Correctness**
    - **Validates: Requirements 1.1, 1.2, 11.3**

  - [ ]* 11.3 Write property test for cron idempotency
    - **Property 2: Cron Idempotency**
    - **Validates: Requirements 1.3**

  - [ ]* 11.4 Write property test for error isolation
    - **Property 3: Error Isolation**
    - **Validates: Requirements 1.5**

- [~] 12. Checkpoint - Ensure scanner pipeline end-to-end logic is correct
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement authentication and middleware
  - [~] 13.1 Create authentication system (`middleware.ts`, `app/login/page.tsx`, `app/api/auth/route.ts`)
    - Implement Next.js middleware checking for valid session cookie on `/dashboard` and `/analyzer` routes
    - Create login page with password input form
    - Create auth API route that validates APP_PASSWORD, creates session in DB, sets cookie
    - Redirect unauthenticated users to `/login`
    - Implement session expiry handling
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 14. Implement signal dashboard
  - [~] 14.1 Create dashboard page (`app/dashboard/page.tsx`)
    - Implement Server Component that queries signals from last 7 days ordered by timestamp descending
    - Display each signal: symbol, direction, entry, TP, SL, patterns, score, timestamp, suppressed status
    - Implement symbol filter text input with case-insensitive partial matching
    - Implement pagination with configurable page size (default 20, min 10, max 100)
    - Display empty state message when no signals match filter or exist within 7-day window
    - Display error state with retry option on database query failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 14.2 Write property test for dashboard query correctness
    - **Property 20: Dashboard Query Correctness**
    - **Validates: Requirements 8.1, 8.3**

  - [ ]* 14.3 Write property test for pagination correctness
    - **Property 21: Pagination Correctness**
    - **Validates: Requirements 8.4**

- [ ] 15. Implement chart analyzer
  - [~] 15.1 Create analyzer page and API route (`app/analyzer/page.tsx`, `app/api/analyze/route.ts`)
    - Build upload form accepting PNG, JPEG, WEBP (max 5 MB) via file upload or clipboard paste
    - Implement client-side file type and size validation with specific error messages
    - Implement numeric inputs for entry, TP, SL with validation (positive numbers > 0)
    - Disable submit button until all inputs are valid
    - Implement loading indicator while awaiting API response
    - Create API route handler that sends base64 image + trade levels to Anthropic Claude Vision
    - Parse response into structured sections: patterns, trend assessment, trade evaluation, summary
    - Display error message on API failure without exposing API details
    - Display disclaimer about automated analysis limitations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 15.2 Write property test for file upload validation
    - **Property 22: File Upload Validation**
    - **Validates: Requirements 9.2, 9.7**

  - [ ]* 15.3 Write property test for trade level input validation
    - **Property 23: Trade Level Input Validation**
    - **Validates: Requirements 9.3**

- [~] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript throughout as specified in the design document
- All external API calls (MEXC, Telegram, Anthropic) should be mockable via MSW for testing
- Database migrations should be generated via `drizzle-kit generate` after schema definition

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 6, "tasks": ["6.5", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 7, "tasks": ["9.1", "10.1"] },
    { "id": 8, "tasks": ["9.2", "10.2", "11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4", "13.1"] },
    { "id": 10, "tasks": ["14.1", "15.1"] },
    { "id": 11, "tasks": ["14.2", "14.3", "15.2", "15.3"] }
  ]
}
```
