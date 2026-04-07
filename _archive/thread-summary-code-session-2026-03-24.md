# Code Thread Summary — March 24, 2026

> Share this with your Claude Chat (strategy) thread to give it full context on what's been built and where the product stands technically.

---

## What Was Accomplished This Session

### 1. SQLite Database Migration
- Replaced the in-memory order cache with a persistent SQLite database (`flowhub.db`)
- Server restarts are now near-instant — no more re-fetching 6 years of order history from Flowhub API
- DB currently ~260MB with full history back to 2020 (~165,000+ orders)
- Growth rate: ~10-12MB/month at current transaction volume

### 2. Per-User AI Memory System
- `chat_history` table stores every AI query a user makes
- `user_profile` table stores a distilled summary of each user's analysis patterns
- Every 10 queries, Claude auto-summarizes the user's tendencies and injects that profile into future sessions
- This makes the AI assistant progressively smarter about what each user cares about

### 3. Prompt Injection Security Hardening
- Added security rules to the AI system prompt: read-only enforcement, injection detection, prompt confidentiality
- Low risk currently (app is password-protected, all tools are read-only) but foundational for when the product goes multi-tenant

### 4. Voided Order Fix
- Discovered that Flowhub marks voided orders with a `voided: true` boolean but keeps `orderStatus: 'sold'`
- Dashboard was counting voided orders in revenue — now filters them out everywhere

### 5. Inventory Deduplication
- Different METRC tag lots create separate entries in Flowhub with different `productId`s but identical product names
- Added server-side name-based dedup that combines quantities across lots
- Reduced SKU count from ~359 to ~304 visible products

### 6. Inventory Enhancements
- Switched from post-tax to pre-tax price display in all inventory modals
- Added Concentrates and Tinctures category cards (note: tinctures are categorized as "Accessories" in Flowhub due to no-THC tax classification — this is intentional, not a bug)

### 7. Frontend Modularization
- Split `dashboard.html` (1,388 lines) into ES modules:
  - `index.html` — shell, HTML structure, CSS
  - `js/state.js` — shared state (SD, AP), localStorage cache, data loading
  - `js/sales.js` — sales tab rendering, period cards, hourly chart
  - `js/inventory.js` — inventory tab, category modals, size modals
  - `js/customers.js` — customer tab rendering
  - `js/chat.js` — AI chat interface
  - `js/main.js` — initialization, tab switching, auto-refresh orchestration
- No framework, no build step — just ES module imports. Same deployment model (static files served by Express)

### 8. New Sales Cards
- "Last Week" card (Mon-Sun of previous week) showing revenue and transaction count
- "Last Month" card showing previous calendar month totals

### 9. Flowhub API Schema Documented
- All Flowhub API schemas (Order, Customer, Inventory, Payment, Tax, etc.) saved as reference docs
- Available to Claude in future sessions to prevent field-level bugs like the `voided` issue

---

## Current Architecture

```
Client: index.html + ES modules (vanilla JS, no framework)
Server: flowhub-proxy-server.js (Node/Express, ~2,000 lines)
Database: SQLite via better-sqlite3 (flowhub.db)
AI: Claude API with tool-calling (read-only analytics tools)
Hosting: Mac Mini → Cloudflare Tunnel → dash.617thc.com
Process mgmt: launchd (com.flowhub.node + com.flowhub.tunnel)
```

## Scaling Roadmap (Technical)

| Trigger | Action |
|---|---|
| Now | SQLite, single tenant, single server |
| 5+ users | Self-managed user profiles (password reset, admin panel) |
| Tenant #2 | Migrate SQLite → PostgreSQL (Supabase), add Row Level Security |
| Document storage needed | Cloudflare R2 for PDFs/reports |
| Hiring a frontend dev | Consider Preact or React migration |
| SaaS with 5+ tenants | Full React + Vite, managed Postgres, proper CI/CD |

## Known Issues Still Open
- **Yesterday's data gap**: if server runs through midnight without restart, `_ordMax` can skip a day. Under investigation for a permanent fix.
- **Tunnel SIGKILL**: Cloudflare tunnel occasionally dies after network drops. Manual restart required.
- **Tincture categorization**: Flowhub lists no-THC tinctures as "Accessories" for tax reasons. If THC tinctures are stocked in the future, they'll need a separate Flowhub category.

## Key Technical Decisions & Rationale
- **No React yet**: The vanilla JS + ES module split gives 70% of React's organizational benefit at 20% of the cost. React migration justified when there's a second developer or 5+ tenants.
- **SQLite over Postgres**: Zero infrastructure, single-file database, handles this volume for years. Postgres is the next step but only when multi-tenancy requires it.
- **Server-side dedup over client-side**: METRC lot dedup happens at the data layer so all consumers (dashboard, AI tools) benefit from clean data.
- **AI memory is per-user**: Built for multi-tenancy from the start even though there's currently one user. No rework needed when scaling.
