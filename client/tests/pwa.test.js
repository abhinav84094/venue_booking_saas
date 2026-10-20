import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import {
  isOwnerOrigin,
  isOwnerAppLocation,
  isOwnerPagePath,
  isSafePrecachePath,
} from "../src/pwa/policy.js";

test("owner PWA permits only the exact HTTPS production origins and local development", () => {
  for (const hostname of ["venue.prakashsaas.com", "venue-booking-saas.netlify.app"]) {
    assert.equal(isOwnerOrigin({ hostname, protocol: "https:" }), true, hostname);
    assert.equal(isOwnerOrigin({ hostname, protocol: "http:" }), false, hostname);
    assert.equal(isOwnerOrigin({ hostname, protocol: "https:", port: "4443" }), false);
    assert.equal(isOwnerOrigin({ hostname, protocol: "https:", port: "443" }), true);
  }
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    for (const protocol of ["http:", "https:"])
      assert.equal(isOwnerOrigin({ hostname, protocol }), true, hostname);
  }
  for (const hostname of [
    "grandhall.venue.prakashsaas.com",
    "grandhall.prakashsaas.com",
    "venue.prakashsaas.com.attacker.test",
    "attacker-venue-booking-saas.netlify.app",
    "deploy-preview-10--venue-booking-saas.netlify.app",
    "www.venue.prakashsaas.com",
    "evil.test",
    "",
  ]) {
    assert.equal(isOwnerOrigin({ hostname, protocol: "https:" }), false, hostname);
  }
  assert.equal(isOwnerOrigin({ hostname: "localhost", protocol: "file:" }), false);
  assert.equal(isOwnerOrigin(), false);
});

test("public venues and APIs never qualify as owner installation or offline routes", () => {
  for (const pathname of [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/google/set-password",
    "/account",
    "/venues",
    "/venues/123/halls/456/subscription",
    "/admin",
  ]) {
    assert.equal(isOwnerPagePath(pathname), true, pathname);
    assert.equal(
      isOwnerAppLocation({
        hostname: "venue.prakashsaas.com",
        protocol: "https:",
        pathname,
      }),
      true,
      pathname,
    );
    assert.equal(
      isOwnerAppLocation({
        hostname: "grandhall.venue.prakashsaas.com",
        protocol: "https:",
        pathname,
      }),
      false,
      pathname,
    );
  }
  for (const pathname of [
    "/v",
    "/v/",
    "/v/grandhall",
    "/V/grandhall",
    "/v%2Fgrandhall",
    "/api",
    "/api/auth/me",
    "/API/payments",
    "/api%2Fauth/me",
    "//evil.test/login",
    "https://venue.prakashsaas.com/login",
    "/%zz",
    "",
    undefined,
  ]) {
    assert.equal(isOwnerPagePath(pathname), false, String(pathname));
    assert.equal(
      isOwnerAppLocation({
        hostname: "venue.prakashsaas.com",
        protocol: "https:",
        pathname,
      }),
      false,
      String(pathname),
    );
  }
});

test("precache policy admits static build assets and a dedicated offline document only", () => {
  for (const pathname of [
    "/offline.html",
    "/offline.css",
    "/offline.js",
    "/theme-init.js",
    "/favicon.svg",
    "/pwa-icons/icon-192.png",
    "/pwa-icons/icon-512.png",
    "/pwa-icons/maskable-512.png",
    "/pwa-icons/apple-touch-icon.png",
    "/assets/index-Abc123.js",
    "/assets/index-12.css",
    "/assets/font-A1.woff2",
    "/assets/brand-A1.svg",
  ])
    assert.equal(isSafePrecachePath(pathname), true, pathname);
  for (const pathname of [
    "/",
    "/index.html",
    "/login",
    "/venues",
    "/account",
    "/v/grandhall",
    "/api/auth/me",
    "/api/venues/1/halls/2/availability/2",
    "/api/payments",
    "/assets/index.html",
    "/assets/private.json",
    "/assets/nested/file.js",
    "/assets/../index.js",
    "/assets/index.js?token=secret",
    "/offline.html?token=secret",
    "/pwa-icons/unknown.png",
    "https://accounts.google.com/gsi/client",
    "https://checkout.razorpay.com/v1/checkout.js",
    "//evil.test/assets/index.js",
    undefined,
  ])
    assert.equal(isSafePrecachePath(pathname), false, String(pathname));
});

const pngDimensions = (bytes) => {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  const compressed = [];
  let ended = false;
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    assert.ok(offset + size + 12 <= bytes.length, "PNG chunk is complete");
    if (kind === "IDAT") compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
    if (kind === "IEND") ended = true;
    offset += size + 12;
  }
  assert.ok(ended, "PNG has an end marker");
  assert.ok(inflateSync(Buffer.concat(compressed)).length > 0, "PNG image data decodes");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test("production app icons are real decodable PNGs at the required dimensions", async () => {
  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["maskable-512.png", 512],
    ["apple-touch-icon.png", 180],
  ]) {
    const bytes = await readFile(new URL(`../public/pwa-icons/${name}`, import.meta.url));
    assert.deepEqual(pngDimensions(bytes), [size, size], name);
    assert.ok(bytes.length > 1000, `${name} contains a full brand image`);
  }
});

test("manifest has a stable owner identity, login launch and separate maskable icons", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );
  assert.equal(manifest.id, "/owner-app");
  assert.equal(manifest.name, "Prakash SaaS Venue");
  assert.equal(manifest.short_name, "Prakash Venue");
  assert.equal(
    manifest.description,
    "Manage your venues, halls, bookings, availability, and subscriptions in one place.",
  );
  assert.equal(manifest.start_url, "/login");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  for (const color of [manifest.theme_color, manifest.background_color])
    assert.match(color, /^#[a-f\d]{6}$/i);
  for (const [src, sizes, purpose] of [
    ["/pwa-icons/icon-192.png", "192x192", "any"],
    ["/pwa-icons/icon-512.png", "512x512", "any"],
    ["/pwa-icons/maskable-512.png", "512x512", "maskable"],
  ]) {
    const icon = manifest.icons.find((entry) => entry.src === src);
    assert.ok(icon, src);
    assert.equal(icon.sizes, sizes);
    assert.equal(icon.type, "image/png");
    assert.equal(icon.purpose, purpose);
    assert.ok(isSafePrecachePath(icon.src));
  }
});
