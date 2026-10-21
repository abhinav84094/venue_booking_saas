import test from "node:test";
import assert from "node:assert/strict";
import { classifyTenantHost } from "../../shared/tenantHost.js";
import { getVenueSlugFromHostname } from "../src/utils/venueDomain.js";

test("two production tenant hostnames resolve to their own shared-policy slugs", () => {
  for (const slug of ["amber-hall", "lotus-garden"]) {
    const hostname = `${slug}.prakashsaas.world`;
    assert.deepEqual(classifyTenantHost(hostname), { type: "tenant", slug });
    assert.equal(getVenueSlugFromHostname(hostname, "prakashsaas.world"), slug);
  }
  assert.deepEqual(classifyTenantHost("AMBER-HALL.PRAKASHSAAS.WORLD."), {
    type: "tenant",
    slug: "amber-hall",
  });
});

test("only approved platform and development hosts resolve to the owner application", () => {
  for (const hostname of [
    "prakashsaas.world",
    "venue-booking-saas.netlify.app",
    "venue.prakashsaas.com",
    "localhost",
    "127.0.0.1",
    "[::1]",
  ]) {
    assert.deepEqual(classifyTenantHost(hostname), { type: "platform", slug: null }, hostname);
    assert.equal(getVenueSlugFromHostname(hostname, "prakashsaas.world"), null);
  }
});

test("reserved, malformed, nested and unrelated hosts fail closed", () => {
  for (const hostname of [
    "admin.prakashsaas.world",
    "cdn.prakashsaas.world",
    "assets.prakashsaas.world",
    "api.prakashsaas.world",
    "ab.prakashsaas.world",
    "amber--hall.prakashsaas.world",
    "amber.hall.prakashsaas.world",
    "amber..prakashsaas.world",
    "www.amber-hall.prakashsaas.world",
    "prakashsaas.world.attacker.test",
    "amber-hall.prakashsaas.world.attacker.test",
    "amber-hall.venue-booking-saas.netlify.app",
    "deploy-preview-10--venue-booking-saas.netlify.app",
    "evil.test",
    "https://amber-hall.prakashsaas.world",
    "amber-hall.prakashsaas.world/login",
    "amber-hall.prakashsaas.world:443",
    "",
    undefined,
  ])
    assert.deepEqual(classifyTenantHost(hostname), { type: "invalid", slug: null }, hostname);
});

test("a configured tenant base does not make unrelated hostnames platform hosts", () => {
  assert.deepEqual(classifyTenantHost("amber-hall.example.test", "example.test"), {
    type: "tenant",
    slug: "amber-hall",
  });
  assert.deepEqual(classifyTenantHost("example.test", "example.test"), {
    type: "platform",
    slug: null,
  });
  assert.deepEqual(classifyTenantHost("amber-hall.prakashsaas.world", "example.test"), {
    type: "invalid",
    slug: null,
  });
  assert.deepEqual(classifyTenantHost("amber-hall.prakashsaas.world", ""), {
    type: "invalid",
    slug: null,
  });
});
