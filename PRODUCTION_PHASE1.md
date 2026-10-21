# Phase 1: public tenant routing and SEO

This change implements the existing public booking contracts for
`*.prakashsaas.world`. The platform remains at `prakashsaas.world`, Netlify
serves the client, and Render serves the API. No DNS record, TLS/SSL setting,
Cloudflare trigger or remote deployment is changed by the implementation.

## Public Worker contract

`edge/venue-wildcard-router/src/worker.js` is the source for the existing
`venue-wildcard-router` Worker. It accepts one validated customer label beneath
`prakashsaas.world`, using `shared/slug.js`. Apex, reserved, nested and unrelated
hosts fail closed. The apex keeps its existing platform/Netlify ingress.

The only proxied API contracts are:

| Method     | Path                                                  |
| ---------- | ----------------------------------------------------- |
| GET / HEAD | `/api/public/venues/:slug`                            |
| GET / HEAD | `/api/public/venues/:slug/halls/:hallId/availability` |
| POST       | `/api/public/venues/:slug/halls/:hallId/quote`        |
| POST       | `/api/public/venues/:slug/enquiries`                  |
| POST       | `/api/public/venues/:slug/enquiries/status`           |

Every route binds `:slug` to the hostname. Query strings and allowed JSON POST
bodies are preserved byte-for-byte. JSON bodies are limited to 256 KiB before
forwarding; Render retains its own validation and limit. Backend API statuses,
content types and response bodies are preserved, including 400, 402, 404, 409,
429 and 5xx. Network failures produce 502 and bounded upstream timeouts 504.
Requests are never automatically retried, especially enquiry POSTs.

Private `/api/auth`, `/api/venues`, `/api/admin`, webhook and arbitrary API
paths are blocked. Cookies, Authorization, caller forwarding/IP headers and
upstream Set-Cookie are not relayed through this anonymous customer gateway.
Encoded/ambiguous pathnames are rejected before the Netlify fallback, closing
the `/%61pi/...` alternate API gateway. Query encoding remains supported.

Only the customer root document, robots.txt, sitemap.xml, generic `/assets/*`
files, favicon.svg and theme-init.js are exposed outside the public API table.
Owner routes, manifest, service worker, offline document and PWA icons remain
blocked on customer origins. Redirects are manual, checked against the selected
upstream origin and rewritten to the current customer origin.

## Tenant status and SEO

Document/crawler requests first call the existing public venue-details API.
Its publication and suspension checks are authoritative; no new backend
endpoint or unscoped tenant-list API is introduced. Missing/unpublished/
suspended venues return real HTTP 404 with noindex and no generic SPA shell.
Backend 5xx remains 5xx; invalid upstream responses are 502. The fetched shell
must be valid application HTML before rendering.

Published venues receive initial escaped title, description, canonical URL,
Open Graph metadata, EventVenue JSON-LD, venue appearance and fallback content.
The canonical identity is `https://<validated-slug>.prakashsaas.world/`, derived
from fixed deployment configuration rather than a caller-supplied header.
The Worker applies a public-page CSP with a matching JSON-LD nonce. React
updates use the same shared metadata functions after loading the live data.

Each published tenant has a real text robots.txt and XML sitemap.xml containing
its canonical root only. Hidden tenant crawler resources return 404 as well.
The apex has static robots.txt and sitemap.xml for the platform root; it does
not enumerate tenant records. Add future public pages to their appropriate
sitemap only when those routes actually exist.

Public hall lookup now checks `{_id, venueId, active:true, published:true}`
before entitlement checks, so missing/foreign/hidden halls return 404. Visible
unpaid halls retain subscription enforcement. Receipt access after venue
unpublication and public information after subscription expiry retain their
existing explicitly tested policies. A published venue with no visible halls
still has a public venue-information page; no new subscription policy is added.

## Required production configuration

| Service    | Setting                             | Value / instruction                                                                                                                  |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Netlify    | Base / build / publish              | `client` / `npm run build` / `dist`                                                                                                  |
| Netlify    | `VITE_PUBLIC_VENUE_DOMAIN`          | `prakashsaas.world`                                                                                                                  |
| Netlify    | `VITE_VENUE_PLATFORM_URL`           | `https://prakashsaas.world`                                                                                                          |
| Netlify    | `VITE_VENUE_API_URL`                | `/api` (production forces same-origin routing)                                                                                       |
| Netlify    | `VITE_VENUE_GOOGLE_CLIENT_ID`       | Keep the existing correct OAuth client ID                                                                                            |
| Render     | `PUBLIC_VENUE_DOMAIN`               | `prakashsaas.world`, without scheme or `*.`                                                                                          |
| Render     | `VENUE_CORS_ALLOWED_ORIGINS`        | Preserve exact HTTPS platform origins, including `https://prakashsaas.world` and the intended Netlify origin; no wildcard owner CORS |
| Render     | Auth/payment/database variables     | Keep existing independent Venue secrets and payment-first enforcement                                                                |
| Cloudflare | Worker name                         | Existing `venue-wildcard-router`                                                                                                     |
| Cloudflare | DNS / SSL / routes / custom domains | Preserve current settings exactly                                                                                                    |

The Worker uses fixed public upstream hostnames and needs no secrets or new
bindings. `VENUE_SERVE_CLIENT=true` is not required for the Worker architecture.
Deploy shared modules with both applications; include `shared/**` in monorepo
build/watch filters. The original Clinic application is outside this change.

## Local verification

Run in the indicated directories, with Node.js 22+ for Worker tooling:

```powershell
# server
npm ci
npm test

# client
npm ci
npm test
npm run lint
npm run test:e2e
npm run build

# edge/venue-wildcard-router
npm ci
npm test
npm run test:runtime
```

The final client production build replaces the E2E build, which uses disposable
Google provider configuration. Do not publish an E2E build. Browser tests use
disposable local APIs and real production-built frontend code under mapped
customer hostnames. Worker unit tests use injected fetch; the separate runtime
suite runs the bundled module in workerd, with all upstream traffic stubbed.
These are not claims of live Google consent, live Razorpay capture or a deployed
Cloudflare smoke test.

Final local results on 2026-10-21:

| Check                                                                                      | Actual result                   |
| ------------------------------------------------------------------------------------------ | ------------------------------- |
| Backend suite, including existing auth/payment/isolation tests                             | 82 passed                       |
| Frontend unit/configuration tests                                                          | 42 passed                       |
| Full Playwright suite, including real owner service-worker tests and new tenant-host flows | 23 passed                       |
| Worker route/security/SEO regression tests                                                 | 31 passed                       |
| Bundled Worker in local workerd / Miniflare                                                | 5 passed                        |
| Client lint and production build                                                           | Passed                          |
| Wrangler dry-run production bundle                                                         | Passed; no upload or deployment |

The new backend fixture initially omitted its required timezone; that fixture
was corrected before the final passing backend run. Browser expectations now
allow intentional metadata refreshes after mutations. Runtime validation also
verified a handler-only production entry module, beyond Node unit-test imports.

## Manual deployment: preserve existing triggers

No production upload, promotion or configuration command has been run.

1. Record the current Render/Netlify deployment identifiers and Cloudflare
   Worker version. In Cloudflare, record the existing wildcard route bindings,
   DNS records, SSL mode, workers.dev/preview settings and any environment
   variables. Keep the apex route separate from this customer-only Worker.
   Check for a legacy `cdn` venue record and resolve its explicit migration
   before rollout if one exists; it is reserved by the shared policy now.
2. Deploy the reviewed repository revision to **Render** using its existing
   build/start configuration, with `server` and `shared` files present. Confirm
   `https://venue-booking-saas.onrender.com/api/health` returns JSON 200.
3. Deploy the same revision to **Netlify**, with the production variables above.
   Publish the whole production `client/dist`, including `_headers`, `_redirects`,
   robots.txt and sitemap.xml. Confirm `https://prakashsaas.world/api/health`
   returns backend JSON and owner password/Google sign-in still works.
4. In `edge/venue-wildcard-router`, run `npm ci`, `npm test` and
   `npm run test:runtime`. Authenticate the manual operator with `npx wrangler
login` if required. Check the account and existing worker before uploading:

   ```powershell
   npx wrangler whoami
   npx wrangler versions list --name venue-wildcard-router
   npx wrangler versions upload --name venue-wildcard-router --keep-vars --message "Phase 1 public booking and SEO"
   ```

   Save the returned new version ID. Uploading a version does **not** send
   production traffic to it. This workflow leaves existing route/DNS/SSL
   configuration in place; no `routes`, custom domain or trigger change is
   declared. Do not use ordinary `wrangler deploy` or `wrangler triggers deploy`
   for this rollout. [Cloudflare version/deployment documentation](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

5. Manually promote that reviewed version on the existing Worker:

   ```powershell
   npx wrangler versions deploy "<NEW_VERSION_ID>@100%" --name venue-wildcard-router --message "Phase 1 public booking and SEO"
   ```

   Verify the Worker’s existing triggers, DNS and SSL settings are unchanged.
   Keep production workers.dev/preview settings as recorded; this config does
   not attempt to manage them.

6. Smoke-test two real published venue hostnames. View source without JavaScript:
   each root must return 200 with its own title, canonical, OG and JSON-LD.
   Check tenant robots.txt and sitemap.xml. Verify missing, reserved and a
   controlled unpublished venue return document 404, not an app-shell 200.
   Check a cross-tenant API request, `/api/auth/me`, `/%61pi/health`, `/sw.js`
   and `/manifest.webmanifest` all return 404 on customer hosts.
7. On a controlled paid test hall, test quote, availability, enquiry creation
   and receipt refresh, checking the POST body, same-origin API URL, status and
   JSON content type. Do not create test bookings or charges for real customers.
   Verify an unpaid hall still cannot enter management, and owner PWA behavior
   remains on the platform host only.

For rollback, promote the recorded previous Worker version using the same
`versions deploy "<PREVIOUS_VERSION_ID>@100%"` command, and restore the previous
Netlify/Render revision if required. No DNS/SSL changes are needed.

## Remaining risks and deliberate limits

- Live Cloudflare route/SSL behavior, Google consent, payment capture and
  physical-device install behavior require the manual post-deployment checks.
- Rate-limit proxy identity and a shared multi-instance store remain separate
  audit work. Do not blindly increment trust-proxy hops or trust client IP
  headers; verify the actual Worker/Netlify/Render ingress chains first.
- Logout revocation, atomic account suspension, platform HTML framing/CSP,
  resource quotas and transactional-email workflow wiring remain later audit
  work. Phase 1 does not change authentication or payment verification.
- The original Worker reserved `cdn` while registration did not. It is now
  reserved in the shared policy, so new unreachable tenants cannot register it.
  If a legacy `cdn` record exists, review/migrate it explicitly; no record is
  renamed or deleted automatically.
- Document/metadata traffic is deliberately uncached for current visibility.
  Every page request calls Render, so its latency and availability matter.
  Generic assets also retain the conservative no-store policy for this phase.
- Per-tenant sitemaps contain only existing public root pages. There is no
  global tenant-directory endpoint, sitemap index or invented public hall page.

## Modified files

Worker source/tooling/tests:

- `edge/venue-wildcard-router/src/worker.js`
- `edge/venue-wildcard-router/src/index.js`
- `edge/venue-wildcard-router/.gitignore`
- `edge/venue-wildcard-router/wrangler.jsonc`
- `edge/venue-wildcard-router/package.json`
- `edge/venue-wildcard-router/package-lock.json`
- `edge/venue-wildcard-router/tests/worker.test.js`
- `edge/venue-wildcard-router/tests/runtime-smoke.mjs`
- `edge/venue-wildcard-router/README.md`

Shared tenant/SEO policy:

- `shared/slug.js`
- `shared/tenantHost.js`
- `shared/venueMetadata.js`

Backend:

- `server/routes/publicVenueRoutes.js`
- `server/services/publicVenueService.js`
- `server/services/seoService.js`
- `server/services/venueMetadataService.js`
- `server/tests/integration.test.js`
- `server/tests/venueMetadata.test.js`

Frontend, public SEO files and regression coverage:

- `client/.env.example`
- `client/src/App.jsx`
- `client/src/main.jsx`
- `client/src/context/AuthContext.jsx`
- `client/src/utils/venueDomain.js`
- `client/src/features/public-venue/hooks/useVenueMetadata.js`
- `client/public/_headers`
- `client/public/_redirects`
- `client/public/robots.txt`
- `client/public/sitemap.xml`
- `client/vite.config.js`
- `client/tests/tenantHost.test.js`
- `client/tests/publicSeo.test.js`
- `client/e2e/tenancy.spec.js`
- `client/e2e/pwa.spec.js`

This guide is `PRODUCTION_PHASE1.md`. Build outputs, dependencies and browser
artifacts are ignored and are not source changes.
