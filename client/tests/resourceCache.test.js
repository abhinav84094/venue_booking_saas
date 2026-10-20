import test from "node:test";
import assert from "node:assert/strict";
import { canCacheResource, createResourceCache } from "../src/services/resourceCache.js";

test("access, subscription, payment and availability reads never qualify for caching", () => {
  const base = "/venues/012345678901234567890123/halls/abcdefabcdefabcdefabcdef";
  for (const path of [
    "access",
    "subscription",
    "availability/abcdefabcdefabcdefabcdef",
    "payments",
    "bookings",
    "customers",
  ])
    assert.equal(canCacheResource(`${base}/${path}`), false);
  assert.equal(canCacheResource("/auth/me"), false);
  assert.equal(canCacheResource("/public/venues/demo/halls/id/quote"), false);
  assert.equal(canCacheResource("/public/venues/demo"), true);
  assert.equal(canCacheResource(`${base}/halls`), true);
});

test("informational requests deduplicate in flight and expire", async () => {
  let clock = 0,
    calls = 0;
  const cache = createResourceCache({ now: () => clock, ttl: 10 });
  const load = () => Promise.resolve(++calls);
  assert.deepEqual(await Promise.all([cache.load("hall", load), cache.load("hall", load)]), [1, 1]);
  assert.equal(await cache.load("hall", load), 1);
  clock = 11;
  assert.equal(await cache.load("hall", load), 2);
});

test("mutation or session invalidation prevents old in-flight responses being cached", async () => {
  const cache = createResourceCache();
  let resolveOld;
  const old = cache.load(
    "hall",
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.load("hall", () => "new account"), "new account");
  resolveOld("old account");
  await old;
  assert.equal(await cache.load("hall", () => "unexpected"), "new account");
});

test("failed requests can be retried and invalidation notifies mounted consumers", async () => {
  const cache = createResourceCache();
  await assert.rejects(cache.load("hall", () => Promise.reject(new Error("network"))));
  assert.equal(await cache.load("hall", () => "recovered"), "recovered");
  let count = 0;
  const unsubscribe = cache.subscribe(() => count++);
  cache.clear();
  unsubscribe();
  cache.clear();
  assert.equal(count, 1);
});

test("zero TTL deduplicates concurrent reads without retaining stale validity snapshots", async () => {
  const cache = createResourceCache({ ttl: 0 });
  let requests = 0;
  const loader = () => ++requests;
  assert.deepEqual(
    await Promise.all([cache.load("hall", loader), cache.load("hall", loader)]),
    [1, 1],
  );
  assert.equal(await cache.load("hall", loader), 2);
});
