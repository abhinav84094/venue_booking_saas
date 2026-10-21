import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";
import { createApp, attachErrorHandlers } from "../app.js";
import { attachClient } from "../services/seoService.js";
import { renderPlatformHtml } from "../../shared/platformSeo.js";
import { fail } from "../utils/errors.js";

process.env.NODE_ENV = "test";
process.env.VENUE_SERVE_CLIENT = "true";
process.env.PUBLIC_VENUE_DOMAIN = "prakashsaas.world";
process.env.VENUE_CORS_ALLOWED_ORIGINS = "http://localhost:5173";
let dist, server, url;
const venues = {
  "alpha-hall": { name: "Alpha Hall", slug: "alpha-hall", address: { city: "Patna" }, website: {} },
  "beta-hall": { name: "Beta Hall", slug: "beta-hall", address: { city: "Ranchi" }, website: {} },
  "draft-hall": { name: "Draft Hall", slug: "draft-hall", published: false },
  "suspended-hall": { name: "Suspended Hall", slug: "suspended-hall", suspended: true },
};
const shell =
  '<!doctype html><html lang="en"><head><title>Old</title><meta name="robots" content="noindex"><script src="/theme-init.js"></script></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
async function request(pathname, hostname = "localhost", protocol = "http") {
  return new Promise((resolve, reject) => {
    // Native http.request preserves the explicit virtual Host. Undici fetch
    // derives Host from its connection URL on this Node version.
    const outgoing = httpRequest(
      url + pathname,
      {
        headers: { Host: hostname, "X-Forwarded-Proto": protocol },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: new Headers(
              Object.entries(response.headers).map(([key, value]) => [key, String(value)]),
            ),
          }),
        );
        response.on("error", reject);
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}
const jsonLd = (body) =>
  JSON.parse(body.match(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)[1]);
before(async () => {
  dist = await mkdtemp(path.join(os.tmpdir(), "venue-seo-rendering-"));
  await writeFile(path.join(dist, "index.html"), renderPlatformHtml(shell, { indexable: false }));
  await writeFile(path.join(dist, "app.js"), "/* generic application asset */");
  const app = createApp();
  // The test's sole TCP peer is controlled. Production still uses its existing
  // explicit proxy configuration; this simulates HTTPS termination locally.
  app.set("trust proxy", 1);
  await attachClient(app, {
    dist,
    resolveVenue: async (slug) => {
      if (slug === "backend-outage") throw fail("private upstream detail", 503);
      if (slug === "unknown-failure") throw new Error("private unexpected error");
      const venue = venues[slug];
      if (!venue) throw fail("Venue not found", 404);
      return { venue, halls: [] };
    },
  });
  server = attachErrorHandlers(app).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (dist) {
    assert.equal(path.dirname(path.resolve(dist)), path.resolve(os.tmpdir()));
    assert.match(path.basename(dist), /^venue-seo-rendering-/);
    await rm(dist, { recursive: true, force: true });
  }
});

test("optional Express local homepage remains useful but nonindexable; owner documents omit marketing fallback", async () => {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(home.body, /platform-seo-content:start/);
  assert.match(home.body, /<h1 id="platform-heading">Venue booking,/);
  assert.match(home.body, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(home.body, /rel="canonical"|application\/ld\+json/);
  for (const pathname of ["/login", "/register", "/venues/example/halls/example"]) {
    const owner = await request(pathname);
    assert.equal(owner.status, 200);
    assert.match(owner.body, /<div id="root"><\/div>/);
    assert.match(owner.body, /name="robots" content="noindex,follow"/);
    assert.doesNotMatch(
      owner.body,
      /platform-seo-content|rel="canonical"|application\/ld\+json|property="og:/,
    );
    assert.match(owner.body, /src="\/app\.js"/);
  }
});

test("optional Express canonical HTTPS tenant roots render independent initial metadata", async () => {
  for (const [slug, venue] of Object.entries(venues).slice(0, 2)) {
    const result = await request("/", `${slug}.prakashsaas.world`, "https");
    assert.equal(result.status, 200);
    assert.match(result.headers.get("content-type"), /^text\/html/);
    assert.equal(result.headers.get("x-robots-tag"), "index,follow");
    assert.match(result.body, new RegExp(`<h1>${venue.name}</h1>`));
    assert.ok(result.body.includes(`rel="canonical" href="https://${slug}.prakashsaas.world/"`));
    assert.equal(jsonLd(result.body).url, `https://${slug}.prakashsaas.world/`);
    assert.doesNotMatch(result.body, /platform-seo-content|platform-structured-data/);
  }
});

test("optional Express Render and local previews render venues without production canonical or schema URLs", async () => {
  for (const hostname of [
    "localhost",
    "venue-booking-saas.onrender.com",
    "venue-booking-saas.netlify.app",
  ]) {
    const result = await request("/v/alpha-hall", hostname, "https");
    assert.equal(result.status, 200);
    assert.match(result.body, /<h1>Alpha Hall<\/h1>/);
    assert.match(result.body, /name="robots" content="noindex,follow"/);
    assert.doesNotMatch(result.body, /rel="canonical"|property="og:url"|platform-seo-content/);
    assert.equal(jsonLd(result.body).url, undefined);
    assert.equal(jsonLd(result.body)["@id"], undefined);
  }
});

test("optional Express redirects only published apex previews and indexes the canonical platform homepage", async () => {
  const redirect = await request("/v/alpha-hall?campaign=test", "prakashsaas.world", "https");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "https://alpha-hall.prakashsaas.world/");
  const hidden = await request("/v/draft-hall", "prakashsaas.world", "https");
  assert.equal(hidden.status, 404);
  assert.equal(hidden.headers.get("location"), null);
  const home = await request("/", "prakashsaas.world", "https");
  assert.equal(home.status, 200);
  assert.match(home.body, /rel="canonical" href="https:\/\/prakashsaas\.world\/"/);
  assert.match(home.body, /id="platform-structured-data" nonce="[^"]+"/);
  assert.equal(jsonLd(home.body)["@graph"][0]["@type"], "Organization");
});

test("optional Express hidden, missing and invalid tenants return 404 without generic platform HTML", async () => {
  for (const hostname of [
    "missing-hall.prakashsaas.world",
    "draft-hall.prakashsaas.world",
    "suspended-hall.prakashsaas.world",
    "admin.prakashsaas.world",
    "a--b.prakashsaas.world",
    "unknown.example",
  ]) {
    const result = await request("/", hostname, "https");
    assert.equal(result.status, 404, hostname);
    assert.match(result.body, /<h1>Venue unavailable<\/h1>/);
    assert.match(result.body, /name="robots" content="noindex,follow"/);
    assert.doesNotMatch(result.body, /platform-seo-content|rel="canonical"|application\/ld\+json/);
  }
  assert.equal(
    (await request("/v/beta-hall", "alpha-hall.prakashsaas.world", "https")).status,
    404,
  );
  assert.equal((await request("/login", "alpha-hall.prakashsaas.world", "https")).status, 404);
});

test("optional Express backend outages preserve 5xx with noindex and no private diagnostic details", async () => {
  for (const [slug, status] of [
    ["backend-outage", 503],
    ["unknown-failure", 500],
  ]) {
    const result = await request(`/v/${slug}`);
    assert.equal(result.status, status);
    assert.match(result.body, /<h1>Service temporarily unavailable<\/h1>/);
    assert.equal(result.headers.get("x-robots-tag"), "noindex,follow");
    assert.doesNotMatch(
      result.body,
      /private upstream|private unexpected|platform-seo-content|rel="canonical"/,
    );
  }
});

test("optional Express preserves static files and never turns a missing API into SPA HTML", async () => {
  const asset = await request("/app.js");
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /(?:text|application)\/javascript/);
  assert.equal(asset.body, "/* generic application asset */");
  const api = await request("/api/does-not-exist");
  assert.equal(api.status, 404);
  assert.match(api.headers.get("content-type"), /application\/json/);
  assert.doesNotMatch(api.body, /<html|platform-seo-content/);
});
