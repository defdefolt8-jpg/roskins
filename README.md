# roskins

Russian P2P game-item classifieds with the approved charcoal/lime design.

## Implemented

- Dispatch-owned ChatGPT identity and server-owned account records.
- D1-backed profiles, shared listings, favorites, buyer requests, private request messages and status transitions.
- Seller listing creation and archival; owner-only moderation.
- Owner promo-code creation, enable/disable, attribution and activation counts. One attributed code per account.
- Responsive catalog, search, sorting and a browser-local selection basket.

No payments, wallet balances, escrow, commission collection, payouts, automated Roblox transfer or independent Google/email identity are implemented. Sample listings are explicitly labeled and cannot create requests. Roblox nicknames are self-reported, not ownership-verified. Deployment access policies must be configured for your own hosting environment.

## Runtime

Sites Vinext/Cloudflare Worker with `DB` D1 binding. `MARKET_ADMIN_EMAIL` is configured through native environment settings and grants admin access only after platform authentication. Never expose authentication secrets to the browser.

Schema lives in `db/schema.ts`; generated immutable migrations live in `drizzle/`.

## Validation

- `node --check public/market.js`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/api.test.cjs` — SQLite-backed API integration tests, including private-message authorization, seller/buyer transitions, CSRF checks, duplicate requests and promo attribution.
- Build via the Sites build helper.

Use the Sites source/publishing workflow for deployment; register your own project ID and configure the access policy and DB binding.

## Public source distribution

This repository contains source code only. Production data, runtime environment values, deployment credentials, and the original Site identity are excluded. Configure `MARKET_ADMIN_EMAIL` in the hosting environment. Never commit secrets.

Google login/email verification and payment processing remain unimplemented. No open-source license is granted by default; choose a license before accepting third-party reuse.
