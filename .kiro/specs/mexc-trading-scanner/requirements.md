# Requirements Document

## Introduction

A Next.js (App Router) web application deployed on Vercel that provides two core capabilities for MEXC futures trading: (1) an automated scanner that periodically analyzes candlestick patterns and technical indicators across configured futures pairs, generates scored trade signals with entry/TP/SL levels, stores them in a database, and pushes top signals to Telegram; and (2) a manual chart analyzer page where the user uploads a candlestick chart screenshot with proposed trade levels, and a vision-capable LLM assesses the setup and returns a structured analysis.

## Glossary

- **Scanner**: The automated background process triggered by Vercel Cron Jobs that fetches market data, detects patterns, scores setups, and delivers signals.
- **Signal**: A generated trade recommendation containing symbol, direction, entry price, take-profit, stop-loss, detected patterns, confluence score, and timestamp.
- **Analyzer**: The manual chart screenshot analysis feature that uses a vision-capable LLM to assess a proposed trade setup.
- **Kline**: A single candlestick data point containing open, high, low, close, volume, and timestamp for a specific time interval.
- **Rolling_Window**: A configurable time span (default 3 hours) of recent kline data used for pattern detection and indicator calculation.
- **Watchlist**: A configurable list of MEXC futures symbol identifiers that the Scanner evaluates on each run.
- **Signal_Score**: A numeric value in the range 0 to 100 representing the quality of a detected trade setup, derived from pattern strength, trend confluence, and volatility conditions.
- **Confluence**: The combination of multiple technical factors (pattern detection, EMA direction, RSI, volume spike, ATR) that together strengthen or weaken a signal.
- **ATR**: Average True Range — a volatility indicator used for stop-loss placement and take-profit calculation.
- **EMA**: Exponential Moving Average — a trend-following indicator used for directional confluence.
- **RSI**: Relative Strength Index — a momentum oscillator used for overbought/oversold confluence.
- **Dedupe_Window**: A configurable time period during which duplicate or overlapping signals for the same symbol and direction are suppressed.
- **Risk_Reward_Ratio**: The ratio of potential profit (entry to take-profit distance) to potential loss (entry to stop-loss distance).
- **App_Router**: The Next.js App Router architecture used for routing and server components.
- **Cron_Handler**: The API route endpoint triggered by Vercel Cron Jobs to execute the Scanner.
- **Database**: A PostgreSQL-compatible database (Neon) accessed via Drizzle ORM for signal persistence.
- **Telegram_Bot**: The Telegram Bot API integration used to deliver Signal messages to a configured chat.
- **Vision_LLM**: The Anthropic Claude vision-capable model used by the Analyzer to interpret chart screenshots.

## Requirements

### Requirement 1: Cron-Triggered Scanner Execution

**User Story:** As a trader, I want the scanner to run automatically on a schedule, so that I receive trade signals without manual intervention.

#### Acceptance Criteria

1. WHEN the Vercel Cron schedule fires (every 15 minutes), THE Cron_Handler SHALL verify the request contains a valid CRON_SECRET header before executing the Scanner.
2. IF the CRON_SECRET header is missing or invalid, THEN THE Cron_Handler SHALL return an HTTP 401 response and halt execution.
3. THE Cron_Handler SHALL be idempotent such that concurrent executions for the same cron interval period produce no duplicate signals in the Database, achieved by checking existing signals for the current interval before persisting new ones.
4. WHEN the Scanner executes successfully, THE Cron_Handler SHALL complete within 60 seconds to remain within Vercel serverless function time limits and return an HTTP 200 response including the count of signals generated.
5. IF an unhandled exception occurs or a failure prevents signal generation from completing, THEN THE Cron_Handler SHALL log the error details and return an HTTP 500 response without sending partial signals to Telegram.

### Requirement 2: Market Data Retrieval

**User Story:** As a trader, I want the scanner to fetch current candlestick data from MEXC, so that pattern analysis uses up-to-date market information.

#### Acceptance Criteria

1. WHEN the Scanner executes, THE Scanner SHALL fetch the list of symbols from the configured Watchlist.
2. WHEN processing a symbol, THE Scanner SHALL retrieve Kline data from the MEXC Futures REST API at the configured candle interval (default 15-minute) covering the full Rolling_Window duration.
3. THE Scanner SHALL support configurable candle intervals of 5 minutes, 15 minutes, and 30 minutes.
4. IF the MEXC API returns an error or does not respond within 10 seconds for a symbol, THEN THE Scanner SHALL skip that symbol without retrying, log the failure reason, and continue processing remaining symbols.
5. THE Scanner SHALL include open, high, low, close, volume, and timestamp fields for each retrieved Kline.
6. IF the MEXC API returns a response with fewer Kline records than expected for the Rolling_Window duration or with missing required fields (open, high, low, close, volume, timestamp), THEN THE Scanner SHALL treat that symbol's data as incomplete, skip pattern analysis for that symbol, and log the discrepancy.
7. THE Watchlist SHALL contain a maximum of 50 symbols.

### Requirement 3: Candlestick Pattern Detection

**User Story:** As a trader, I want the scanner to detect common candlestick patterns, so that I can be alerted to potential trade setups.

#### Acceptance Criteria

1. WHEN Kline data is available for a symbol, THE Scanner SHALL analyze the Rolling_Window for the following patterns: bullish engulfing, bearish engulfing, hammer, inverted hammer, shooting star, doji, morning star, evening star, three white soldiers, three black crows, piercing line, and dark cloud cover.
2. WHEN a pattern is detected, THE Scanner SHALL record the pattern name, direction (bullish or bearish), a pattern strength value between 0 and 1 representing detection confidence, and the Kline timestamp at which the pattern completed.
3. THE Scanner SHALL require a minimum candle count per pattern type before attempting detection: 2 candles for engulfing, piercing line, and dark cloud cover; 3 candles for morning star, evening star, three white soldiers, and three black crows; and 1 candle for hammer, inverted hammer, shooting star, and doji.
4. THE Scanner SHALL define each pattern using quantifiable body-to-range ratios and relative candle size thresholds (e.g., doji: body size no greater than 10% of total high-low range; engulfing: second candle body fully contains first candle body), so that detection is deterministic and repeatable.
5. IF the Rolling_Window contains fewer Klines than the minimum candle count required by a pattern, THEN THE Scanner SHALL skip detection of that pattern for the symbol and continue evaluating other patterns that have sufficient data.

### Requirement 4: Technical Indicator Confluence Scoring

**User Story:** As a trader, I want signals scored by multiple technical factors, so that I receive higher-quality alerts with fewer false positives.

#### Acceptance Criteria

1. WHEN patterns are detected for a symbol, THE Scanner SHALL calculate the following from the Rolling_Window data: EMA direction using a configurable period (default 20), RSI value using a configurable period (default 14), volume spike detection where a spike is defined as the most recent candle's volume exceeding the Rolling_Window average volume by a configurable multiplier (default 1.5x), and ATR value using a configurable period (default 14).
2. THE Scanner SHALL compute a Signal_Score as a numeric value in the range 0 to 100 by summing weighted contributions from: pattern detection (present or absent), EMA trend alignment (price is above EMA for bullish signals or below EMA for bearish signals), RSI conditions (RSI below a configurable oversold threshold, default 40, for bullish signals or above a configurable overbought threshold, default 60, for bearish signals), volume spike presence, and ATR-based volatility assessment (ATR is within a configurable percentile range of Rolling_Window ATR values indicating sufficient but not excessive volatility).
3. WHEN multiple patterns are detected for a symbol in the same Rolling_Window, THE Scanner SHALL sum the individual pattern score contributions, capped at the maximum pattern component weight, into a single Signal_Score.
4. THE Scanner SHALL rank all symbols with detected patterns by Signal_Score in descending order and select the top N symbols (configurable, default 5) for signal generation.
5. IF no symbols produce a Signal_Score above a configurable minimum threshold (default 50), THEN THE Scanner SHALL generate no signals for that run.
6. IF two or more symbols share the same Signal_Score during ranking, THEN THE Scanner SHALL use the most recent pattern detection timestamp as a tiebreaker, selecting the more recently detected pattern first.

### Requirement 5: Trade Level Calculation

**User Story:** As a trader, I want each signal to include specific entry, stop-loss, and take-profit levels, so that I can execute trades with defined risk parameters.

#### Acceptance Criteria

1. WHEN a signal is generated, THE Scanner SHALL calculate an entry price set to the current market price for breakout patterns, or set to a pullback level defined as a retracement of 50% of the most recent swing measured over the last 20 candles for pullback patterns, in the signal direction.
2. WHEN a signal is generated, THE Scanner SHALL calculate a stop-loss level placed beyond the swing high (for short signals) or swing low (for long signals) identified within the most recent 20 candles, or at a configurable multiple of ATR (default 1.5x ATR) from the entry price, whichever provides a wider stop.
3. WHEN a signal is generated, THE Scanner SHALL calculate a take-profit level using the configured Risk_Reward_Ratio (default 1:2) applied to the distance between entry and stop-loss, placed in the signal direction from the entry price.
4. THE Scanner SHALL support configurable Risk_Reward_Ratio values of 1:1.5, 1:2, and 1:3.
5. IF a Risk_Reward_Ratio value other than 1:1.5, 1:2, or 1:3 is provided, THEN THE Scanner SHALL reject the configuration and retain the previous valid Risk_Reward_Ratio value.
6. WHEN a signal is generated, THE Scanner SHALL record the direction as either "long" or "short" based on the detected pattern orientation.
7. IF the calculated stop-loss level equals the entry price resulting in zero distance, THEN THE Scanner SHALL discard the signal and not emit a trade recommendation.

### Requirement 6: Signal Persistence and Deduplication

**User Story:** As a trader, I want signals stored in a database with deduplication, so that I can review history and avoid redundant alerts.

#### Acceptance Criteria

1. WHEN a signal is generated, THE Database SHALL store the signal record containing: symbol, direction, entry price, take-profit, stop-loss, detected patterns, Signal_Score, timestamp, and a suppressed flag indicating whether Telegram delivery was skipped due to deduplication.
2. WHEN a signal is generated, THE Scanner SHALL query the Database for existing non-suppressed signals matching the same symbol and direction within the configured Dedupe_Window (default 4 hours).
3. IF a matching signal exists within the Dedupe_Window, THEN THE Scanner SHALL store the new signal with the suppressed flag set to true and SHALL NOT send a Telegram notification.
4. THE Database SHALL use a PostgreSQL-compatible backend (Neon) accessed through Drizzle ORM.
5. THE Database schema SHALL support querying signals by timestamp range, symbol, direction, and suppressed status for the dashboard display.
6. IF a Database write operation fails, THEN THE Scanner SHALL log the error, skip Telegram delivery for that signal, and continue processing remaining symbols.

### Requirement 7: Telegram Signal Delivery

**User Story:** As a trader, I want trade signals pushed to my Telegram chat, so that I receive timely notifications on my mobile device.

#### Acceptance Criteria

1. WHEN a non-duplicate signal passes deduplication, THE Telegram_Bot SHALL send a formatted message to the configured Telegram chat using the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.
2. THE Telegram_Bot SHALL format each message to include: symbol, direction (long/short), detected pattern names, entry price, take-profit, stop-loss, Risk_Reward_Ratio, Signal_Score, and timestamp in UTC ISO 8601 format.
3. IF the Telegram API returns an error or the request times out within 30 seconds, THEN THE Telegram_Bot SHALL log the error details including the affected symbol, skip the failed message without retry, and continue sending any remaining queued messages.
4. THE Telegram_Bot SHALL send messages sequentially with a minimum 1-second delay between consecutive messages to respect Telegram rate limits.
5. IF the TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable is missing or empty at Scanner startup, THEN THE Telegram_Bot SHALL log an error indicating the missing configuration and skip all Telegram message delivery for that execution.

### Requirement 8: Signal Dashboard

**User Story:** As a trader, I want a web dashboard showing recent signals, so that I can review scanner history in the browser.

#### Acceptance Criteria

1. WHEN a user navigates to the dashboard page, THE App_Router SHALL display signals from the Database generated within the last 7 days, ordered by timestamp descending.
2. THE dashboard page SHALL display for each signal: symbol, direction, entry price, take-profit, stop-loss, detected patterns, Signal_Score, timestamp, and suppressed status.
3. THE dashboard page SHALL support filtering signals by symbol name using a text input that performs case-insensitive partial matching.
4. THE dashboard page SHALL paginate results with a configurable page size (default 20 signals per page, minimum 10, maximum 100).
5. IF no signals match the current filter or no signals exist within the 7-day window, THEN THE dashboard page SHALL display an empty state message indicating no signals are available.
6. IF the Database query fails, THEN THE dashboard page SHALL display an error message indicating data could not be loaded and provide a retry option.

### Requirement 9: Chart Screenshot Analysis

**User Story:** As a trader, I want to upload a chart screenshot with proposed trade levels and receive an AI-powered assessment, so that I can validate my manual analysis before entering a trade.

#### Acceptance Criteria

1. WHEN a user submits a chart image with entry price, take-profit, and stop-loss values, THE Analyzer SHALL send the image (base64-encoded) and trade levels to the Anthropic API using a vision-capable Claude model via the @anthropic-ai/sdk.
2. THE Analyzer page SHALL accept chart images in PNG, JPEG, or WEBP format, with a maximum file size of 5 MB, via file upload or clipboard paste.
3. THE Analyzer page SHALL require numeric inputs for entry price, take-profit, and stop-loss, each accepting only positive values greater than zero, before submission is enabled.
4. WHEN the Vision_LLM returns a response, THE Analyzer SHALL parse and display the result in distinct labeled sections for: identified patterns, trend assessment, trade setup evaluation, and a plain-language summary.
5. THE Analyzer page SHALL display a disclaimer stating that the analysis is automated, not financial advice, and limited to what is visible in the screenshot.
6. IF the Anthropic API returns an error or the response cannot be parsed into the expected structured format, THEN THE Analyzer SHALL display a user-facing error message indicating the analysis could not be completed, without exposing API details.
7. IF a user submits an image that is not in PNG, JPEG, or WEBP format or exceeds 5 MB, THEN THE Analyzer SHALL display an error message indicating the file type or size constraint that was violated and SHALL NOT submit the request to the API.
8. WHILE the Analyzer is awaiting a response from the Anthropic API, THE Analyzer SHALL display a loading indicator and SHALL disable the submit button until the response is received or an error occurs.

### Requirement 10: Application Configuration and Environment

**User Story:** As a developer, I want all sensitive credentials and configurable parameters managed through environment variables and configuration, so that the application is secure and adjustable without code changes.

#### Acceptance Criteria

1. THE App_Router SHALL read MEXC_API_KEY, MEXC_API_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY, DATABASE_URL, and CRON_SECRET from environment variables.
2. IF any required environment variable (MEXC_API_KEY, MEXC_API_SECRET, DATABASE_URL, CRON_SECRET, ANTHROPIC_API_KEY) is missing at startup, THEN THE App_Router SHALL log an error message that names each missing variable.
3. THE Scanner SHALL support runtime configuration through environment variables or a configuration file for the following parameters with specified defaults: Watchlist symbols (default: empty list, max 50 symbols), candle interval (default: 15m, allowed: 5m, 15m, 30m), Rolling_Window duration (default: 3 hours), minimum Signal_Score threshold (default: 50, range: 0–100), top N signals per run (default: 5, range: 1–50), ATR multiplier for stop-loss (default: 1.5, range: 0.5–5.0), Risk_Reward_Ratio (default: 1:2, allowed: 1:1.5, 1:2, 1:3), and Dedupe_Window duration (default: 4 hours, range: 1–24 hours).
4. IF a runtime configuration value is outside its valid range or of an invalid type, THEN THE Scanner SHALL fall back to the default value for that parameter and log a warning message identifying the parameter and the invalid value provided.
5. THE application SHALL use Next.js 14 or later with the App Router, TypeScript, and Tailwind CSS for styling.
6. THE application SHALL define the cron schedule in vercel.json using Vercel Cron Job configuration.

### Requirement 11: Access Protection

**User Story:** As a user deploying this app publicly, I want the dashboard and analyzer pages protected, so that only authorized users can access the trading tools.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the dashboard page, THE App_Router SHALL redirect the user to an authentication mechanism before displaying content.
2. WHEN an unauthenticated user attempts to access the analyzer page, THE App_Router SHALL redirect the user to an authentication mechanism before displaying content.
3. THE Cron_Handler SHALL only accept requests containing the valid CRON_SECRET, rejecting all other requests with HTTP 401.
4. THE authentication mechanism SHALL support a simple shared-secret or password-based approach suitable for single-user personal deployment.
