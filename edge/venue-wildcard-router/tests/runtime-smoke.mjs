// Runs the bundled production module inside workerd, with every outbound fetch
// replaced by a local stub. No Cloudflare account or external network is used.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { Miniflare, Response } from "miniflare";

const BACKEND = "https://venue-booking-saas.onrender.com";
const FRONTEND = "https://venue-booking-saas.netlify.app";
const HALL_ID = "507f1f77bcf86cd799439011";
const calls = [];
const shell = `<!doctype html><html lang="en"><head><title>Platform</title><meta name="description" content="Generic platform"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/pwa-icons/apple.png"><meta name="apple-mobile-web-app-capable" content="yes"></head><body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body></html>`;
let runtime;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

before(async () => {
  runtime = new Miniflare({
    cf: false,
    telemetry: { enabled: false },
    workers: [
      {
        config: {
          name: "venue-wildcard-router",
          compatibilityDate: "2026-10-21",
          manifest: {
            mainModule: "worker.js",
            modules: {
              "worker.js": {
                type: "esm",
                contents: await readFile(new URL("../dist/index.js", import.meta.url), "utf8"),
              },
            },
          },
        },
        dev: {
          outboundService: {
            type: "fetcher",
            handler: async (request) => {
              const url = new URL(request.url);
              const body = request.body ? await request.text() : "";
              calls.push({ url, method: request.method, body, headers: request.headers });
              if (url.origin === FRONTEND && url.pathname === "/") {
                return new Response(shell, { headers: { "Content-Type": "text/html" } });
              }
              if (url.origin === FRONTEND && url.pathname.startsWith("/assets/")) {
                return new Response("/* public asset */", {
                  headers: { "Content-Type": "text/javascript" },
                });
              }
              assert.equal(url.origin, BACKEND, "all destinations are fixed production origins");
              const match = url.pathname.match(/^\/api\/public\/venues\/([a-z0-9-]+)(.*)$/);
              assert.ok(match, `no private API may reach the upstream: ${url.pathname}`);
              const [, slug, suffix] = match;
              if (
                slug === "royalpalace" &&
                suffix === "/halls/6ad7b95579088a82b30a04da/quote" &&
                request.method === "POST" &&
                body === "{}"
              ) {
                return json(
                  {
                    success: false,
                    message: "Check the highlighted fields",
                    errors: ["startAt", "endAt", "model"].map((path) => ({
                      path,
                      message: "Required",
                    })),
                  },
                  400,
                );
              }
              if (slug === "hidden-hall")
                return json({ success: false, message: "Not found" }, 404);
              if (slug === "backend-down") return json({ success: false }, 503);
              if (!suffix) {
                return json({
                  success: true,
                  venue: {
                    slug,
                    name: slug === "sunrise-hall" ? "Sunrise Hall" : "Moonlight Venue",
                    description: "A venue for celebrations.",
                    website: { tagline: "Celebrate with us." },
                    address: { city: "Pune" },
                  },
                  halls: [{ name: "Grand Hall", capacity: 200 }],
                });
              }
              return json(
                { method: request.method, suffix, query: url.search, body },
                suffix === "/enquiries" ? 201 : 200,
                {
                  "Set-Cookie": "forbidden=secret; Secure; HttpOnly",
                  "X-Upstream-Result": "preserved",
                },
              );
            },
          },
        },
      },
    ],
  });
  await runtime.ready;
});

after(async () => {
  await runtime?.dispose();
});

const fetchTenant = (path = "/", init = {}, slug = "sunrise-hall") =>
  runtime.dispatchFetch(`https://${slug}.prakashsaas.world${path}`, init);

test("workerd renders separate tenants with initial SEO and a matching JSON-LD CSP nonce", async () => {
  for (const [slug, name] of [
    ["sunrise-hall", "Sunrise Hall"],
    ["moonlight-venue", "Moonlight Venue"],
  ]) {
    const response = await fetchTenant("/", {}, slug);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`<title>${name} | Event venue in Pune | Prakash SaaS</title>`));
    assert.match(html, /<meta name="twitter:card" content="summary">/);
    assert.match(html, /<meta name="twitter:title"/);
    assert.ok(html.includes(`<link rel="canonical" href="https://${slug}.prakashsaas.world/">`));
    assert.ok(
      html.includes(`<meta property="og:url" content="https://${slug}.prakashsaas.world/">`),
    );
    const structured = html.match(
      /<script[^>]+type="application\/ld\+json"[^>]+nonce="([^"]+)"[^>]*>([\s\S]*?)<\/script>/,
    );
    assert.ok(structured);
    assert.equal(JSON.parse(structured[2]).url, `https://${slug}.prakashsaas.world/`);
    assert.ok(response.headers.get("content-security-policy").includes(`'nonce-${structured[1]}'`));
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.doesNotMatch(
      html,
      /manifest\.webmanifest|apple-touch-icon|apple-mobile-web-app-capable/,
    );
  }
});

test("workerd returns actual 404 for hidden tenants across documents and crawler resources", async () => {
  for (const path of ["/", "/robots.txt", "/sitemap.xml"]) {
    const beforeCount = calls.length;
    const response = await fetchTenant(path, {}, "hidden-hall");
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.equal(calls.length, beforeCount + 1);
    assert.equal(calls.at(-1).url.origin, BACKEND);
    assert.doesNotMatch(await response.text(), /<div id="root">/);
  }
});

test("workerd preserves the existing availability query and all three public JSON POST bodies", async () => {
  const availability = await fetchTenant(
    `/api/public/venues/sunrise-hall/halls/${HALL_ID}/availability?from=2026-11-01&to=2026-11-30&tag=a%2Bb`,
  );
  assert.equal(availability.status, 200);
  assert.equal((await availability.json()).query, "?from=2026-11-01&to=2026-11-30&tag=a%2Bb");
  for (const suffix of [`/halls/${HALL_ID}/quote`, "/enquiries", "/enquiries/status"]) {
    const body = JSON.stringify({
      hallId: HALL_ID,
      reference: "VB-0123456789ABCDEF",
      token: "a".repeat(64),
      note: "Unicode: नमस्ते",
    });
    const response = await fetchTenant(`/api/public/venues/sunrise-hall${suffix}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "venueSession=secret",
        Authorization: "Bearer secret",
      },
      body,
    });
    assert.equal(response.status, suffix === "/enquiries" ? 201 : 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("x-upstream-result"), "preserved");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { method: "POST", suffix, query: "", body });
    assert.equal(calls.at(-1).headers.get("cookie"), null);
    assert.equal(calls.at(-1).headers.get("authorization"), null);
  }
});

test("bundled royalpalace quote POST preserves backend missing-field validation instead of edge 405", async () => {
  const quotePath =
    "/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote";
  for (const query of ["", "?trace=quote%2Bvalidation&source=public"]) {
    const beforeCount = calls.length;
    const response = await fetchTenant(
      `${quotePath}${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "venueSession=private",
          Authorization: "Bearer private",
        },
        body: "{}",
      },
      "royalpalace",
    );
    assert.equal(response.status, 400, "the bundled Worker must allow quote POSTs");
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    const validation = await response.json();
    assert.equal(validation.success, false);
    assert.deepEqual(validation.errors.map(({ path }) => path), ["startAt", "endAt", "model"]);
    assert.equal(calls.length, beforeCount + 1, "no Netlify or tenant-metadata fetch is allowed");
    const upstream = calls.at(-1);
    assert.equal(upstream.url.origin, BACKEND);
    assert.equal(upstream.url.pathname, quotePath);
    assert.equal(upstream.url.search, query);
    assert.equal(upstream.method, "POST");
    assert.equal(upstream.body, "{}");
    assert.equal(upstream.headers.get("content-type"), "application/json");
    assert.equal(upstream.headers.get("cookie"), null);
    assert.equal(upstream.headers.get("authorization"), null);
  }
});

test("workerd denies encoded, private, cross-tenant and owner-PWA paths without upstream calls", async () => {
  const beforeCount = calls.length;
  for (const path of [
    "/%61pi/health",
    "/%2561pi/auth/me",
    "/api/auth/me",
    "/api/public/venues/moonlight-venue",
    "/api",
    "/manifest.webmanifest",
    "/sw.js",
  ]) {
    const response = await fetchTenant(path);
    assert.equal(response.status, 404, path);
  }
  const reserved = await fetchTenant("/", {}, "admin");
  assert.equal(reserved.status, 404);
  assert.equal(calls.length, beforeCount);
});

test("workerd keeps Render outage status and returns no successful SPA fallback", async () => {
  for (const path of ["/", "/sitemap.xml", "/api/public/venues/backend-down"]) {
    const response = await fetchTenant(path, {}, "backend-down");
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /<div id="root">/);
  }
});

test("workerd redirects verified public HTTP documents and caches only hashed static assets", async () => {
  const redirect = await runtime.dispatchFetch("http://sunrise-hall.prakashsaas.world/", {
    redirect: "manual",
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "https://sunrise-hall.prakashsaas.world/");
  const hidden = await runtime.dispatchFetch("http://hidden-hall.prakashsaas.world/", {
    redirect: "manual",
  });
  assert.equal(hidden.status, 404);
  assert.equal(hidden.headers.get("location"), null);
  for (const [path, cache] of [
    ["/assets/index-Abc123_9.js", "public, max-age=31536000, immutable"],
    ["/assets/index.js", "no-store"],
  ]) {
    const response = await fetchTenant(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), cache);
  }
});
