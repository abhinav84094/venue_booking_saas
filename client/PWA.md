# Prakash SaaS Venue Owner PWA

The existing React application now has an installable owner application. The
Venue backend authentication, hall authorization, subscription prices, payment
verification, database schemas and original Clinic application are unchanged.

## Identity and launch

The manifest is `public/manifest.webmanifest`, copied to the build unchanged:

| Setting            | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Name               | Prakash SaaS Venue                                                                 |
| Short name         | Prakash Venue                                                                      |
| Description        | Manage your venues, halls, bookings, availability, and subscriptions in one place. |
| Stable ID          | `/owner-app`                                                                       |
| Start URL          | `/login`                                                                           |
| Display            | `standalone`                                                                       |
| Scope              | `/`                                                                                |
| Theme / background | `#244638` / `#faf9f6`                                                              |

The existing login route sends authenticated users to their permitted venue list
or administrator page. Hall access still requires a verified paid subscription.
An unauthenticated launch shows the existing sign-in screen.

`src/pwa/policy.js` allows only HTTPS `venue.prakashsaas.com` and
`venue-booking-saas.netlify.app`, plus loopback/localhost for local browser tests.
Preview deployments, other hosts and customer subdomains do not opt in.
Public `/v/:slug` routes never advertise the owner manifest, Apple metadata,
install action or worker registration, even on the main owner origin.
Changing deployment hosts requires reviewing this exact allowlist.

Use the primary production hostname for installation. The Netlify hostname is
a separate origin, so an installation there has its own identity and session.
There is no new dependency on `PUBLIC_VENUE_DOMAIN` or its wildcard DNS setup.

## Installation and mobile behavior

Install controls appear on the owner venue list and account page only when the
browser offers installation, or when Safari instructions are appropriate. The
native Chromium prompt is retained until a user selects **Install App**. There
is no automatic prompt. Acceptance, dismissal, `appinstalled`, and standalone
display detection hide or suppress the action appropriately.

Android and supported desktop Chromium browsers manage their native install UI.
On iOS/iPadOS Safari, **How to install** explains Share → Add to Home Screen and
Open as Web App when offered. The app does not claim it can invoke that menu.
See the [WebKit Home Screen documentation](https://webkit.org/blog/13878/).
Device/browser installation support and native UI remain browser capabilities.

The icons are real PNGs rasterized from the existing green/gold venue favicon:
192×192, 512×512, a separate full-background 512×512 maskable icon with the mark
inside the safe area, and a 180×180 Apple touch icon. Run
`npm run generate:pwa-icons` to regenerate them using the existing Playwright
development dependency. The committed PNGs are used during normal builds;
Netlify does not need a browser to build the app.

Owner-scoped CSS adds safe-area spacing, touch targets and responsive layouts.
The viewport includes `viewport-fit=cover`. Public venue styling remains scoped
to the existing public website rules.

## Worker scope and cache security

`vite-plugin-pwa` uses `injectManifest` to compile `src/pwa/sw.js`. Automatic
registration and automatic HTML manifest injection are disabled. The runtime
adds owner metadata and registers `/sw.js` explicitly, after checking the owner
origin and route. The worker independently checks its origin as a second guard.

The worker precaches an explicit allowlist of generic build assets under
`/assets/`, the four app icons, favicon, theme bootstrap and dedicated branded
`offline.html`, `offline.css` and `offline.js`. Workbox revision keys version
these assets and remove obsolete revisions on activation.

The worker never caches `index.html`, navigation documents, authenticated
HTML, API responses, credentials, cookies, account details, tenant records,
booking availability, subscription status, checkout/verification results or
administrative data. Same-origin API requests always use network/no-store.
External Render, Google, Razorpay and image requests are left to the browser
and their providers; the worker does not intercept or cache their responses.
The backend's existing `Cache-Control: no-store` policy remains authoritative.

The root scope is necessary because current owner routes span `/login`,
`/account`, `/venues` and `/admin`. Manifest and service-worker scopes cannot
express an exclusion such as “everything except `/v/`.” Consequently a worker
previously installed on the main origin can control a later public-page visit
on that same origin. Its rules still keep public HTML/data network-only and
do not show owner installation UI there. Customer subdomains are separate
origins and never receive an owner worker through this application.

Browsers can offer their own Add to Home Screen/bookmark feature for arbitrary
sites; an application cannot disable that browser UI. This implementation
prevents public sites from advertising or registering the owner PWA rather
than promising to disable OS/browser shortcuts.

## Offline and reconnect

An already open owner app hides its interactive operational views when the
device goes offline and clears informational in-memory reads. Reconnection
does not redisplay stale data: **Retry connection** reloads and rechecks the
session, venue access and subscription with the backend.

An offline navigation or cold launch on an owner URL receives only the generic
branded offline document. It contains no user or tenant data and offers Retry.
This requires one successful online visit and worker installation first; a
first-ever visit while offline cannot download or install the fallback.
Public website navigations never receive that owner fallback. Booking,
availability, payment and subscription operations require a live backend
connection. No background sync queue or offline mutation store was added.

## Updates and authentication

Updates wait for a user decision. **Update and refresh** sends `SKIP_WAITING`
only after checking for busy forms, active Axios mutations and payment checkout.
The worker validates that the requesting client is an owner page. A controller
change reloads only the tab that requested the update and only when safe.
Other tabs are not force-reloaded. Missing lazy chunks expose a recovery action
instead of causing an automatic reload loop. Worker updates are checked on
registration and owner-window focus. Save work in other tabs before updating.
This follows the [Workbox user-controlled update pattern](https://developer.chrome.com/docs/workbox/handling-service-worker-updates/).

Google Identity Services and existing password login are preserved. There are
no new OAuth tokens, OTPs, email requirements or credential URL parameters.
The owner HTML keeps `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
Standalone sign-in screens include manual browser instructions if Google cannot
open its secure sign-in UI. Complete Google registration/recovery in the browser
when needed, then use the application email/password inside the installed app.
Browser and installed-app sessions can be separate; credentials are never
transferred through URLs or storage to work around that distinction.

Keep the actual frontend origins authorized for the existing OAuth client ID;
see [Google's origin configuration guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
Real Google consent, popup handling, native installation and mobile session
behavior still need a deployment smoke test on the intended devices.

## Netlify deployment

Keep base directory `client`, build command `npm run build` and publish directory
`dist` relative to that base (`client/dist` in this repository). Deploy the whole
build, including the manifest, worker, icons, offline assets, `_headers` and
`_redirects`. Existing frontend API, OAuth, public-domain and Render cookie/CORS
configuration continues to apply. This work does not modify DNS or deploy.

`_redirects` preserves the existing final SPA rewrite. Earlier unforced static
rules return a real 404 for missing scripts, icons and worker files instead of
rewriting them to application HTML. Existing files retain Netlify's normal
[file-shadowing behavior](https://docs.netlify.com/manage/routing/redirects/redirect-options/).
`_headers` supplies manifest/JavaScript MIME types, `nosniff`, the Google popup
opener policy, and fresh navigation/manifest/worker cache headers. The worker
cannot serve an old cached application document because none is precached.

After deployment verify `/manifest.webmanifest`, `/sw.js`, `/offline.html`, the
four icon URLs and a missing `/assets/*.js` path. The missing script must return
404, not HTML with status 200. Verify the actual hosting headers over HTTPS;
local Express browser tests do not emulate Netlify's routing engine.

## Files and dependencies

Added development dependencies: `vite-plugin-pwa` 2.0.0 and
`workbox-precaching` 7.4.1. Existing dependency versions were preserved.

Created files (paths relative to `client`):

```text
PWA.md
scripts/generate-pwa-icons.mjs
public/_headers
public/manifest.webmanifest
public/offline.html
public/offline.css
public/offline.js
public/static-not-found.txt
public/pwa-icons/icon-192.png
public/pwa-icons/icon-512.png
public/pwa-icons/maskable-512.png
public/pwa-icons/apple-touch-icon.png
src/pwa/policy.js
src/pwa/sw.js
src/pwa/runtime.js
src/pwa/register.js
src/pwa/install.js
src/pwa/activity.js
src/pwa/state.js
src/pwa/usePwaState.js
src/components/pwa/InstallApp.jsx
src/components/pwa/OfflineScreen.jsx
src/components/pwa/OwnerPwaBoundary.jsx
src/components/pwa/PwaErrorBoundary.jsx
src/components/pwa/PwaUpdateNotice.jsx
src/components/pwa/StandaloneAuthHelp.jsx
src/styles/pwa.css
tests/pwa.test.js
e2e/pwa.spec.js
```

Modified client files:

```text
package.json
package-lock.json
vite.config.js
index.html
public/_redirects
src/main.jsx
src/App.jsx
src/components/common/Button.jsx
src/components/GoogleAuthButton.jsx
src/pages/AccountPage.jsx
src/pages/VenuesPage.jsx
src/pages/AuthPage.jsx
```

`server/tests/browser-server.js` adds disposable worker-version and rate-limit
reset fixtures for repeatable browser tests. Those endpoints do not exist in
the production server. Pre-existing edits to `server/server.js` were preserved.

## Verification

Executed in the existing repository:

| Check                                               | Actual result                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `server`: `npm test`                                | 76 passed, 0 failed                                                           |
| `client`: `npm test`                                | 34 passed, 0 failed                                                           |
| `client`: `npm run lint`                            | Passed                                                                        |
| `client`: `npm run test:e2e`                        | Full browser suite: 19 passed, 0 failed                                       |
| Final PWA browser rerun after origin/port hardening | 11 passed, 0 failed                                                           |
| `client`: `npm run build`                           | Production build passed; `sw.js`, manifest, offline page and all PNGs emitted |
| Final worker precache                               | 59 static entries, approximately 601 KiB; no application HTML or API entries  |
| Offline page isolated Chromium audit                | Axe: 0 violations; keyboard Retry and 320/390px overflow checks passed        |

The browser suite covers real worker registration/control and cache inspection,
hot and cold offline states, failed offline availability/payment requests,
password login/logout, Google response fixtures in normal and simulated
standalone mode, main-origin public paths, unrelated customer origins, prompt
acceptance/dismissal, iOS instructions, busy-mutation update blocking, and actual
worker waiting/activation after a disposable script-byte update. Existing
booking/payment, public venue, theme and responsive-layout regression cases
also passed. The backend suite includes expired/unpaid hall denial and verified
payment authorization.

Desktop install, mobile instruction and offline screenshots were captured and
visually inspected. Native install choices, iOS user-agent detection and
standalone display-mode emulation are simulations, not physical-device OS
installation. Real Google consent and real device/browser popup/session behavior
were not exercised. The real worker update test changes script bytes in the
disposable local server; it is not a Netlify deployment test.

Remaining deployment checks: publish on the configured HTTPS owner hostname,
verify Netlify's actual MIME/redirect/cache headers, and smoke-test native
installation/launch and live Google sign-in on the intended Android, iOS,
Windows and macOS browsers. No deployment, DNS or Google Console settings were
changed by this implementation. Vite PWA currently emits one non-blocking Vite 8
`inlineDynamicImports` deprecation warning while building the worker.
