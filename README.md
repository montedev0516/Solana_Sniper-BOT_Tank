# Solana Telegram Signal Trading Bot (Raydium)

Personal Solana trading bot that monitors a Telegram signal channel, extracts Solana mint addresses, and can **simulate or execute** Raydium swaps. Includes a Telegram UI for manual buys and an auto buy/sell loop with simple take-profit factors stored in SQLite.

1. [About](#about)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Configuration](#configuration)
7. [Screenshots](#screenshots)
8. [API Documentation](#api-documentation)
9. [Contact](#contact)

## About
This project was built to automate “signal → execution” for Solana tokens by:
- Monitoring a Telegram channel for token mint addresses
- Validating addresses (Solana only)
- Buying on Raydium fast (priority fee supported)
- Tracking buys in SQLite and selling based on configurable take‑profit factors

> Note: This is a **personal trading bot** and is not intended as a public, production-ready system. Trading is risky—use at your own responsibility.

## Features
- **Telegram trading UI**: `/start` + inline buttons for Manual Buy / Auto Buy.
- **Signal scraping**: pulls recent messages from a target Telegram channel and extracts Solana mint addresses.
- **Raydium swap (simulate or execute)**: controlled by `src/Raydium/swapConfig.ts` (`executeSwap` defaults to `false`).
- **Priority fee support**: sets compute budget `microLamports` via `swapConfig.maxLamports`.
- **Auto sell loop**: checks token price and triggers sells using the configured take-profit “price factors” (no manual “sell now” flow yet).
- **SQLite persistence**: saves buy history to `trading.db` and uses it to drive sells.
- **Price sources**: Moralis (Solana token price) + Bitquery (DEX trade price) with retry logic.

## Tech Stack
- **Languages**: TypeScript, Node.js
- **Core libs**: `@solana/web3.js`, `@raydium-io/raydium-sdk`, `@coral-xyz/anchor`
- **Telegram**: `node-telegram-bot-api`, `telegram-scraper`
- **Data / storage**: `sqlite3` (`trading.db`)
- **HTTP / utilities**: `axios`, `dotenv`, `bs58`
- **Dev tooling**: `nodemon`, `ts-node`, `typescript`, Yarn/NPM

## Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/solana-trading-bot.git

# Navigate to the project directory
cd solana-trading-bot

# Install dependencies
yarn install

# (Optional) Typecheck/build
yarn build
```

## Usage
```bash
# Copy env template and fill it in
# PowerShell / Windows
copy env.example .env

# macOS / Linux
# cp env.example .env

# Start the bot (nodemon + TS entrypoint)
yarn start
```

Then open Telegram and:
- Start a chat with **your bot** (created via BotFather using your `TELEGRAM_TOKEN`)
- Send `/start`
- Choose:
  - **Manual Buy**: enter SOL amount → enter token mint address
  - **Auto Buy**: continuously scrapes the configured signal channel and triggers buy/sell loops

## Configuration
### Environment variables
Create a `.env` file (use `env.example` as a template):
- **`TELEGRAM_TOKEN`**: Telegram bot token from BotFather
- **`RPC_URL`**: Solana mainnet RPC HTTP endpoint
- **`WEBSOCKET_URL`**: Solana mainnet RPC WebSocket endpoint
- **`SOLANA_WALLET_PRIVATE_KEY`**: base58-encoded **secret key** (not a public address)
- **`MORALIS_API_KEY`**: used for token price lookup (Moralis Solana API)
- **`BITQUERY_V1_TOKEN` / `BITQUERY_V2_TOKEN`**: used for Bitquery price lookup
- **`FALCONHIT_API_KEY`**: used to fetch pool info for a token pair (FalconHit API)

### Trading behavior
- **Swap execution toggle**: `src/Raydium/swapConfig.ts`
  - `executeSwap: false` = simulate only (safe default)
  - set `executeSwap: true` to actually send transactions
- **Priority fee**: `src/Raydium/swapConfig.ts` → `maxLamports` (compute budget micro-lamports)
- **Slippage**: currently hard-coded in `src/Raydium/RaydiumSwap.ts` (see `Percent(...)`)
- **Auto-buy amount range**: `src/config.ts` → `solBuyAmountRange`
- **Polling intervals**: `src/config.ts` → `msgCatchInternalDuration`, `sellInternalDuration`
- **Take-profit factors**: `src/config.ts` → `priceFactor` (used by the auto-sell decision logic)

### Signal source (Telegram channel)
The scraper currently targets the username configured in `src/startTrade.ts` (default is `Maestrosdegen`). Change that value to your own signal channel username.

## Screenshots
![Bot UI](/assets/Solana_Tank_Bot.png)

![Strategy](/assets/Stratergy.png)

![Realtime Monitor](/assets/Monitor.png)

![Trading Process](/assets/Trading_Process.png)

## API Documentation
This project does not expose an HTTP API. The “API surface” is the Telegram bot interface:
- **`/start`**: shows the main menu (Buy / Sell / Help / Channel)
- **Manual Buy flow**: amount → token mint address → executes swap flow
- **Auto Buy**: starts background loops for scraping + buy + sell
- **Stop Trading**: stops the running intervals

> Note: the **Sell** button is currently a UI entry only; selling is triggered automatically by the take-profit logic.

## Contact
- **Email**: international.contributor.21@gmail.com
