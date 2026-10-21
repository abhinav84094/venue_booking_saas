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

See [the Phase 1 deployment guide](../../PRODUCTION_PHASE1.md) for the exact
manual upload, promotion, smoke tests, rollback and complete changed-file list.
Existing DNS, SSL and Worker triggers remain managed in Cloudflare. The config
intentionally declares no routes or custom domains. Use version upload and
version promotion, not a normal production `wrangler deploy` or trigger update.
