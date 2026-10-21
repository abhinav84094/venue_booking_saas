import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Venue } from "../models/venueModels.js";
import { createApp, attachErrorHandlers } from "../app.js";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import {
  publicVenueSitemap,
  publicSitemapIndex,
  SITEMAP_PAGE_SIZE,
  MAX_VENUE_SITEMAP_PAGES,
} from "../services/sitemapService.js";

process.env.NODE_ENV = "test";
process.env.PUBLIC_VENUE_DOMAIN = "prakashsaas.world";
process.env.VENUE_CORS_ALLOWED_ORIGINS = "http://localhost:5173";
let mongo, server, url;
const locations = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const record = (slug, overrides = {}) => ({
  slug,
  name: `Venue ${slug}`,
  ownerId: new mongoose.Types.ObjectId(),
  timezone: "Asia/Kolkata",
  published: true,
  suspended: false,
  contact: { email: "private-owner@example.test", phone: "9876543210" },
  ...overrides,
});
async function request(path, options) {
  const response = await fetch(`${url}/api/public/seo${path}`, options);
  return { status: response.status, headers: response.headers, body: await response.text() };
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "venue_sitemap_tests" });
  await Venue.init();
  server = attachErrorHandlers(createApp()).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Venue.deleteMany({});
  process.env.PUBLIC_VENUE_DOMAIN = "prakashsaas.world";
  await Promise.all(Object.values(apiLimiters).map((limiter) => limiter.resetKey("127.0.0.1")));
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});

test("public sitemap index and shard expose two independent canonical tenant URLs without private fields", async () => {
  await Venue.create([record("alpha-hall"), record("beta-hall")]);
  const index = await request("/sitemap-index.xml");
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /^application\/xml; charset=utf-8/);
  assert.equal(index.headers.get("cache-control"), "no-store");
  assert.match(
    index.body,
    /^<\?xml version="1\.0" encoding="UTF-8"\?><sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  assert.deepEqual(locations(index.body), [
    "https://prakashsaas.world/sitemaps/platform.xml",
    "https://prakashsaas.world/sitemaps/venues-1.xml",
  ]);
  const shard = await request("/venues-1.xml");
  assert.equal(shard.status, 200);
  assert.match(shard.body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual(locations(shard.body), [
    "https://alpha-hall.prakashsaas.world/",
    "https://beta-hall.prakashsaas.world/",
  ]);
  assert.doesNotMatch(
    index.body + shard.body,
    /private-owner|9876543210|ownerId|_id|Venue alpha|lastmod|netlify|onrender|\/v\//,
  );
  const head = await request("/venues-1.xml", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
});

test("unpublished, suspended, reserved and malformed legacy venues are never discoverable", async () => {
  // Collection insertion intentionally simulates data predating current model
  // validation. A sitemap must not publish those legacy hostnames.
  await Venue.collection.insertMany([
    record("visible-hall"),
    record("draft-hall", { published: false }),
    record("suspended-hall", { suspended: true }),
    record("admin"),
    record("cdn"),
    record("ab"),
    record("a--b"),
    record("Uppercase"),
    record("bad</loc><script>"),
    record("a".repeat(64)),
    record("missing-flags", { published: undefined, suspended: undefined }),
  ]);
  const result = await request("/venues-1.xml");
  assert.equal(result.status, 200);
  assert.deepEqual(locations(result.body), ["https://visible-hall.prakashsaas.world/"]);
  assert.doesNotMatch(result.body, /script|draft|suspended|admin|cdn|Uppercase|missing-flags/);
});

test("publishing and unpublishing are reflected immediately without a cached listing", async () => {
  const venue = await Venue.create(record("changing-hall", { published: false }));
  assert.deepEqual(locations((await request("/sitemap-index.xml")).body), [
    "https://prakashsaas.world/sitemaps/platform.xml",
  ]);
  assert.equal((await request("/venues-1.xml")).status, 404);
  await Venue.updateOne({ _id: venue._id }, { published: true });
  assert.deepEqual(locations((await request("/venues-1.xml")).body), [
    "https://changing-hall.prakashsaas.world/",
  ]);
  await Venue.updateOne({ _id: venue._id }, { suspended: true });
  assert.equal((await request("/venues-1.xml")).status, 404);
  assert.equal(locations((await request("/sitemap-index.xml")).body).length, 1);
});

test("venue sitemaps are bounded, ordered shards with no duplicate URLs across page boundaries", async () => {
  const records = Array.from({ length: SITEMAP_PAGE_SIZE + 1 }, (_, index) =>
    record(`hall-${String(index).padStart(5, "0")}`),
  );
  await Venue.collection.insertMany(records.reverse());
  const index = await request("/sitemap-index.xml");
  assert.equal(locations(index.body).length, 3);
  const first = locations((await request("/venues-1.xml")).body);
  const second = locations((await request("/venues-2.xml")).body);
  assert.equal(first.length, SITEMAP_PAGE_SIZE);
  assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second]).size, SITEMAP_PAGE_SIZE + 1);
  assert.equal(first[0], "https://hall-00000.prakashsaas.world/");
  assert.equal(second[0], "https://hall-01000.prakashsaas.world/");
  assert.equal((await request("/venues-3.xml")).status, 404);
});

test("invalid or unbounded sitemap pages fail with 404 and endpoints cannot mutate venues", async () => {
  for (const page of ["0", "-1", "01", "99999", "100000", "1e2", "one"]) {
    const result = await request(`/venues-${page}.xml`);
    assert.equal(result.status, 404, page);
  }
  assert.equal((await request("/unknown.xml")).status, 404);
  const post = await request("/sitemap-index.xml", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"published":true}',
  });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  assert.equal(await Venue.countDocuments(), 0);
});

test("invalid canonical-domain configuration fails closed instead of inserting untrusted XML", async () => {
  await Venue.create(record("valid-hall"));
  for (const domain of [
    "https://evil.example/",
    'world"><script>',
    "localhost",
    "user@evil.example",
  ]) {
    process.env.PUBLIC_VENUE_DOMAIN = domain;
    const result = await request("/venues-1.xml");
    assert.equal(result.status, 503);
    assert.doesNotMatch(result.body, /script|evil\.example|<urlset/);
  }
});

test("database failures remain HTTP 5xx and never become an empty successful sitemap", async () => {
  const stub = mock.method(Venue, "countDocuments", () => {
    throw new Error("private database connection detail");
  });
  try {
    const result = await request("/sitemap-index.xml");
    assert.equal(result.status, 500);
    assert.doesNotMatch(result.body, /private database|<sitemapindex|<urlset/);
  } finally {
    stub.mock.restore();
  }
});

test("sitemap index refuses the protocol entry limit rather than silently truncating venues", async () => {
  const stub = mock.method(Venue, "countDocuments", () => ({
    maxTimeMS: async () => MAX_VENUE_SITEMAP_PAGES * SITEMAP_PAGE_SIZE + 1,
  }));
  try {
    await assert.rejects(publicSitemapIndex(), (error) => error.statusCode === 503);
    await assert.rejects(publicVenueSitemap("50000"), (error) => error.statusCode === 404);
  } finally {
    stub.mock.restore();
  }
});
