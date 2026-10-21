import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/worker.js";

const BACKEND = "https://venue-booking-saas.onrender.com";
const FRONTEND = "https://venue-booking-saas.netlify.app";
const HALL_ID = "507f1f77bcf86cd799439011";
const htmlShell = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Generic platform title</title><meta name="description" content="Generic platform description"><link rel="manifest" href="/manifest.webmanifest"></head><body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body></html>`;

function venue(slug = "sunrise-hall", overrides = {}) {
  return {
    _id: slug === "sunrise-hall" ? "venue-one" : "venue-two",
    slug,
    name: slug === "sunrise-hall" ? "Sunrise Hall" : "Moonlight Venue",
    description: "A welcoming venue for celebrations.",
    coverImage: "https://images.example.test/venue.jpg",
    contact: { phone: "+919999999999" },
    address: { line1: "12 Main Road", city: "Pune", state: "Maharashtra", postalCode: "411001" },
    website: { tagline: "Celebrate your next event with us." },
    published: true,
    suspended: false,
    ...overrides,
  };
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function harness(handler, options = {}) {
  const calls = [];
  const worker = createWorker({
    ...options,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const body = request.body ? await request.clone().text() : "";
      calls.push({ request, url: new URL(request.url), body, init });
      return handler(request, calls.at(-1));
    },
  });
  return {
    worker,
    calls,
    fetch(path = "/", init = {}, slug = "sunrise-hall") {
      return worker.fetch(new Request(`https://${slug}.prakashsaas.world${path}`, init), {});
    },
  };
}

function publishedHandler(request) {
  const url = new URL(request.url);
  if (url.origin === BACKEND) {
    const slug = url.pathname.split("/").at(-1);
    return json({
      success: true,
      venue: venue(slug),
      halls: [{ name: "Grand Hall", capacity: 250 }],
    });
  }
  if (url.origin === FRONTEND) {
    return new Response(htmlShell, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  throw new Error(`Unexpected origin: ${url.origin}`);
}

test("two customer hostnames resolve separate backend venues and initial HTML metadata", async () => {
  const app = harness(publishedHandler);
  for (const [slug, name] of [
    ["sunrise-hall", "Sunrise Hall"],
    ["moonlight-venue", "Moonlight Venue"],
  ]) {
    const response = await app.fetch("/", {}, slug);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/i);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>[^<]*${name}`));
    assert.match(
      html,
      new RegExp(
        `<link[^>]+rel=["']canonical["'][^>]+href=["']https://${slug}\\.prakashsaas\\.world/["']`,
      ),
    );
    assert.match(html, /<meta[^>]+name=["']description["'][^>]+Celebrate your next event/);
    assert.match(html, /<meta[^>]+property=["']og:title["']/);
    assert.match(html, /<meta[^>]+property=["']og:description["']/);
    assert.match(
      html,
      new RegExp(`<meta[^>]+property=["']og:url["'][^>]+https://${slug}\\.prakashsaas\\.world/`),
    );
    assert.match(html, /<meta[^>]+property=["']og:image["']/);
    assert.match(html, /<meta[^>]+name=["']twitter:card["'][^>]+summary_large_image/);
    assert.match(html, /<meta[^>]+name=["']twitter:title["']/);
    assert.match(html, /<meta[^>]+name=["']twitter:description["']/);
    assert.match(html, /<meta[^>]+name=["']twitter:image["']/);
    const structured = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/,
    );
    assert.ok(structured, "JSON-LD is present in the initial HTML");
    const data = JSON.parse(structured[1]);
    assert.equal(data["@type"], "EventVenue");
    assert.equal(data.name, name);
    assert.equal(data.url, `https://${slug}.prakashsaas.world/`);
    assert.doesNotMatch(html, /Generic platform (?:title|description)/);
  }
  assert.deepEqual(
    app.calls.filter(({ url }) => url.origin === BACKEND).map(({ url }) => url.pathname),
    ["/api/public/venues/sunrise-hall", "/api/public/venues/moonlight-venue"],
  );
});

test("initial metadata has one accurate business graph and no stale social tags", async () => {
  const shell = htmlShell.replace(
    "</head>",
    '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="Platform"><meta property="og:image" content="https://images.example.test/platform.jpg"><script type="application/ld+json">{"@type":"Organization","name":"Platform"}</script></head>',
  );
  const app = harness((request) =>
    new URL(request.url).origin === BACKEND
      ? json({
          success: true,
          venue: venue("sunrise-hall", {
            type: "banquet",
            openingHours: "Mo-Fr 09:00-18:00",
            coverImage: "https://res.cloudinary.com/venue/image/upload/v123/cover.jpg",
            website: { tagline: "Meet at Sunrise Hall in Pune.", sections: { contact: false } },
          }),
          halls: [],
        })
      : new Response(shell, { headers: { "Content-Type": "text/html" } }),
  );
  const response = await app.fetch();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Sunrise Hall \| Banquet hall in Pune \| Prakash SaaS<\/title>/);
  assert.equal((html.match(/name="twitter:card"/g) || []).length, 1);
  assert.equal((html.match(/name="twitter:title"/g) || []).length, 1);
  assert.equal((html.match(/property="og:image"/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((html.match(/type="application\/ld\+json"/g) || []).length, 1);
  assert.match(
    html,
    /rel="preload" as="image"[^>]+imagesrcset="[^">]+w_960,c_limit[^">]+" imagesizes="100vw"/,
  );
  const data = JSON.parse(html.match(/type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data["@type"], ["EventVenue", "LocalBusiness"]);
  assert.equal(data.name, "Sunrise Hall");
  assert.deepEqual(data.image, ["https://res.cloudinary.com/venue/image/upload/v123/cover.jpg"]);
  for (const field of [
    "telephone",
    "address",
    "openingHours",
    "geo",
    "aggregateRating",
    "review",
    "priceRange",
    "offers",
  ])
    assert.equal(
      data[field],
      undefined,
      `${field} must not disclose hidden or invented information`,
    );
});

test("HTTP documents and crawler resources redirect only after publication is verified", async () => {
  const app = harness(publishedHandler);
  for (const path of ["/?campaign=public", "/robots.txt", "/sitemap.xml"]) {
    for (const method of ["GET", "HEAD"]) {
      const start = app.calls.length;
      const response = await app.worker.fetch(
        new Request(`http://sunrise-hall.prakashsaas.world${path}`, { method }),
      );
      assert.equal(response.status, 308);
      assert.equal(
        response.headers.get("location"),
        `https://sunrise-hall.prakashsaas.world${path}`,
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), "");
      assert.equal(app.calls.length, start + 1);
      assert.equal(app.calls.at(-1).url.origin, BACKEND);
    }
  }
  for (const status of [404, 503]) {
    const hidden = harness(() => json({ success: false }, status));
    const response = await hidden.worker.fetch(
      new Request("http://sunrise-hall.prakashsaas.world/"),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("location"), null);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
  }
});

test("publication changes immediately remove and restore documents and crawler resources", async () => {
  let published = true;
  const app = harness((request) =>
    new URL(request.url).origin === BACKEND && !published
      ? json({ success: false, message: "Not published" }, 404)
      : publishedHandler(request),
  );
  for (const allowed of [true, false, true]) {
    published = allowed;
    for (const path of ["/", "/robots.txt", "/sitemap.xml"]) {
      const response = await app.fetch(path);
      assert.equal(response.status, allowed ? 200 : 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      if (!allowed) {
        assert.match(response.headers.get("x-robots-tag"), /noindex/);
        assert.doesNotMatch(await response.text(), /rel="canonical"|<loc>/);
      }
    }
  }
  assert.ok(app.calls.every(({ init }) => init.cache === "no-store"));
});

test("metadata escapes HTML and JSON-LD script breakouts", async () => {
  const malicious = `</title><script>alert("title")</script>`;
  const app = harness((request) =>
    new URL(request.url).origin === BACKEND
      ? json({
          success: true,
          venue: venue("sunrise-hall", {
            name: malicious,
            description: "</script><script>alert(1)</script>",
            website: { tagline: `A \"quoted\" & <unsafe> tagline` },
          }),
          halls: [],
        })
      : new Response(htmlShell, { headers: { "Content-Type": "text/html" } }),
  );
  const response = await app.fetch();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /<script>alert\(/);
  assert.match(html, /&lt;\/title&gt;/);
  const structured = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/,
  );
  assert.equal(JSON.parse(structured[1]).name, malicious);
});

for (const slug of ["missing-hall", "unpublished-hall", "suspended-hall"]) {
  test(`${slug} returns HTTP 404 without a generic SPA shell`, async () => {
    const app = harness(() =>
      json({ success: false, message: "Venue not found or not published" }, 404),
    );
    for (const path of ["/", "/robots.txt", "/sitemap.xml"]) {
      const response = await app.fetch(path, {}, slug);
      assert.equal(response.status, 404);
      assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
      assert.doesNotMatch(await response.text(), /Generic platform title|<div id="root">/);
    }
    assert.ok(
      app.calls.every(({ url }) => url.origin === BACKEND),
      "hidden tenants must never fetch the frontend shell",
    );
  });
}

test("a backend payload for a different tenant cannot render another venue", async () => {
  const app = harness(() => json({ success: true, venue: venue("moonlight-venue"), halls: [] }));
  const response = await app.fetch();
  assert.ok(response.status >= 400);
  assert.doesNotMatch(await response.text(), /Moonlight Venue/);
  assert.equal(app.calls.length, 1);
});

test("explicit unpublished or suspended metadata flags cannot render a tenant page", async () => {
  for (const flags of [{ published: false }, { suspended: true }]) {
    const app = harness(() =>
      json({ success: true, venue: venue("sunrise-hall", flags), halls: [] }),
    );
    const response = await app.fetch();
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.equal(app.calls.length, 1);
  }
});

test("reserved, invalid, nested, unrelated, and apex hostnames never reach an upstream", async () => {
  const app = harness(() => {
    throw new Error("Forbidden upstream request");
  });
  const hosts = [
    "admin.prakashsaas.world",
    "api.prakashsaas.world",
    "booking.prakashsaas.world",
    "cdn.prakashsaas.world",
    "assets.prakashsaas.world",
    "ab.prakashsaas.world",
    "a--b.prakashsaas.world",
    "nested.tenant.prakashsaas.world",
    "prakashsaas.world.attacker.test",
    "prakashsaas.world",
  ];
  for (const host of hosts) {
    const response = await app.worker.fetch(new Request(`https://${host}/`), {});
    assert.ok(response.status >= 400 && response.status < 500, `${host}: ${response.status}`);
  }
  assert.equal(app.calls.length, 0);
});

test("cross-tenant, private, noncanonical, and encoded API requests are rejected before proxying", async () => {
  const app = harness(() => {
    throw new Error("Forbidden upstream request");
  });
  for (const path of [
    "/api/public/venues/moonlight-venue",
    `/api/public/venues/moonlight-venue/halls/${HALL_ID}/availability`,
    "/api/auth/me",
    "/api/admin/users",
    "/api/venues",
    "/api",
    "/API/health",
    "/%61pi/health",
    "/%2561pi/health",
    "/api%2fhealth",
    "/api%5chealth",
    "/api//public/venues/sunrise-hall",
    "/api/public/venues/SUNRISE-HALL",
    "/api/public/venues/sunrise-hall/extra",
    "/login",
    "/dashboard",
    "/manifest.webmanifest",
    "/sw.js",
    "/registerSW.js",
  ]) {
    const response = await app.fetch(path);
    assert.ok(response.status >= 400 && response.status < 500, `${path}: ${response.status}`);
  }
  assert.equal(app.calls.length, 0);
});

const publicRoutes = [
  ["GET", "/api/public/venues/sunrise-hall", null, 200],
  [
    "GET",
    `/api/public/venues/sunrise-hall/halls/${HALL_ID}/availability?from=2026-11-01&to=2026-11-30&tag=a%2Bb`,
    null,
    200,
  ],
  [
    "POST",
    `/api/public/venues/sunrise-hall/halls/${HALL_ID}/quote`,
    { startAt: "2026-11-01T10:00:00Z", endAt: "2026-11-01T12:00:00Z" },
    200,
  ],
  [
    "POST",
    "/api/public/venues/sunrise-hall/enquiries",
    { hallId: HALL_ID, name: "Asha", phone: "9999999999" },
    201,
  ],
  [
    "POST",
    "/api/public/venues/sunrise-hall/enquiries/status",
    { reference: "VB-0123456789ABCDEF", token: "a".repeat(64) },
    200,
  ],
];

for (const [method, path, body, status] of publicRoutes) {
  test(`forwards exact existing public route ${method} ${path.split("?")[0]}`, async () => {
    const payload = JSON.stringify({ success: true, route: path, status });
    const app = harness(
      () =>
        new Response(payload, {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Upstream-Trace": "preserved",
            "Set-Cookie": "private=secret; HttpOnly",
          },
        }),
    );
    const input = body ? JSON.stringify(body) : undefined;
    const response = await app.fetch(path, {
      method,
      headers: {
        Cookie: "venueSession=private",
        Authorization: "Bearer secret",
        "X-Custom-Secret": "secret",
        "X-Forwarded-Host": "moonlight-venue.prakashsaas.world",
        "X-Forwarded-For": "127.0.0.1",
        "CF-Connecting-IP": "127.0.0.1",
        Origin: "https://attacker.test",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: input,
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("x-upstream-trace"), "preserved");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), payload);
    assert.equal(
      app.calls.length,
      1,
      "API calls must not fetch HTML or separately resolve the tenant",
    );
    const upstream = app.calls[0];
    assert.equal(upstream.url.origin, BACKEND);
    assert.equal(`${upstream.url.pathname}${upstream.url.search}`, path);
    assert.equal(upstream.request.method, method);
    assert.equal(upstream.body, input || "");
    assert.equal(upstream.request.headers.get("cookie"), null);
    assert.equal(upstream.request.headers.get("authorization"), null);
    assert.equal(upstream.request.headers.get("x-custom-secret"), null);
    assert.equal(upstream.request.headers.get("x-forwarded-host"), null);
    assert.equal(upstream.request.headers.get("x-forwarded-for"), null);
    assert.equal(upstream.request.headers.get("cf-connecting-ip"), null);
    if (body) {
      assert.match(upstream.request.headers.get("content-type"), /^application\/json/);
      assert.equal(
        upstream.request.headers.get("origin"),
        "https://sunrise-hall.prakashsaas.world",
      );
    }
  });
}

test("royalpalace quote POST reaches Render validation and preserves its 400 JSON response", async () => {
  const quotePath =
    "/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote";
  const validation = {
    success: false,
    message: "Check the highlighted fields",
    errors: ["startAt", "endAt", "model"].map((path) => ({ path, message: "Required" })),
  };
  const payload = JSON.stringify(validation);
  const app = harness((request, call) => {
    assert.equal(call.url.origin, BACKEND, "the quote must reach Render, never Netlify");
    assert.equal(call.url.pathname, quotePath);
    assert.equal(request.method, "POST");
    assert.equal(call.body, "{}", "forward the original body without adding or removing fields");
    assert.equal(request.headers.get("content-type"), "application/json");
    assert.equal(request.headers.get("cookie"), null);
    assert.equal(request.headers.get("authorization"), null);
    return new Response(payload, {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  });

  // Cover the exact production URL, then the same route with an encoded query.
  for (const query of ["", "?trace=quote%2Bvalidation&source=public"]) {
    const before = app.calls.length;
    const response = await app.fetch(
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
    assert.equal(response.status, 400, "backend validation must not become an edge 405");
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(await response.text(), payload);
    assert.equal(app.calls.length, before + 1, "only the public Render API is fetched");
    assert.equal(app.calls.at(-1).url.search, query);
  }
});

test("receipt status remains reachable after venue unpublication through its existing capability API", async () => {
  const app = harness((request) => {
    assert.match(new URL(request.url).pathname, /\/enquiries\/status$/);
    return json({
      success: true,
      receipt: { reference: "VB-0123456789ABCDEF", status: "CONFIRMED" },
    });
  });
  const response = await app.fetch("/api/public/venues/sunrise-hall/enquiries/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: "VB-0123456789ABCDEF", token: "a".repeat(64) }),
  });
  assert.equal(response.status, 200);
  assert.equal(
    app.calls.length,
    1,
    "do not add a published-venue gate ahead of receipt authorization",
  );
});

test("API validation, authorization, rate limits, and outages preserve backend status and content type", async () => {
  for (const status of [400, 401, 402, 403, 404, 409, 422, 429, 500, 502, 503]) {
    const body = JSON.stringify({ success: false, message: `upstream-${status}` });
    const app = harness(
      () =>
        new Response(body, {
          status,
          headers: { "Content-Type": "application/problem+json", "Retry-After": "30" },
        }),
    );
    const response = await app.fetch("/api/public/venues/sunrise-hall");
    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-type"), "application/problem+json");
    assert.equal(response.headers.get("retry-after"), "30");
    assert.equal(await response.text(), body);
  }
});

test("cross-tenant public POSTs cannot forward bodies or act on another venue", async () => {
  const app = harness(() => {
    throw new Error("Forbidden upstream request");
  });
  for (const path of [
    `/api/public/venues/moonlight-venue/halls/${HALL_ID}/quote`,
    "/api/public/venues/moonlight-venue/enquiries",
    "/api/public/venues/moonlight-venue/enquiries/status",
  ]) {
    const response = await app.fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 404);
  }
  assert.equal(app.calls.length, 0);
});

test("unsupported route methods and invalid JSON content types never reach the backend", async () => {
  const app = harness(() => {
    throw new Error("Forbidden upstream request");
  });
  for (const [path, method] of [
    ["/", "POST"],
    ["/api/public/venues/sunrise-hall", "POST"],
    [`/api/public/venues/sunrise-hall/halls/${HALL_ID}/availability`, "POST"],
    [`/api/public/venues/sunrise-hall/halls/${HALL_ID}/quote`, "GET"],
    ["/api/public/venues/sunrise-hall/enquiries", "GET"],
    ["/api/public/venues/sunrise-hall/enquiries/status", "DELETE"],
  ]) {
    const response = await app.fetch(path, { method });
    assert.equal(response.status, 405, `${method} ${path}`);
  }
  const badType = await app.fetch("/api/public/venues/sunrise-hall/enquiries", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(badType.status, 415);
  assert.equal(app.calls.length, 0);
});

test("JSON POST body size is bounded even without a trusted content-length", async () => {
  const app = harness(() => {
    throw new Error("Forbidden upstream request");
  });
  const response = await app.fetch("/api/public/venues/sunrise-hall/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ large: "x".repeat(256 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal(app.calls.length, 0);
});

test("robots and sitemap are tenant-specific and contain only the canonical public root", async () => {
  const app = harness(publishedHandler);
  for (const slug of ["sunrise-hall", "moonlight-venue"]) {
    const robots = await app.fetch("/robots.txt", {}, slug);
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get("content-type"), /^text\/plain/);
    const rules = await robots.text();
    assert.match(rules, /User-agent: \*/);
    assert.match(rules, new RegExp(`Sitemap: https://${slug}\\.prakashsaas\\.world/sitemap\\.xml`));
    const sitemap = await app.fetch("/sitemap.xml", {}, slug);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type"), /(?:application|text)\/xml/);
    const xml = await sitemap.text();
    assert.match(xml, new RegExp(`<loc>https://${slug}\\.prakashsaas\\.world/</loc>`));
    assert.equal((xml.match(/<loc>/g) || []).length, 1);
    assert.doesNotMatch(xml, /netlify|onrender|login|dashboard|\/v\//);
  }
  assert.ok(app.calls.every(({ url }) => url.origin === BACKEND));
});

test("HEAD document checks venue availability and returns no response body", async () => {
  const app = harness(publishedHandler);
  const response = await app.fetch("/", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(app.calls[0].request.method, "GET", "tenant metadata must be read even for HEAD");
});

test("generic static assets are proxied without tenant/auth data or owner PWA resources", async () => {
  const app = harness((request) => {
    assert.equal(new URL(request.url).origin, FRONTEND);
    return new Response("console.log('public');", {
      headers: {
        "Content-Type": "text/javascript",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Set-Cookie": "unexpected=secret",
      },
    });
  });
  const response = await app.fetch("/assets/index-abc123.js?v=2", {
    headers: { Cookie: "venueSession=secret", Authorization: "Bearer secret" },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "console.log('public');");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(app.calls[0].request.headers.get("cookie"), null);
  assert.equal(app.calls[0].request.headers.get("authorization"), null);
  assert.equal(app.calls[0].url.search, "?v=2");
});

test("only successful content-hashed Vite assets receive immutable cache headers", async () => {
  for (const [path, status, immutable] of [
    ["/assets/index-BSCWAR-4.js", 200, true],
    ["/assets/PublicVenuePage-Abc123_9.css?version=2", 200, true],
    ["/assets/photo-Abc123_9.webp", 200, true],
    ["/assets/index-Abc123_9.js", 404, false],
    ["/assets/index-Abc123_9.js", 503, false],
    ["/assets/index.js", 200, false],
    ["/assets/index-abc123.js", 200, false],
    ["/favicon.svg", 200, false],
    ["/theme-init.js", 200, false],
  ]) {
    const app = harness(
      () =>
        new Response("generic static file", {
          status,
          headers: {
            "Content-Type": "text/javascript",
            "Cache-Control": "public, max-age=999999999",
          },
        }),
    );
    const response = await app.fetch(path);
    assert.equal(response.status, status);
    assert.equal(
      response.headers.get("cache-control"),
      immutable ? "public, max-age=31536000, immutable" : "no-store",
      path,
    );
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].url.origin, FRONTEND);
    assert.equal(
      app.calls[0].init.cache,
      /-[a-zA-Z0-9_-]{8,}\./.test(path) ? undefined : "no-store",
    );
  }
});

test("Render connection failures return 502 without serving a successful generic SPA", async () => {
  const app = harness(() => {
    throw new TypeError("Render unavailable");
  });
  for (const path of ["/", "/robots.txt", "/sitemap.xml", "/api/public/venues/sunrise-hall"]) {
    const response = await app.fetch(path);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /Generic platform title/);
  }
});

test("Render HTTP failures retain appropriate 5xx status for tenant documents and crawlers", async () => {
  for (const status of [500, 502, 503, 504]) {
    const app = harness(() => json({ success: false, message: "Database unavailable" }, status));
    for (const path of ["/", "/robots.txt", "/sitemap.xml"]) {
      const response = await app.fetch(path);
      assert.equal(response.status, status);
      assert.doesNotMatch(await response.text(), /Generic platform title/);
    }
    assert.ok(app.calls.every(({ url }) => url.origin === BACKEND));
  }
});

test("malformed or unexpected metadata is an upstream failure, never a successful tenant document", async () => {
  const payloads = [
    () => new Response("<html>Render error</html>", { headers: { "Content-Type": "text/html" } }),
    () => new Response("{invalid-json", { headers: { "Content-Type": "application/json" } }),
    () => json({ success: false, venue: venue(), halls: [] }),
    () => json({ success: true, halls: [] }),
    () => json({ success: true, venue: venue(), halls: "invalid" }),
  ];
  for (const payload of payloads) {
    const app = harness(payload);
    const response = await app.fetch();
    assert.equal(response.status, 502);
    assert.equal(app.calls.length, 1, "invalid metadata must not fetch frontend HTML");
  }
});

test("failed frontend HTML delivery preserves outages instead of manufacturing a tenant page", async () => {
  const app = harness((request) =>
    new URL(request.url).origin === BACKEND
      ? json({ success: true, venue: venue(), halls: [] })
      : new Response("Netlify unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
  );
  const response = await app.fetch();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /<title>Sunrise Hall/);
});

test("malformed or oversized frontend shells fail as upstream errors", async () => {
  for (const shell of [
    "<html><head></head><body>Not the app</body></html>",
    "x".repeat(2 * 1024 * 1024 + 1),
  ]) {
    const app = harness((request) =>
      new URL(request.url).origin === BACKEND
        ? json({ success: true, venue: venue(), halls: [] })
        : new Response(shell, { headers: { "Content-Type": "text/html" } }),
    );
    const response = await app.fetch();
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /Request is too large|<div id="root">/);
  }
});

test("bounded upstream timeout returns 504", async () => {
  const app = harness(
    (request) =>
      new Promise((_resolve, reject) => {
        const abort = () =>
          reject(request.signal.reason || new DOMException("Timed out", "AbortError"));
        if (request.signal.aborted) abort();
        else request.signal.addEventListener("abort", abort, { once: true });
      }),
    { timeoutMs: 20 },
  );
  const response = await app.fetch();
  assert.equal(response.status, 504);
});

test("unexpected upstream redirects never redirect a customer to an external origin", async () => {
  const app = harness(
    () =>
      new Response(null, { status: 302, headers: { Location: "https://attacker.test/collect" } }),
  );
  for (const path of ["/api/public/venues/sunrise-hall", "/assets/index-abc123.js"]) {
    const response = await app.fetch(path);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("location"), null);
  }
});

test("same-origin upstream redirects are rewritten to the current customer host", async () => {
  const app = harness(
    () =>
      new Response(null, {
        status: 307,
        headers: { Location: `${BACKEND}/api/public/venues/sunrise-hall?redirected=true` },
      }),
  );
  const response = await app.fetch("/api/public/venues/sunrise-hall");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://sunrise-hall.prakashsaas.world/api/public/venues/sunrise-hall?redirected=true",
  );
});

test("relative upstream redirects resolve against the requested upstream resource", async () => {
  const app = harness(
    () => new Response(null, { status: 307, headers: { Location: "?updated=true" } }),
  );
  const response = await app.fetch("/api/public/venues/sunrise-hall");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://sunrise-hall.prakashsaas.world/api/public/venues/sunrise-hall?updated=true",
  );
});
