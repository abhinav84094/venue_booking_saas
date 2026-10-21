import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPlatformSeo } from "../netlify/edge-functions/platform-seo.js";
import { renderPlatformHtml } from "../../shared/platformSeo.js";

const raw =
  '<!doctype html><html lang="en"><head><title>Old title</title><meta name="robots" content="noindex"><link rel="canonical" href="https://old.test/"><script type="module" src="/assets/index-aBcd1234.js"></script></head><body><div id="root"></div></body></html>';
const shell = renderPlatformHtml(raw, { indexable: false });
const context = {
  next: async () =>
    new Response(shell, {
      headers: { "content-type": "text/html", etag: "old", "content-length": String(shell.length) },
    }),
};
const request = (path = "/", host = "prakashsaas.world", options) =>
  new Request(`https://${host}${path}`, options);
const unexpectedFetch = () => {
  throw new Error("Unexpected upstream request");
};
const handler = createPlatformSeo({ fetch: unexpectedFetch });
const venueResponse = (slug, flags = {}) =>
  Response.json({ success: true, venue: { slug, name: "A venue", ...flags }, halls: [] });

test("apex initial HTML contains one canonical, factual visible copy and valid platform JSON-LD", async () => {
  const response = await handler(request(), context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "index,follow");
  assert.equal(response.headers.get("etag"), null);
  assert.equal(response.headers.get("content-length"), null);
  const html = await response.text();
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(html, /href="https:\/\/prakashsaas\.world\/"/);
  assert.match(html, /<h1[^>]*>Venue booking,/);
  assert.match(html, /href="#experience"/);
  assert.doesNotMatch(html, /noindex|old\.test/);
  const schema = JSON.parse(
    html.match(/<script id="platform-structured-data"[^>]*>([\s\S]*?)<\/script>/)[1],
  );
  assert.deepEqual(
    schema["@graph"].map((item) => item["@type"]),
    ["Organization", "SoftwareApplication"],
  );
  assert.equal(schema["@graph"][1].url, "https://prakashsaas.world/");
  assert.equal("offers" in schema["@graph"][1], false);
});

test("aliases and legitimate previews are noindex and never claim a production canonical", async () => {
  for (const host of [
    "venue-booking-saas.netlify.app",
    "deploy-preview-10--venue-booking-saas.netlify.app",
    "seo-review--venue-booking-saas.netlify.app",
    "venue.prakashsaas.com",
  ]) {
    const response = await handler(request("/", host), context);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /content="noindex,follow"/);
    assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json|property="og:url"/);
  }
  assert.equal((await handler(request("/", "unrelated.test"), context)).status, 404);
  assert.equal((await handler(request("/", "missing.prakashsaas.world"), context)).status, 404);
});

test("workspace routes keep the application shell with noindex and no marketing fallback", async () => {
  for (const path of [
    "/login",
    "/register",
    "/forgot-password",
    "/google/set-password",
    "/venues",
    "/venues/abc/halls/def/bookings",
    "/account",
    "/admin",
  ]) {
    const response = await handler(request(path), context);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /noindex,follow/);
    assert.match(html, /src="\/assets\/index-aBcd1234\.js"/);
    assert.doesNotMatch(
      html,
      /rel="canonical"|application\/ld\+json|platform-seo-content|og:|twitter:/,
    );
  }
});

test("unknown, encoded and reserved public paths are actual 404 responses", async () => {
  for (const path of [
    "/not-a-page",
    "/features",
    "/pricing",
    "/v/admin",
    "/v/ab",
    "/v/amber--hall",
    "/v/amber-hall/private",
    "/%61dmin",
  ]) {
    const response = await handler(request(path), context);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex,follow");
    assert.doesNotMatch(await response.text(), /rel="canonical"|platform-seo-content/);
  }
});

test("production /v duplicates redirect only after verifying the same published venue", async () => {
  const calls = [];
  const edge = createPlatformSeo({
    fetch: async (url, init) => {
      calls.push([url, init]);
      return venueResponse("amber-hall");
    },
  });
  const response = await edge(
    request("/v/amber-hall?preview=1", "prakashsaas.world", {
      headers: { cookie: "session=secret", authorization: "Bearer secret" },
    }),
    context,
  );
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://amber-hall.prakashsaas.world/");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls[0][0], "https://venue-booking-saas.onrender.com/api/public/venues/amber-hall");
  assert.deepEqual(calls[0][1].headers, { accept: "application/json" });
  assert.equal(calls[0][1].redirect, "manual");
});

test("/v previews remain usable on Netlify without exposing an indexable duplicate", async () => {
  const response = await handler(
    request("/v/amber-hall", "deploy-preview-10--venue-booking-saas.netlify.app"),
    context,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /noindex,follow/);
  assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json|platform-seo-content/);
});

test("hidden and mismatched /v venues never gain a canonical redirect", async () => {
  for (const upstream of [
    () => new Response("hidden", { status: 404 }),
    () => venueResponse("amber-hall", { published: false }),
    () => venueResponse("amber-hall", { suspended: true }),
    () => venueResponse("another-hall"),
  ]) {
    const response = await createPlatformSeo({ fetch: upstream })(
      request("/v/amber-hall"),
      context,
    );
    assert.ok([404, 502].includes(response.status));
    assert.equal(response.headers.get("location"), null);
  }
});

test("Render failures, malformed upstreams and timeouts stay errors", async () => {
  for (const status of [500, 502, 503, 504]) {
    const response = await createPlatformSeo({
      fetch: async () => new Response("outage", { status }),
    })(request("/v/amber-hall"), context);
    assert.equal(response.status, status);
  }
  assert.equal(
    (
      await createPlatformSeo({
        fetch: async () => {
          throw new Error("offline");
        },
      })(request("/sitemap.xml"), context)
    ).status,
    502,
  );
  assert.equal(
    (
      await createPlatformSeo({ fetch: () => new Promise(() => {}), timeoutMs: 5 })(
        request("/v/amber-hall"),
        context,
      )
    ).status,
    504,
  );
  assert.equal(
    (
      await createPlatformSeo({
        fetch: async () =>
          new Response("not json", { headers: { "content-type": "application/json" } }),
      })(request("/v/amber-hall"), context)
    ).status,
    502,
  );
  assert.equal(
    (
      await handler(request(), {
        next: async () => new Response("broken", { headers: { "content-type": "text/html" } }),
      })
    ).status,
    502,
  );
});

test("frontend continuation has a deadline instead of leaving platform HTML pending", async () => {
  const edge = createPlatformSeo({ timeoutMs: 5 });
  const response = await edge(request(), { next: () => new Promise(() => {}) });
  assert.equal(response.status, 504);
  assert.equal(response.headers.get("x-robots-tag"), "noindex,follow");
  assert.doesNotMatch(await response.text(), /rel="canonical"|platform-seo-content/);
});

test("stalled frontend HTML is canceled at its deadline without waiting for upstream cancellation", async () => {
  let canceled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("<!doctype html><html><head>"));
    },
    cancel() {
      canceled = true;
      return new Promise(() => {});
    },
  });
  const response = await createPlatformSeo({ timeoutMs: 5 })(request(), {
    next: async () => new Response(body, { headers: { "content-type": "text/html" } }),
  });
  assert.equal(response.status, 504);
  assert.equal(canceled, true);
  assert.doesNotMatch(await response.text(), /rel="canonical"|platform-seo-content/);
});

test("a frontend response arriving after the deadline releases its unread body", async () => {
  let finish;
  let canceled = false;
  const response = await createPlatformSeo({ timeoutMs: 5 })(request(), {
    next: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  assert.equal(response.status, 504);
  finish(
    new Response(
      new ReadableStream({
        cancel() {
          canceled = true;
        },
      }),
      {
        headers: { "content-type": "text/html" },
      },
    ),
  );
  // Let the continuation observe the already-aborted deadline signal.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(canceled, true);
});

test("Render response streams also cancel at their deadline", async () => {
  let canceled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"success":'));
    },
    cancel() {
      canceled = true;
    },
  });
  const response = await createPlatformSeo({
    timeoutMs: 5,
    fetch: async () => new Response(body, { headers: { "content-type": "application/json" } }),
  })(request("/v/amber-hall"), context);
  assert.equal(response.status, 504);
  assert.equal(canceled, true);
});

test("SEO deadlines never intercept excluded API and owner static responses", async () => {
  const edge = createPlatformSeo({ timeoutMs: 1 });
  for (const path of ["/api/auth/login", "/sw.js"]) {
    const original = new Response("unchanged", { status: 201 });
    const response = await edge(request(path), {
      next: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return original;
      },
    });
    assert.equal(response, original);
    assert.equal(await response.text(), "unchanged");
  }
});

test("main sitemap index and shards use the real backend XML endpoints without caching", async () => {
  const calls = [];
  const xml =
    '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://amber-hall.prakashsaas.world/</loc></url></urlset>';
  const edge = createPlatformSeo({
    fetch: async (url) => {
      calls.push(url);
      return new Response(xml, {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "set-cookie": "secret=ignored",
        },
      });
    },
  });
  for (const path of ["/sitemap.xml", "/sitemaps/venues-1.xml"]) {
    const response = await edge(request(path), context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(await response.text(), xml);
  }
  assert.deepEqual(calls, [
    "https://venue-booking-saas.onrender.com/api/public/seo/sitemap-index.xml",
    "https://venue-booking-saas.onrender.com/api/public/seo/venues-1.xml",
  ]);
  assert.equal((await edge(request("/sitemaps/venues-0.xml"), context)).status, 404);
  assert.equal(
    (await edge(request("/sitemap.xml", "venue-booking-saas.netlify.app"), context)).status,
    404,
  );
  const platform = await handler(request("/sitemaps/platform.xml"), context);
  assert.match(await platform.text(), /<loc>https:\/\/prakashsaas\.world\/<\/loc>/);
});

test("robots is host-aware and lets crawlers see HTML noindex directives", async () => {
  const response = await handler(request("/robots.txt"), context);
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  const robots = await response.text();
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/prakashsaas\.world\/sitemap.xml/);
  assert.doesNotMatch(robots, /Disallow: \/(?:login|v\/)/);
  assert.doesNotMatch(
    await (await handler(request("/robots.txt", "venue-booking-saas.netlify.app"), context)).text(),
    /Sitemap:/,
  );
});

test("edge leaves API POST bodies, cookies, response semantics and static assets untouched", async () => {
  for (const path of [
    "/api/auth/login",
    "/assets/index-aBcd1234.js",
    "/sw.js",
    "/manifest.webmanifest",
  ]) {
    const original = new Response("unchanged", {
      status: 201,
      headers: { "content-type": "application/json", "set-cookie": "session=original" },
    });
    let nextCount = 0;
    const incoming = request(path, "prakashsaas.world", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "session=original" },
      body: '{"hello":"world"}',
    });
    const response = await handler(incoming, {
      next: async () => {
        nextCount++;
        return original;
      },
    });
    assert.equal(response, original);
    assert.equal(nextCount, 1);
    assert.equal(await incoming.text(), '{"hello":"world"}');
    assert.equal(response.headers.get("set-cookie"), "session=original");
  }
});

test("HEAD returns the GET status and SEO headers without requiring a static body", async () => {
  const headContext = {
    next: async () => new Response(null, { headers: { "content-type": "text/html" } }),
  };
  for (const path of ["/", "/login", "/robots.txt", "/sitemaps/platform.xml", "/missing"]) {
    const response = await handler(
      request(path, "prakashsaas.world", { method: "HEAD" }),
      headContext,
    );
    assert.equal(response.status, path === "/missing" ? 404 : 200);
    assert.equal(await response.text(), "");
  }
  assert.equal(
    (await handler(request("/", "prakashsaas.world", { method: "POST" }), context)).status,
    405,
  );
});

test("plain HTTP apex is canonicalized without changing query parameters", async () => {
  const response = await handler(new Request("http://prakashsaas.world/?campaign=venue"), context);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://prakashsaas.world/?campaign=venue");
});

test("versioned Netlify config deploys edge and excludes private APIs and owner PWA assets", async () => {
  const config = await readFile(new URL("../../netlify.toml", import.meta.url), "utf8");
  assert.match(config, /base = "\."/);
  assert.match(config, /publish = "client\/dist"/);
  assert.match(config, /command = "npm --prefix client ci && npm --prefix client run build"/);
  assert.match(config, /edge_functions = "client\/netlify\/edge-functions"/);
  assert.match(config, /function = "platform-seo"/);
  assert.match(config, /excludedPath = .*"\/api\/\*".*"\/sw\.js"/);
});
