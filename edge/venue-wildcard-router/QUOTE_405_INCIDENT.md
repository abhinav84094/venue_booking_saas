# Royal Palace production quote HTTP 405

## Reproduced evidence

On 2026-10-21, an anonymous POST with `Content-Type: application/json` and body
`{}` was sent to the same quote path on both public production origins:

`/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote`

| Origin | Actual response |
| --- | --- |
| `https://royalpalace.prakashsaas.world` | 405, `text/plain; charset=utf-8`, body `Method not allowed`, no `Allow` or CSP header. `Cache-Control: no-store`, `X-Robots-Tag: noindex`. |
| `https://venue-booking-saas.onrender.com` | 400, `application/json; charset=utf-8`, validation errors for `startAt`, `endAt`, `model`. |

This is a deployment/routing mismatch with the repository Worker. The response
matches the earlier, dashboard-supplied legacy Worker, whose global GET/HEAD-only
check runs before API forwarding. It does not match this repository's edge error
renderer, which returns HTML with a CSP; a local method rejection also sets
`Allow`. The exact quote route is POST-enabled here and targets Render directly.

**Confirmed:** a different/legacy handler remains in the production request
path. **Not remotely verified:** which account, Worker ID, active version ID,
traffic split or more-specific route is responsible. `wrangler whoami` reports
unauthenticated; `wrangler deployments status` cannot run without authentication.
No authenticated browser surface is available. Do not interpret this evidence
as proof of a particular remote version ID or assume a route assignment.

## Repository inspection

- `wrangler.jsonc`: name **`venue-wildcard-router`**, main **`src/index.js`**,
  compatibility date `2026-10-21`, `keep_vars: true`. No `env` suffix, routes or
  custom-domain declarations change the target or existing trigger configuration.
- `src/index.js` exports the actual default handler from `src/worker.js`.
- `apiRoute()` recognizes the exact 24-hex hall ID route and returns `["POST"]`
  for `quote`. It binds the path's venue slug to the hostname's validated slug.
- The API branch runs **before** the document/static GET/HEAD-only gate.
  That remaining gate is appropriate for HTML, robots, sitemap and assets;
  do not remove it globally.
- JSON POST bodies are read as bytes (maximum 256 KiB), then passed with
  `method: "POST"` and the unchanged path/query to the fixed Render origin.
  Backend status, body and content type are preserved. Owner Cookie and
  Authorization headers are stripped. No quote goes to Netlify.
- No deploy workflow is versioned in this repository. Render/Netlify deployment
  and a Git push do not establish that the Cloudflare Worker was published.
  The Worker `npm run build` is explicitly `wrangler deploy --dry-run`: it only
  builds locally. Uploading a Worker version and promoting it are separate steps.

## Read-only production identity checks

Run in `A:\MERN\SaaS\venue\edge\venue-wildcard-router`, using the existing
authorized Cloudflare account. Authenticate manually if needed; never paste an
API token into a chat, command log, URL or this repository. Do not use a temporary
account, a new Worker name, an environment suffix or a newly created route.

```powershell
npx --no-install wrangler whoami
npx --no-install wrangler deployments status --config wrangler.jsonc --name venue-wildcard-router
npx --no-install wrangler deployments list --config wrangler.jsonc --name venue-wildcard-router
npx --no-install wrangler versions list --config wrangler.jsonc --name venue-wildcard-router
npx --no-install wrangler versions view "<ACTIVE_VERSION_ID>" --config wrangler.jsonc --name venue-wildcard-router
```

In the Cloudflare dashboard, inspect the `prakashsaas.world` zone's existing
Worker routes and the Worker's domains/routes. Record the mapping that actually
matches the exact HTTPS quote URL, including any host-specific or `/api/*`
pattern. It must invoke the intended `venue-wildcard-router` in the correct
account. A more-specific legacy route can override the wildcard route.
Cloudflare documents that the
[most specific matching route wins](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior).

Inspect the production deployment's **version IDs and traffic percentages**.
The intended version must receive 100%; an uploaded version or a draft in the
editor is not evidence that customer traffic uses it. If several versions are
active, inspect each. If the correct Worker is active but a different handler
still answers, inspect the more-specific route chain before another upload.

## Exact corrective deployment, performed manually

First complete the identity checks above. If a more-specific route invokes a
different legacy Worker, record and review that route assignment; publishing
only `venue-wildcard-router` cannot fix a request that never invokes it. Correct
only that verified assignment as a separately reviewed operator action. Do not
create/delete wildcard routes, change DNS/SSL or blindly rewrite triggers.

Once the existing matching route invokes `venue-wildcard-router`, run:

```powershell
npm ci
npm test
npm run test:runtime
npx --no-install wrangler versions upload --config wrangler.jsonc --name venue-wildcard-router --keep-vars --message "Public booking POST quote forwarding"
```

Record the exact returned version ID, inspect that uploaded version, then
explicitly promote it to the existing Worker's production traffic:

```powershell
npx --no-install wrangler versions view "<NEW_VERSION_ID>" --config wrangler.jsonc --name venue-wildcard-router
npx --no-install wrangler versions deploy "<NEW_VERSION_ID>@100%" --config wrangler.jsonc --name venue-wildcard-router --message "Activate public booking POST quote forwarding"
npx --no-install wrangler deployments status --config wrangler.jsonc --name venue-wildcard-router
```

Use the entrypoint and bundling in the config. Do not upload raw `worker.js`
alone, paste unresolved relative imports into the dashboard, use `--no-bundle`,
or run `wrangler triggers deploy`. Version upload/promotion preserves the
dashboard-managed route configuration. Cloudflare describes the distinction
between versions and active traffic in its
[deployment documentation](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

No upload, promotion, routing, DNS or SSL action was performed during this
investigation.

## Production verification

Run the explicit production check after manual promotion:

```powershell
npm run smoke:production:quote
```

It sends two anonymous, deliberately invalid quote requests, prints only status,
content type, missing-field names and a CF-Ray diagnostic identifier, and exits
zero only if **both origins** return JSON 400 for all three fields. It sends no
credentials/customer information, creates no booking/payment and follows no
redirect. Exit 1 before remediation is expected and is not a local test failure.

Equivalent independent requests in PowerShell:

```powershell
curl.exe --max-time 25 -sS -i -X POST -H "Content-Type: application/json" --data-binary '{}' "https://royalpalace.prakashsaas.world/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote"
curl.exe --max-time 25 -sS -i -X POST -H "Content-Type: application/json" --data-binary '{}' "https://venue-booking-saas.onrender.com/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote"
```

Expected after remediation: both return 400 JSON with error paths `startAt`,
`endAt`, `model`; the customer response must not be plain-text edge 405. A valid
quote can be checked next with the venue's actual configured model and future
dates, while keeping quote calculation distinct from booking creation.

Also verify customer requests to `/api/auth/me`, `/api/admin` and another
venue's quote path remain HTTP 404. Never broaden the allowlist to `/api/*` or
allow arbitrary POSTs just to remove this 405. Keep the 256 KiB limit, JSON
requirement, private-header stripping and backend payment checks.

## Actual regression results

- Worker unit suite: **36/36 passed**.
- Bundled local workerd suite: **7/7 passed**, including a fresh dry-run bundle.
- New tests use the exact Royal Palace URL and local upstream stubs that return
  backend validation errors. They verify the raw `{}` body, method, encoded
  query preservation, one Render call, no Netlify call, and stripped credentials.
- Separate real production probes reproduced **customer 405 / Render 400**.
  These remote results remain unresolved until the operator corrects the active
  production handler; passing local tests is not a claim of live remediation.
