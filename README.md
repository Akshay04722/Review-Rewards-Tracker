# ReviewRewards Tracker 🎁

A full-stack web application and automated crawler pipeline for discovering, extracting, verifying, and tracking public software review incentive campaigns (Amazon gift cards, prepaid Visa cards, cash, and donations) offered by B2B vendors on **G2, Capterra, TrustRadius, Gartner Peer Insights, Software Advice, GetApp, and Trustpilot**.

---

## Features

- **Automated Discovery**: Pluggable search architecture querying Google Programmable Search, SerpAPI, Brave Search, or Mock providers.
- **Polite & Safe Crawling**: Strictly obeys `robots.txt`, enforces domain rate limiting (1 request per 2s), exponential backoff retries, and never bypasses authentication or bot protection.
- **Robust Extraction Pipeline**: Heuristic and regex extraction engine normalizing vendor name, product name, platform, direct campaign survey link, reward amount, currency, reward type, eligibility rules, limit caps, and deadlines. Optional LLM fallback powered by Anthropic Claude with strict Zod validation.
- **Active / Expired Status Engine**:
  - `ACTIVE`: Verified working direct survey link with future deadline or verified recent activity within 30 days.
  - `LIKELY_ACTIVE`: Active page without ending phrases, older than 30 days without an explicit cut-off.
  - `EXPIRED`: HTTP 404/410, past deadlines, explicit termination phrases (*"offer ended"*, *"all gift cards claimed"*, *"campaign closed"*), or 2 consecutive failed health checks.
  - Automatic 24-hour re-verification schedule with full audit logging in `StatusHistory`.
- **Modern User Experience**:
  - Filter sidebar with multi-select platforms, status pills, minimum reward amounts, reward types, and live search.
  - Card and compact table view modes.
  - Direct campaign launch buttons with `rel="noopener noreferrer"`.
  - Campaign detail page with complete status transition timeline and community *"Report as expired"* mechanism.
  - Token-protected Admin control center for monitoring crawl cycles, viewing failed URLs, and triggering manual discovery.
  - Sleek dark/light theme support.
  - Prominent community compliance disclaimer.

---

## Tech Stack

- **Frontend & API**: Next.js 14 (App Router, TypeScript, Tailwind CSS, Lucide Icons)
- **Database**: Prisma ORM with SQLite (zero-config local dev) and PostgreSQL (Docker & Production)
- **Crawler & Worker**: Node.js worker, `node-cron`, `undici`, `cheerio`, `robots-parser`, and optional `playwright`
- **Validation & AI**: `zod`, `@anthropic-ai/sdk` (optional)
- **Testing**: `vitest` with saved HTML fixtures

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ or 20+ installed
- npm 9+ or pnpm/yarn

### 2. Clone and Install
```bash
git clone <repo-url>
cd "ReviewRewards Tracker"
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default local `.env` configuration (uses SQLite out of the box):
```env
DATABASE_URL="file:./dev.db"
SEARCH_PROVIDER="serpapi"
SERPAPI_API_KEY="your_serpapi_key_here"
SERPAPI_TBS="qdr:m"
MAX_SEARCHES_PER_RUN="20"
ADMIN_TOKEN="admin_secret_token_123"
PORT=3000
```

### 4. Setup Database & Seed Sample Campaigns
```bash
# Push schema to local SQLite database
npx prisma db push

# Seed 10 realistic sample campaigns across G2, Capterra, TrustRadius, etc.
npm run db:seed
```

### 5. Start the Web App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Visit [http://localhost:3000/admin](http://localhost:3000/admin) to view the Admin Console (Token: `admin_secret_token_123`).

---

## Running the Crawler Worker

### Run Worker as a Background Daemon
The background worker daemon (`worker/index.ts`) runs scheduled discovery crawls and 24-hour campaign re-verification cycles using `node-cron`:
```bash
npm run worker
```

### Run a One-Off Manual Crawl via CLI
To test discovery and extraction immediately without waiting for a cron interval:
```bash
npm run worker:crawl
```

---

## Running the Unit Tests

Unit tests test canonical URL cleaning, regex/heuristic extraction on saved HTML fixtures, and status detection rules:
```bash
npm test
```

---

## How to Add New Search Queries and Platforms

### 1. Adding a New Platform
1. In `src/lib/types.ts`, add the platform key to `PlatformList`:
   ```ts
   export const PlatformList = [
     "G2", "Capterra", "TrustRadius", "GartnerPeerInsights",
     "SoftwareAdvice", "GetApp", "Trustpilot", "YourNewPlatform", "Other"
   ] as const;
   ```
2. In `src/lib/crawler/extractor.ts`, register the domain pattern:
   ```ts
   PLATFORM_DOMAINS.push({ pattern: /newplatform\.com/i, platform: "YourNewPlatform" });
   ```
3. In `src/components/PlatformBadge.tsx`, add a branded styling tag.

### 2. Adding / Customizing Search Queries
Open `src/lib/crawler/search-providers.ts` and add desired query strings to `generateSearchQueries()`:
```ts
const baseQueries = [
  'leave a review on G2 get gift card',
  'write a review on YourNewPlatform earn reward',
  // ...
];
```
Queries dynamically generate current month and year queries (e.g. *"Capterra review gift card October 2026"*) to catch recent vendor promotions.

---

## Docker Deployment (PostgreSQL + App + Worker)

To run the entire ecosystem with PostgreSQL, the Next.js web application, and the background worker daemon in containers:

```bash
docker-compose up --build -d
```

Services started:
- **`postgres`**: PostgreSQL 16 on port 5432
- **`app`**: ReviewRewards web application on [http://localhost:3000](http://localhost:3000)
- **`worker`**: Background crawler and re-verification daemon

---

## Cloud Deployment Guide

### Web App on Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set Environment Variables:
   - `DATABASE_URL`: Hosted PostgreSQL connection string (Neon, Supabase, Railway, etc.)
   - `ADMIN_TOKEN`: Secure random token
   - `SEARCH_PROVIDER`: `google`, `serpapi`, `brave`, or `mock`
   - `SEARCH_API_KEY`: API key for your chosen provider
   - `GOOGLE_CSE_ID`: Custom Search Engine ID (if using Google)
3. Build Command: `npx prisma generate && next build`
4. Deploy!

### Worker on Railway or Fly.io
Because workers require a persistent background process or cron schedule:
1. **Railway**:
   - Create a service pointing to this repo.
   - Set start command to `npm run worker`.
   - Add same environment variables as above (`DATABASE_URL`, `SEARCH_PROVIDER`, etc.).
2. **Fly.io**:
   - Deploy using the provided `Dockerfile` with CMD set to `["npm", "run", "worker"]`.

---

## Compliance & Safe Scraping Principles

- **Public Pages Only**: Never bypasses logins, authentication barriers, paywalls, or bot mitigation services.
- **Robots.txt & Rate Limiting**: Checks `robots.txt` before fetching and enforces domain-level rate limiting (max 1 request per 2 seconds).
- **Incentive Disclosure**: All listings include links to vendor's direct survey pages. Users are reminded to disclose rewards in compliance with FTC guidelines and platform terms of service.
- **Privacy First**: Zero user tracking, cookies, or user account requirements.

---

## License
MIT License.
