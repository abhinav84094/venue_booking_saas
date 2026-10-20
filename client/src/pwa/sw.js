import { PrecacheController } from "workbox-precaching";
import { isOwnerOrigin, isOwnerPagePath, isSafePrecachePath } from "./policy.js";

const CACHE_NAME = "prakash-venue-owner-static-v1";
const ownerOrigin = isOwnerOrigin(self.location);

// This is a second guard in addition to registration gating in the app.
// Even a manually registered copy on a customer origin cannot cache or claim it.
if (ownerOrigin) {
  const precache = new PrecacheController({ cacheName: CACHE_NAME });
  const safeEntries = self.__WB_MANIFEST.filter((entry) => {
    const url = new URL(typeof entry === "string" ? entry : entry.url, self.location);
    return url.origin === self.location.origin && isSafePrecachePath(url.pathname);
  });
  precache.addToCacheList(safeEntries);

  self.addEventListener("install", (event) => {
    event.waitUntil(precache.install(event));
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(precache.activate(event).then(() => self.clients.claim()));
  });

  // Updates wait until the owner explicitly accepts them. Never skipWaiting
  // during install: a deployment must not reload a booking or payment form.
  self.addEventListener("message", (event) => {
    if (event.data?.type !== "SKIP_WAITING" || !event.source?.id) return;
    event.waitUntil(
      self.clients.get(event.source.id).then((client) => {
        if (!client) return;
        const url = new URL(client.url);
        if (url.origin === self.location.origin && isOwnerPagePath(url.pathname)) {
          return self.skipWaiting();
        }
      }),
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    // External APIs and identity/payment providers use the browser's normal
    // network handling and their own HTTP cache policy. Do not proxy them or
    // place any external response in this service worker's Cache Storage.
    if (!sameOrigin) return;

    if (request.mode === "navigate") {
      // Never cache app HTML or public/tenant navigation. Only owner routes
      // receive the generic offline document when the actual network fails.
      event.respondWith(
        fetch(request, { cache: "no-store" }).catch(async () => {
          if (sameOrigin && isOwnerPagePath(url.pathname)) {
            const fallback = await precache.matchPrecache("/offline.html");
            if (fallback) return fallback;
          }
          return Response.error();
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      sameOrigin &&
      isSafePrecachePath(url.pathname) &&
      precache.getCacheKeyForURL(url.href)
    ) {
      event.respondWith(precache.matchPrecache(request).then((cached) => cached || fetch(request)));
      return;
    }

    // Same-origin APIs, authentication, availability, payments and public
    // tenant data remain network-only, including POST requests.
    // No runtime cache exists and no backend response enters Cache Storage.
    event.respondWith(fetch(request, { cache: "no-store" }));
  });
} else {
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.registration.unregister());
  });
}
