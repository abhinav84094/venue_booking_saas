import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveApiBaseUrl } from "../src/services/apiBaseUrl.js";

test("production API requests stay on the frontend origin despite legacy API configuration", () => {
  for (const configuredUrl of [
    "https://venue-booking-saas.onrender.com/api",
    "http://localhost:5001/api",
    "/custom-api",
    "/api",
    "",
    undefined,
  ]) {
    assert.equal(resolveApiBaseUrl({ isProduction: true, configuredUrl }), "/api");
  }
});

test("development preserves the configured backend URL and defaults to the Vite API proxy", () => {
  for (const configuredUrl of [
    "http://localhost:5001/api",
    "http://localhost:5000/api",
    "https://venue-booking-saas.onrender.com/api",
    "/api",
  ]) {
    assert.equal(
      resolveApiBaseUrl({ isProduction: false, configuredUrl }),
      configuredUrl,
    );
  }
  assert.equal(resolveApiBaseUrl({ isProduction: false, configuredUrl: "" }), "/api");
  assert.equal(resolveApiBaseUrl({ isProduction: false }), "/api");
  assert.equal(resolveApiBaseUrl(), "/api");
});

test("Netlify forwards API requests before the SPA fallback without exposing credentials", async () => {
  const redirects = await readFile(new URL("../public/_redirects", import.meta.url), "utf8");
  const rules = redirects
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
  const apiIndex = rules.findIndex(([from]) => from === "/api/*");
  const spaIndex = rules.findIndex(([from, to]) => from === "/*" && to === "/index.html");

  assert.ok(apiIndex >= 0, "API requests need a same-origin backend proxy");
  assert.ok(spaIndex > apiIndex, "API requests must reach the backend before the SPA fallback");
  const [, target, status] = rules[apiIndex];
  assert.equal(target, "https://venue-booking-saas.onrender.com/api/:splat");
  assert.equal(status, "200!", "API paths must always proxy, including existing static files");
  const destination = new URL(target);
  assert.equal(destination.search, "");
  assert.equal(destination.username, "");
  assert.equal(destination.password, "");
});
