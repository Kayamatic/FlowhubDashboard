# Business Context — Grasshopper / Kayamatic

> **Purpose**: This file bridges the Claude Chat (strategy) thread and Claude Code (implementation) thread. Update it when strategic decisions are made that should influence how code is built.

---

## Product Vision
Clyde is a vertical AI-native analytics platform for cannabis retail operators. It connects to dispensary POS systems via API, stores transaction history in a local SQLite database, and exposes a natural language AI chat interface backed by 22+ live analytics tools. The AI can answer operational questions no canned dashboard can — margins by product, lapsed customer patterns, basket trends, product affinity — using real-time data.

Near-term: single-tenant, operator-installed, Flowhub-first with Dutchie port in progress.

Medium-term: multi-tenant SaaS or white-label product licensed through POS platforms.

Likely exit path: strategic acquisition by Flowhub, Dutchie, or a cannabis tech roll-up rather than independent SaaS build. Founder is 62 with a finite runway — a meaningful exit or recurring income within 2-3 years is the priority over long-term company building.

---

## Target Customer
Primary: Multi-location independent cannabis operators (3-10 locations). They feel the analytics gap most acutely, have budget, and aren't large enough to build internally.

Secondary: Single-location independent operators who are analytically sophisticated and margin-conscious.

Avoid for now: MSOs (multi-state operators) — have procurement processes and will build internally.

POS platforms: Flowhub first, Dutchie second. Together they cover a significant share of the ~15,000 US dispensaries.

Core pain point: Operators are running on spreadsheets and gut instinct. Flowhub and Dutchie have basic analytics but nothing customizable or conversational. Cannabis operators face uniquely severe margin pressure from 280E federal tax treatment — any tool that surfaces margin insights has immediate ROI.

---

## Pricing / Revenue Model
Not yet validated — no external paying users yet. Working assumptions:

- Per-location monthly subscription: $150–$200/month per location
- BYOK (Bring Your Own Anthropic Key) model keeps AI costs off the product's P&L, or absorb AI costs (~$10–30/month per location) and price accordingly
- White-glove setup for early customers: charge $200–500 one-time setup fee while learning what customers actually need
- Do not build self-serve onboarding until manually onboarded at least 5 customers

---

## Competitive Positioning
- Flowhub and Dutchie have native analytics but they are rigid, non-conversational, and not customizable
- Generic BI tools (Tableau, Looker) require data engineering work most operators can't do
- The AI chat layer is the core differentiator — operators can ask questions in plain English and get answers backed by live data
- Multi-POS support (Flowhub + Dutchie) creates a moat no single POS platform can replicate — they won't build analytics for a competitor's data
- Cross-operator benchmarking is the long-term moat: "your basket size is 12% below comparable stores in your market" — only possible with multi-tenant data network effects

---

## Current Priorities (ordered)
1. Get first external user on the Flowhub version — even free/informal — to validate product-market fit
2. Secure Dutchie API access from colleague beta tester to begin Dutchie port
3. Move production deployment off MacBook Air to dedicated always-on hardware (used Mac Mini ~$200, self-funded, owned personally by founder)
4. Resolve known reliability issues: yesterday's data gap bug, Cloudflare tunnel SIGKILL on network drops
5. Advance Flowhub CEO/partnerships conversation — nudge if no response within 5-7 business days
6. Formalize JV structure (Kayamatic LLC) with attorney when finances allow

---

## Key Constraints
- **Financial**: Founder is living paycheck to paycheck — no capital for significant infrastructure or legal spend right now
- **Legal**: IP was built on company resources under an employee handbook with clear IP assignment clause — JV structure (Kayamatic LLC) is the negotiated resolution, currently informal
- **Timeline**: 18-24 month window before POS platforms replicate this natively — speed matters
- **Single developer**: Founder built everything with AI assistance, no engineering team
- **Regulatory**: Cannabis data is sensitive — federal/state compliance overlap means customer data handling needs care, especially at multi-tenant scale
- **Hardware**: Currently running on a personal MacBook Air via Cloudflare Tunnel — not reliable enough for paying customers

---

## Multi-Tenant / Scaling Decisions
- SQLite now (single tenant, ~260MB, 165,000+ orders back to 2020)
- PostgreSQL via Supabase when tenant #2 onboards — add Row Level Security
- Cloudflare R2 for document/PDF storage when needed
- No React until second developer or 5+ tenants
- Dedicated Mac Mini (self-owned) as next infrastructure step
- Full React + Vite + managed Postgres + CI/CD at SaaS scale with 5+ tenants

---

## Brand / Naming
- Product name: **Clyde** ("Dig Deeper" — named after founder's dog)
- Company: **Kayamatic LLC** (joint venture — not yet formally filed)
- JV parties: Hewson Group LLC (founder's personal entity) + 617 Therapeutic Holding Company LLC (employer)
- Current domain: `dash.617thc.com` — needs to migrate to Clyde/Kayamatic branded domain when JV is formalized
- Domain notes: Clyde.ai was prohibitively expensive. Alternatives to evaluate: tryClyde.com, heyClyde.com, askClyde.com, clydeanalytics.com, clyde.so
- Prior names considered and discarded: CannalQ, Grasshopper

---

## Corporate / Ownership Context
- Founder is an employee of 617 Therapeutic Holding Company LLC
- Product was built on company resources — IP assignment clause in employee handbook applies
- Owner 1 (majority votes): enthusiastic, informally endorsed JV with founder retaining control, target split 70/30 to 80/20 in founder's favor
- Owner 2 (investor influence): amenable to JV discussion, unhurried, requires careful handling — present as operational win not commercial pitch
- Formal JV agreement not yet in place — attorney consult is a priority when financially feasible
- Founder's spouse is a business partner in Hewson Group LLC — not surfaced with current owners

---

## Key External Relationships
- **Flowhub CEO**: Direct text relationship, responded "This is very cool" — awaiting follow-up on partnership pathways and roadmap conflict question
- **Dutchie colleague**: Has offered API access for beta testing — not yet responded to specific request
- **Flowhub**: Primary POS platform, potential acquirer or distribution partner
- **Dutchie**: Largest cannabis POS platform by market share, target for port #2

---

## Notes from Chat Thread
Product-market fit not yet established — no external users have tested it. All validation to date is internal (founder's own business) plus CEO-level signal from Flowhub. The Dutchie beta testers are the critical next validation step. Everything else — JV formalization, Flowhub partnership, investor materials — moves faster from a stronger position once one real external user confirms value.
