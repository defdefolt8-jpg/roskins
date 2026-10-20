# roskins

**Website on GitHub Pages:** https://defdefolt8-jpg.github.io/roskins/

Pages publishes the static storefront from `docs/`. Registration, real listings, private messages and payments require the dynamic server and are unavailable on the static storefront. Rebuild it with `node scripts/build-pages.mjs` after changing the frontend.

Russian P2P game-item classifieds with the approved charcoal/lime design.

## Implemented

- Dispatch-owned ChatGPT identity and server-owned account records.
- Supabase email/password signup and login, email verification, Google OAuth (PKCE), password recovery and secure server-only session cookies.
- See [AUTH_SETUP.md](AUTH_SETUP.md) for required provider configuration; unavailable providers are disabled in the UI until configured.
- D1-backed profiles, shared listings, favorites, buyer requests, private request messages and status transitions.
- Seller listing creation and archival; owner-only moderation.
- Owner promo-code creation, enable/disable, attribution and activation counts. One attributed code per account.
- Responsive catalog, search, sorting and a browser-local selection basket.

No payments, wallet balances, escrow, commission collection, payouts or automated Roblox transfer are implemented. Supabase email/password registration and Google OAuth are implemented in source but require runtime/provider configuration before use. Sample listings are explicitly labeled and cannot create requests. Roblox nicknames are self-reported, not ownership-verified. Deployment access policies must be configured for your own hosting environment.

## Runtime

Sites Vinext/Cloudflare Worker with `DB` D1 binding. `MARKET_ADMIN_EMAIL` is configured through native environment settings and grants admin access only after platform authentication. Never expose authentication secrets to the browser.

Schema lives in `db/schema.ts`; generated immutable migrations live in `drizzle/`.

## Validation

- `node --check public/market.js`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/api.test.cjs` — SQLite-backed API integration tests, including private-message authorization, seller/buyer transitions, CSRF checks, duplicate requests and promo attribution.
- `node tests/auth.test.cjs` — authentication route tests with a mocked Supabase provider.
- Build via the Sites build helper, or `node scripts/run-framework.mjs build` on Windows.

Live email delivery and Google OAuth still require a configured Supabase project and a deployed server. Source upload to GitHub does not deploy the website.

Use the Sites source/publishing workflow for deployment; register your own project ID and configure the access policy and DB binding.

## Public source distribution

This repository contains source code only. Production data, runtime environment values, deployment credentials, and the original Site identity are excluded. Configure `MARKET_ADMIN_EMAIL` in the hosting environment. Never commit secrets.

Google login and email verification require the setup in [AUTH_SETUP.md](AUTH_SETUP.md). Payment processing remains unimplemented. No open-source license is granted by default; choose a license before accepting third-party reuse.

## Reference item catalog

24 verified existing items: 12 Adopt Me pets, 6 Pet Simulator 99 pets and 6 Roblox avatar accessories/faces. Each uses its own locally bundled image, an item-source link and optional rarity/origin metadata. No inventory, sale availability, sellers or RUB prices are invented. Reference items and actual player listings are separate views, with pet/accessory filters and search. Provenance: [CATALOG_SOURCES.md](CATALOG_SOURCES.md).
