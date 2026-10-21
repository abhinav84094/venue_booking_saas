# venue-wildcard-router

The production customer-host Worker is versioned here. It imports the shared
slug and SEO modules from the repository root. Deploy the bundled module, not
the unbundled source pasted into the dashboard.

Use Node.js 22 or newer:

```powershell
npm ci
npm test
npm run test:runtime
```

`npm run build` performs a Wrangler **dry run** and writes `dist/index.js`.
It does not upload or deploy anything. Runtime tests execute that bundle in
local workerd with stubbed outbound services, without a Cloudflare account.

See [the production SEO guide](../../SEO_PRODUCTION.md) for current platform and
venue SEO architecture, Render/Netlify/Worker rollout order, exact manual
version upload/promotion, curl checks, rollback and Search Console setup. The
[Phase 1 guide](../../PRODUCTION_PHASE1.md) records the initial public-booking
security work; its static apex sitemap description predates the dynamic SEO
release. Deploy Netlify's Edge Function with the whole site; uploading only the
static client cannot provide platform SEO or current discovery sitemaps.
Existing DNS, SSL and Worker triggers remain managed in Cloudflare. The config
intentionally declares no routes or custom domains. Use version upload and
version promotion, not a normal production `wrangler deploy` or trigger update.

The Worker remains customer-only. It resolves publication through the existing
public venue API, preserves all five public booking GET/POST contracts and
blocks private/auth/owner/PWA paths. It renders venue-specific escaped initial
HTML, canonical/OG/Twitter metadata and factual JSON-LD. Tenant robots and
sitemap responses use the same live visibility checks; hidden venues return
404 and backend outages remain 5xx. The separate Netlify Edge Function handles
the primary platform host, apex sitemap index and `/v/` canonical redirects.
