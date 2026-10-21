# Production SEO: platform and public venues

This guide describes the versioned implementation and the manual production
rollout. No production deployment, DNS record, SSL setting or Cloudflare route
has been changed. Technical SEO makes pages accessible and understandable;
it does not guarantee indexing, rich results or rankings.

This supersedes the static apex sitemap and basic metadata description in
[PRODUCTION_PHASE1.md](./PRODUCTION_PHASE1.md). Its authentication, payment,
tenant-isolation and manual Worker version-promotion precautions still apply.

## Delivery and indexing contract

| Request                                                                 | Delivery and expected behavior                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://prakashsaas.world/`                                            | Netlify Edge renders initial platform metadata, marketing content, Organization and SoftwareApplication JSON-LD; canonical platform root, HTTP 200.                                                                         |
| `https://<slug>.prakashsaas.world/`                                     | The existing customer-only Cloudflare Worker checks the existing public venue API before rendering venue HTML. Published, unsuspended venues return 200. Missing, unpublished and suspended venues return 404 with noindex. |
| Tenant backend failure                                                  | Preserve backend 5xx; network/protocol failures return 502 and bounded timeouts 504. An outage is never converted to an indexable empty page or a false tenant 404.                                                         |
| `https://prakashsaas.world/v/<slug>`                                    | Netlify Edge checks public visibility, then redirects a published venue to its HTTPS canonical tenant root with 301. Hidden/missing venues remain 404; backend failures remain 5xx.                                         |
| Netlify/local `/v/<slug>` previews                                      | Preview UI remains available. It receives noindex and no canonical claiming publication.                                                                                                                                    |
| Netlify alias and deploy previews                                       | Noindex; no production canonical or platform JSON-LD is advertised for the alias itself. These are not sitemap URLs.                                                                                                        |
| Platform private/authentication pages                                   | Noindex. Normal authentication, cookies, payment checks and same-origin `/api` routing remain in place.                                                                                                                     |
| Invalid/reserved/nested customer host or unknown customer document path | Real 404, noindex. The Worker never sends arbitrary document paths to Netlify's SPA/API rewrite.                                                                                                                            |

Tenant HTML is rendered for ordinary users and crawlers through the same code,
without user-agent-specific content. Its canonical URL is always the validated
root `https://<slug>.prakashsaas.world/`, never a forwarded Host header. Browser
metadata updates use the same shared metadata functions; initial HTML is useful
before JavaScript runs. Public documents and visibility-dependent crawler
responses are not cached, so publishing, unpublishing and suspension take effect
on subsequent requests. Search-engine recrawling and index removal are separate
processes and are not immediate promises.

The owner PWA remains a platform application. Customer hosts do not advertise
its manifest or register its service worker. Owner/auth/admin/API routes and
PWA resources remain excluded from the customer gateway.

## Public booking contracts preserved

The Worker exposes only these existing backend routes for the hostname's slug:

| Method     | Path                                                  |
| ---------- | ----------------------------------------------------- |
| GET / HEAD | `/api/public/venues/:slug`                            |
| GET / HEAD | `/api/public/venues/:slug/halls/:hallId/availability` |
| POST       | `/api/public/venues/:slug/halls/:hallId/quote`        |
| POST       | `/api/public/venues/:slug/enquiries`                  |
| POST       | `/api/public/venues/:slug/enquiries/status`           |

Allowed JSON POST bodies and query strings are preserved. Backend validation,
payment eligibility, status codes, response bodies and content types remain
authoritative. There is a 256 KiB edge JSON-body limit. Customer requests do not
forward owner cookies, Authorization or caller-supplied forwarding/IP headers;
Set-Cookie is removed from public responses. A tenant cannot request another
tenant's path. Encoded/ambiguous pathnames cannot bypass the allowlist through
Netlify. Receipt access after unpublication retains its existing capability-based
backend policy; document discoverability does not override receipt authorization.

## Metadata and truthful structured data

`shared/venueMetadata.js` generates title, bounded description, absolute
canonical, Open Graph, Twitter Card and JSON-LD. Titles use the actual stored
venue name and city/type where available. Descriptions identify the venue and
use its saved tagline/description rather than invented local claims. Social
images use a safe public HTTPS cover or visible gallery image when available.
There is no fabricated fallback venue photograph.

Previous platform/venue metadata and JSON-LD are removed before insertion,
including the platform's initial marketing fallback. HTML values are escaped;
inline JSON protects against closing-script injection and problematic Unicode.
The public-page CSP receives the JSON-LD nonce.

Structured-data rules:

- `EventVenue` identifies the place. Explicit `hotel` and `resort` records also
  use `Hotel` or `Resort`; the supported commercial hall categories additionally
  use `LocalBusiness`. Other/unknown types remain `EventVenue`. Names and visual
  templates do not imply a hotel, star classification or other business type.
- Only stored, public business fields are included. Hidden contact/gallery
  sections do not leak their street address, phone, email, hours or gallery
  pictures into structured data. A public cover image may still be used.
- The model has no country or verified geographic-coordinate fields. Country
  and geo are omitted; neither `IN` nor coordinates are inferred from a city,
  timezone, map URL or platform location.
- The existing opening-hours field is owner-entered text. Only valid compact
  Schema.org day/time notation such as `Mo-Fr 09:00-18:00` is serialized. Free
  prose remains visible on the page without being guessed into a schedule.
- Ratings, reviews, prices, star ratings, offers and live availability are not
  invented or copied from subscription pricing. Owner-provided information
  remains the owner's responsibility to verify and maintain.

Validate generic vocabulary with the [Schema Markup Validator](https://validator.schema.org/)
and feature eligibility with [Google's Rich Results Test](https://search.google.com/test/rich-results).
Passing JSON syntax tests does not assert that every venue satisfies the
requirements of a Google rich-result feature. Some generic Schema.org types
have no dedicated Google rich-result presentation. See Google's
[testing guidance](https://developers.google.com/search/docs/appearance/structured-data)
and [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Robots and sitemaps

| Public URL                                                             | Contents                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://prakashsaas.world/robots.txt`                                 | Platform crawl rules and the absolute sitemap-index URL. Private routes are excluded from discovery.                                         |
| `https://prakashsaas.world/sitemap.xml`                                | Dynamic sitemap index.                                                                                                                       |
| `https://prakashsaas.world/sitemaps/platform.xml`                      | The one actual public platform root. Feature links point to useful homepage sections; there are no synthetic city, feature or pricing pages. |
| `https://prakashsaas.world/sitemaps/venues-1.xml`, `venues-2.xml`, ... | Up to 1,000 currently published, unsuspended, valid canonical venue roots per shard.                                                         |
| `https://<slug>.prakashsaas.world/robots.txt`                          | Customer-host crawl rules and its own absolute sitemap URL, after visibility checks.                                                         |
| `https://<slug>.prakashsaas.world/sitemap.xml`                         | The published tenant's canonical root only. Hidden/unknown venues return 404 here too.                                                       |

The backend implements read-only discovery through
`/api/public/seo/sitemap-index.xml` and `/api/public/seo/venues-N.xml`. Netlify
Edge exposes their XML under the canonical platform URLs above. Only slugs
enter the sitemap output; owner/customer/booking/payment information does not.
Invalid/reserved legacy slugs and unpublished/suspended records are filtered
before counting and pagination. Out-of-range shards return 404. Database
failures remain errors rather than successful empty sitemaps. No fabricated
`lastmod`, priority or change frequency is emitted.

Platform robots.txt deliberately allows crawlers to fetch owner/authentication
HTML so they can read its noindex directive; blocking those documents in robots
would prevent that check. They are absent from sitemaps and remain protected by
normal authentication. `/api/` is disallowed for crawling. Robots directives are
crawler guidance, not an authorization boundary.

Submit the canonical index in Search Console. Its venue URLs span subdomains,
so verify the parent Domain property and use Google's cross-site sitemap
submission rules rather than assuming apex robots alone grants ownership of
every listed host. Per-tenant sitemaps remain independently available. Google
documents [absolute canonical URLs, sitemap limits and cross-site submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Performance and mobile behavior

Public code remains split into lazy routes/templates. Unsigned Cloudinary
images receive bounded responsive widths and srcset candidates. Signed,
pre-transformed and other-provider images retain their original URLs. The hero
uses high fetch priority and eager loading, with a matching initial-HTML
responsive preload; below-the-fold gallery/hall pictures remain lazy. An image
transform failure falls back to its original without an infinite retry loop.
Existing layout rules reserve visual space. This implementation does not add
an external font-download dependency.

Automated mobile checks cover resource behavior, accessibility/layout and
performance budgets under the documented local fixture. They are regression
guards, not production Core Web Vitals measurements. After deployment, use
real mobile devices, PageSpeed Insights and Search Console's available field
data to assess actual LCP, CLS and INP. Slow Render responses and oversized
owner photographs can still dominate real loading time.

Netlify Edge bounds both backend reads and complete frontend HTML continuation/
body consumption with a 10-second deadline. A slow or stalled shell produces
an appropriate 5xx instead of hanging or serving an indexable incomplete page.

## Configuration and manual rollout

Required production settings remain:

| Service          | Configuration                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render           | `PUBLIC_VENUE_DOMAIN=prakashsaas.world`; preserve database, auth, payment, CORS and cookie settings. Deploy both `server/**` and `shared/**`.                                                |
| Netlify          | Repository-root `netlify.toml`; base `.`, build `npm --prefix client ci && npm --prefix client run build`, publish `client/dist`, edge directory `client/netlify/edge-functions`.            |
| Netlify frontend | `VITE_PUBLIC_VENUE_DOMAIN=prakashsaas.world`, `VITE_VENUE_PLATFORM_URL=https://prakashsaas.world`, `VITE_VENUE_API_URL=/api`; retain the correct Google client ID.                           |
| Cloudflare       | Existing `venue-wildcard-router` and current wildcard bindings. `wrangler.jsonc` intentionally declares no routes/custom domains. Preserve DNS, SSL, triggers and recorded preview settings. |

`VITE_*` values are build-time configuration. Include root `shared/**`,
`netlify.toml` and Netlify Edge source in monorepo watch/build inputs. Do not
publish an E2E build with disposable Google-provider settings.

Netlify's build base must be the repository root, not `client`. The Edge
bundler uses that base as its module root and must include `shared/**` imported
by the function. A client-only base can pass Vite while failing Edge packaging.
The checked-in command installs the existing client lockfile and builds that
application explicitly; it does not introduce a root package or workspace.

Deployment is manual and ordered:

1. Record the current Render and Netlify deploy IDs and Cloudflare Worker
   version, triggers, DNS and SSL settings. Confirm two controlled published
   test venues and a controlled unpublished venue are available. Review any
   legacy venue whose slug is now reserved, including `cdn`; no data is renamed
   automatically.
2. Deploy the reviewed revision to **Render** using its existing configuration.
   Verify `/api/health`, `/api/public/seo/sitemap-index.xml` and an existing
   `/api/public/seo/venues-1.xml` return the expected JSON/XML. With no published
   venues, the index contains the platform shard and a venue shard correctly
   returns 404.
3. Deploy the same revision through a **full Netlify repository build** and
   publish that reviewed production deployment. Confirm its resolved settings
   are base `.`, the exact prefixed install/build command above, publish
   `client/dist` and Edge source `client/netlify/edge-functions`. Remove any
   obsolete client-only base override in the site's build settings. Confirm the
   `platform-seo` Edge Function is packaged and active, along with the built
   client, `_headers` and `_redirects`. Uploading only `dist` through a static
   drag-and-drop deploy is insufficient: it omits the Edge Function needed for
   platform HTML, dynamic sitemaps and production preview redirects. Retain
   existing domain bindings and platform API proxy. Netlify supports atomic
   full-site Edge Function deployment through its Git/build workflow or a
   properly configured CLI build/deploy; see the [deployment documentation](https://docs.netlify.com/build/edge-functions/get-started/).
4. In `edge/venue-wildcard-router`, run the existing locked tooling and inspect
   the account/version before manually uploading:

   ```powershell
   npm ci
   npm test
   npm run test:runtime
   npx wrangler whoami
   npx wrangler versions list --name venue-wildcard-router
   npx wrangler versions upload --name venue-wildcard-router --keep-vars --message "Platform and venue SEO"
   ```

   Use `npx wrangler login` if the operator is not authenticated. Record the
   returned version ID. Uploading the version does not send production traffic
   to it. Do not use ordinary `wrangler deploy` or `wrangler triggers deploy`;
   the local build script's `deploy --dry-run` only creates a local bundle.

5. After review, manually promote the uploaded version on the existing Worker:

   ```powershell
   npx wrangler versions deploy "<NEW_VERSION_ID>@100%" --name venue-wildcard-router --message "Platform and venue SEO"
   ```

   Confirm recorded DNS/SSL/triggers remain unchanged. See Cloudflare's
   [version promotion documentation](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

6. Run the smoke checks below and a controlled public booking flow. Confirm
   owner password/Google login and payment-first hall access still work on the
   platform, and no owner PWA is advertised on customer hosts.

Rollback uses the recorded previous Worker version:

```powershell
npx wrangler versions deploy "<PREVIOUS_VERSION_ID>@100%" --name venue-wildcard-router --message "Rollback SEO release"
```

Restore the recorded Netlify/Render revisions if needed. Keep all three layers
compatible during rollback. No DNS or SSL change is required.

## Production smoke tests with curl

Run these manually after deployment. Use actual controlled venue slugs and a
public test hall. In PowerShell, `curl.exe` avoids the `curl` command alias.
The examples below do not create enquiries, bookings or payment charges.

```powershell
$venueA = "REPLACE-WITH-PUBLISHED-SLUG-A"
$venueB = "REPLACE-WITH-PUBLISHED-SLUG-B"
$hiddenVenue = "REPLACE-WITH-CONTROLLED-UNPUBLISHED-SLUG"
$hallId = "REPLACE-WITH-24-HEX-PUBLIC-TEST-HALL-ID"

curl.exe -sS -D - https://prakashsaas.world/
curl.exe -sS -D - https://prakashsaas.world/robots.txt
curl.exe -sS -D - https://prakashsaas.world/sitemap.xml
curl.exe -sS -D - https://prakashsaas.world/sitemaps/platform.xml
curl.exe -sS -D - https://prakashsaas.world/sitemaps/venues-1.xml
curl.exe -sS -D - "https://$venueA.prakashsaas.world/"
curl.exe -sS -D - "https://$venueB.prakashsaas.world/"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/robots.txt"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/sitemap.xml"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/api/public/venues/$venueA"

# No -L: inspect the canonical redirect itself and its destination.
curl.exe -sS -D - "https://prakashsaas.world/v/$venueA"
curl.exe -sS -D - "https://venue-booking-saas.netlify.app/v/$venueA"

# Fail closed: each customer request below must return 404 and noindex.
curl.exe -sS -D - "https://$hiddenVenue.prakashsaas.world/"
curl.exe -sS -D - https://nonexistent-seo-smoke-20261021.prakashsaas.world/
curl.exe -sS -D - https://admin.prakashsaas.world/
curl.exe -sS -D - "https://$venueA.prakashsaas.world/api/public/venues/$venueB"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/api/auth/me"
curl.exe --path-as-is -sS -D - "https://$venueA.prakashsaas.world/%61pi/health"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/sw.js"
curl.exe -sS -D - "https://$venueA.prakashsaas.world/manifest.webmanifest"
```

For each successful HTML document, inspect source for exactly one current title,
description, canonical and venue/platform JSON-LD set. The two tenant pages must
have distinct identities; their source must not retain platform marketing HTML
or Organization/SoftwareApplication data. API responses must be JSON; sitemap
responses XML; robots responses plain text. A hidden tenant must also disappear
from the current sitemap shard. A published tenant root with tracking query
parameters still canonicalizes to its clean root.

Read-only quote/availability examples require a real configured model and a
future interval interpreted in the venue's timezone. Save this JSON to a local
`quote-smoke.json`, replacing the dates/model with a valid controlled test case:

```json
{ "model": "FULL_DAY", "startAt": "2027-02-04T00:00", "endAt": "2027-02-05T00:00" }
```

```powershell
curl.exe -sS -D - -H "Content-Type: application/json" --data-binary "@quote-smoke.json" "https://$venueA.prakashsaas.world/api/public/venues/$venueA/halls/$hallId/quote"
curl.exe -sS -D - --get --data-urlencode "startAt=2027-02-04T00:00" --data-urlencode "endAt=2027-02-05T00:00" "https://$venueA.prakashsaas.world/api/public/venues/$venueA/halls/$hallId/availability"
```

On a controlled paid test venue, additionally submit one test enquiry through
the UI and refresh its issued receipt. Verify 201 JSON, payload/timezone/quote
preservation and same-host API routing. Receipt tokens belong in POST bodies,
never URL/query strings or public logs. Do not replay a real customer's enquiry
to test forwarding. Exercise backend outage behavior in staging or the existing
stubbed regression/runtime tests; do not interrupt production Render to test it.

## Google Search Console setup and indexing verification

1. In [Search Console](https://search.google.com/search-console), add the
   **Domain** property `prakashsaas.world` without scheme, path or wildcard.
   Reuse an already verified property where present. A Domain property covers
   the apex, subdomains and protocol variants; see [Google's property guide](https://support.google.com/webmasters/answer/34592).
2. If ownership is not verified, copy the exact DNS verification value Google
   supplies and have the authorized DNS operator add its TXT record. Retain
   existing A/AAAA/CNAME records, wildcard routing, SSL and Worker bindings.
   This implementation performs no DNS edits. Keep the verification record
   after verification so ownership remains valid; follow [Google's verification instructions](https://support.google.com/webmasters/answer/9008080).
3. Submit `https://prakashsaas.world/sitemap.xml` through the property's Sitemaps
   report. Inspect the fetched index and every referenced shard for successful
   fetches and eligible URLs. Do not submit the Netlify/Render aliases, `/v/`
   previews, login pages or private workspaces. Authorized child URL-prefix
   properties can separate per-venue reporting; delegate only that venue's
   property to its owner, not platform-wide access.
4. Use URL Inspection's live test for the platform and two published tenant
   roots. Inspect returned HTML, HTTP status, crawlability, resources and
   canonical. After processing, compare the user-declared canonical with
   Google's selected canonical. An initial live test is not proof of indexing.
5. Validate both actual tenant URLs using Rich Results Test and Schema Markup
   Validator. Resolve factual errors at the venue source. Never fill missing
   facts with fabricated ratings, contact details or coordinates to silence a
   tool warning.
6. Inspect a controlled unpublished tenant: 404/noindex and absent from all
   newly fetched sitemap shards. Monitor Page indexing, sitemap-fetch errors,
   security/manual-action reports and available Core Web Vitals field data.
   Request indexing for selected useful published pages after the checks pass;
   it is a request, not a ranking or indexing guarantee.

## Manual tasks for venue owners

- Verify and maintain the real venue name, category, full stored address,
  public telephone/email and map link. Keep these consistent with their actual
  business and authorized Google Business Profile. The platform does not
  verify legal business identity merely because Google owner login succeeded.
- Write useful original venue descriptions, actual facilities/services,
  visitor guidance and policies. Avoid copied city paragraphs, unsupported
  superlatives and keyword lists. Publish only information intended for guests.
- Upload genuine, relevant, appropriately compressed cover/gallery photos and
  descriptive alternative text. Check how the cover crops on a small screen.
- Keep visiting hours accurate. Supported compact weekly notation enables
  structured hours; ordinary prose remains visible without inferred hours.
- Confirm visible hall names, capacity and booking information are accurate.
  Test quote/enquiry/contact actions on mobile after meaningful changes.
- Maintain and verify the venue's own eligible Google Business Profile, using
  its canonical tenant URL. Review actual contact/map/photo accuracy there.
- Coordinate publishing/unpublishing with the platform operator and inspect
  current HTTP responses and sitemap membership after changes. Search engines
  can take time to process removals and updates.

Country, verified coordinates and more expressive structured schedules require
a separately reviewed model/editor addition before they can enter JSON-LD.
This release does not invent those fields or promise a local-business rich
result for incomplete business information.

## Implementation map and remaining limits

- `edge/venue-wildcard-router/src/worker.js`: customer gateway, authoritative
  visibility, HTTP semantics, tenant crawler files and initial venue HTML.
- `shared/venueMetadata.js`, `shared/venueImages.js`, `shared/platformSeo.js`:
  shared escaped metadata/content, factual schema and responsive image policy.
- `client/netlify/edge-functions/platform-seo.js`, `netlify.toml`: platform
  rendering, previews/redirects and canonical discovery resources.
- `server/routes/seoRoutes.js`, `server/services/sitemapService.js`: read-only
  current public venue discovery, bounded pagination and XML output.
- Public React metadata, route metadata, venue templates, image components and
  landing page preserve browser navigation, accessibility and PWA isolation.
- Unit, HTTP, browser and local workerd regression suites cover identities,
  visibility, serialization, sitemap/robots semantics, booking compatibility,
  outage handling and mobile behavior. Final actual results are recorded below
  by the release operator after all checks finish.

Remaining operational limits: live deployment configuration and crawler fetches
must be verified after rollout; production Core Web Vitals need actual traffic;
Render document latency is still on the critical path; business facts require
owner maintenance. The audit's separate authentication/session revocation,
proxy-aware/shared rate limiting, quotas and transactional-notification work
remain outside this SEO release. Authentication and payment verification were
not relaxed. The original Clinic application is outside this repository change.

An existing owner-editor refresh gap also remains: immediately reopening a hall
after saving can briefly use the prior card data while its refresh is pending.
The browser regression now waits for the persisted price and photograph before
reopening. This SEO release does not change that editor's data-loading behavior.

## Changed-file manifest

The workspace was clean at the start of this SEO release. The following source
and configuration files were added or modified; generated bundles, dependency
caches and browser artifacts are excluded.

Production deployment/build configuration:

- `.gitignore`
- `netlify.toml`
- `client/eslint.config.js`
- `client/vite.config.js`
- `client/build/platformSeo.js`

Shared metadata, image and tenant policy:

- `shared/package.json`
- `shared/platformSeo.js`
- `shared/slug.js`
- `shared/tenantHost.js`
- `shared/venueImages.js`
- `shared/venueMetadata.js`

Cloudflare Worker production source:

- `edge/venue-wildcard-router/src/worker.js`

Frontend and Netlify Edge production source:

- `client/index.html`
- `client/public/robots.txt`
- `client/netlify/edge-functions/platform-seo.js`
- `client/src/App.jsx`
- `client/src/components/RouteSeo.jsx`
- `client/src/components/venue/shared/GallerySection.jsx`
- `client/src/components/venue/shared/HallsSection.jsx`
- `client/src/components/venue/shared/VenueHero.jsx`
- `client/src/components/venue/shared/VenueImage.jsx`
- `client/src/components/venue/shared/websiteData.js`
- `client/src/features/public-venue/hooks/useVenueMetadata.js`
- `client/src/pages/LandingPage.jsx`
- `client/src/pages/PublicVenuePage.jsx`

Backend production source:

- `server/app.js`
- `server/models/venue/venueModels.js`
- `server/routes/seoRoutes.js`
- `server/services/seoService.js`
- `server/services/sitemapService.js`

Regression tests:

- `client/e2e/seo-performance.spec.js`
- `client/e2e/seo.spec.js`
- `client/e2e/venue.spec.js`
- `client/tests/platformEdge.test.js`
- `client/tests/platformSeo.test.js`
- `client/tests/publicSeo.test.js`
- `client/tests/tenantHost.test.js`
- `client/tests/websiteImages.test.js`
- `edge/venue-wildcard-router/tests/runtime-smoke.mjs`
- `edge/venue-wildcard-router/tests/worker.test.js`
- `server/tests/pricing.test.js`
- `server/tests/seoRendering.test.js`
- `server/tests/sitemap.test.js`
- `server/tests/venueMetadata.test.js`
- `server/tests/websiteAppearance.test.js`

Documentation:

- `SEO_PRODUCTION.md`
- `edge/venue-wildcard-router/README.md`

## Actual validation results

Validated locally on Node.js 24.20.0, with disposable MongoDB and stubbed external
providers. No production database, DNS, SSL, Worker binding or deployment was
changed.

| Check | Actual result |
| --- | --- |
| `server`: `npm test` | **106/106 passed**, including authentication, tenant/payment isolation, public booking, metadata, optional Express rendering and live sitemap discovery. |
| `client`: `npm test` | **70/70 passed**, including Netlify Edge HTML deadlines, initial metadata, canonical/robots/sitemap policies, preview hosts and image URL behavior. |
| `client`: `npm run lint` | Passed. Generated Playwright and Netlify artifacts are excluded from lint. |
| `client`: production and E2E Vite/PWA builds | Passed. A production build is restored after browser testing; E2E build settings must never be published. |
| Worker: `npm test` | **35/35 passed**, including all five existing booking route/method contracts, body/query/status preservation, host binding, 404/5xx and injection protection. |
| Worker: `npm run test:runtime` | **6/6 passed** against the actual local bundled workerd module; dry-run bundle **25.51 KiB**, gzip **7.98 KiB**. |
| Browser: full run, then final targeted checks | **29 distinct cases passed** across runs. Last full run: 27/28 passed; an old post-save synchronization assertion was corrected. Final critical payment-to-public-booking workflow plus three SEO checks: 4/4 passed; newly added SPA preview navigation: 1/1 passed. |
| `npx --yes netlify-cli@27.14.0 build --offline --dry` | Configuration/build-plan validation passed. |
| `npx --yes netlify-cli@27.14.0 build --offline` | **Passed**, including clean client dependency installation, Vite/PWA build and actual Edge Function bundling. Verified `.netlify/edge-functions-dist/manifest.json`, its exclusions, and the **40,463-byte ESZIP2** bundle. |
| `git diff --check` | Passed. |

The browser checks include two independent tenant hosts with JavaScript disabled,
escaped source HTML and JSON-LD, apex/preview/owner indexing rules, XML parsed by
the browser's XML parser, responsive mobile images, image-induced layout shift,
fallback image delivery and public/owner PWA isolation. The critical workflow
also exercises verified hall payment, publication, an actual fixture enquiry,
confirmation and recorded advance payment.

Actual Netlify bundling first exposed the client-base module-boundary problem;
using the repository root fixes it. On Windows, a pre-existing Vite process held
a compiler binary during the clean install. That exact workspace process was
temporarily stopped, dependencies restored, and its original command restarted
and checked on `::1:5173`. Stop a local Vite server before repeating a clean
install if it holds the same native binary.

The existing PWA tooling still emits a nonblocking `inlineDynamicImports`
deprecation warning. Local fixture tests do not establish live Google indexing,
deployed Cloudflare/Netlify behavior, live payment capture or production field
Core Web Vitals. Run the manual production and Search Console checks after the
reviewed deployment.
