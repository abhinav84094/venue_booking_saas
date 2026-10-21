import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuote,
  parseRange,
  parseVenueTime,
  overlaps,
} from "../services/pricingService.js";
import {
  venueSchema,
  venueUpdateSchema,
  hallSchema,
  hallUpdateSchema,
  planUpdateSchema,
  staffSchema,
} from "../validators/venueValidator.js";
import { validateSlug, suggestSlug } from "../../shared/slug.js";
import { slugFromHost } from "../services/publicVenueService.js";
import {
  verifyHmac,
  validateCapturedPayment,
  subscriptionIsActive,
} from "../services/venueSubscriptionService.js";
import { renderVenueHtml } from "../services/seoService.js";
import crypto from "node:crypto";
const now = new Date("2030-01-01T00:00:00Z"),
  range = { startAt: "2030-01-05T10:00", endAt: "2030-01-05T12:30", model: "HOURLY" };
const hall = {
  pricing: [
    {
      key: "HOURLY",
      label: "By the hour",
      amount: 12345,
      weekendAmount: 15000,
      durationMinutes: 720,
      overrides: [],
    },
  ],
};
test("subscription validity requires real dates and includes start but excludes expiration", () => {
  const start = new Date("2030-01-01T00:00:00Z"),
    end = new Date("2030-01-31T00:00:00Z");
  const sub = { status: "active", currentPeriodStart: start, currentPeriodEnd: end };
  assert.equal(subscriptionIsActive(sub, start), true);
  assert.equal(subscriptionIsActive(sub, new Date(end.getTime() - 1)), true);
  assert.equal(subscriptionIsActive(sub, end), false);
  assert.equal(subscriptionIsActive(sub, new Date(start.getTime() - 1)), false);
  for (const currentPeriodStart of [null, undefined, "2030-01-01", new Date("invalid")])
    assert.equal(subscriptionIsActive({ ...sub, currentPeriodStart }, start), false);
  assert.equal(subscriptionIsActive({ ...sub, status: "suspended" }, start), false);
});
test("integer paise, rounded hourly duration and weekend price are calculated on the backend", () => {
  const q = calculateQuote(hall, range, "Asia/Kolkata", now);
  assert.equal(q.pricingSnapshot.totalAmount, 45000);
  assert.equal(q.pricingSnapshot.units, 3);
  assert.equal(q.startAt.toISOString(), "2030-01-05T04:30:00.000Z");
});
test("date overrides use the venue-local start date and take precedence over weekend prices", () => {
  const h = structuredClone(hall);
  h.pricing[0].overrides = [{ startDate: "2030-01-05", endDate: "2030-01-05", amount: 18001 }];
  assert.equal(calculateQuote(h, range, "Asia/Kolkata", now).pricingSnapshot.totalAmount, 54003);
});
test("full-day intervals follow local midnight across DST instead of assuming 24 UTC hours", () => {
  const h = { pricing: [{ key: "FULL_DAY", label: "Full day", amount: 10000, overrides: [] }] };
  const q = calculateQuote(
    h,
    { model: "FULL_DAY", startAt: "2030-03-10T00:00", endAt: "2030-03-11T00:00" },
    "America/New_York",
    now,
  );
  assert.equal((q.endAt - q.startAt) / 3600000, 23);
  assert.equal(q.pricingSnapshot.totalAmount, 10000);
  assert.throws(
    () =>
      calculateQuote(
        h,
        { model: "FULL_DAY", startAt: "2030-03-10T01:00", endAt: "2030-03-11T01:00" },
        "America/New_York",
        now,
      ),
    /midnight/,
  );
});
test("ambiguous, nonexistent, reversed, past and overlong ranges are rejected", () => {
  assert.throws(() => parseVenueTime("2030-03-10T02:30", "America/New_York"), /does not exist/);
  assert.throws(() => parseVenueTime("2030-11-03T01:30", "America/New_York"), /ambiguous/);
  assert.equal(
    parseVenueTime("2030-11-03T01:30-04:00", "America/New_York").toUTC().toISO(),
    "2030-11-03T05:30:00.000Z",
  );
  assert.throws(
    () => parseRange({ startAt: range.endAt, endAt: range.startAt }, "Asia/Kolkata"),
    /after/,
  );
  assert.throws(
    () =>
      calculateQuote(
        hall,
        { ...range, startAt: "2020-01-05T10:00", endAt: "2020-01-05T12:30" },
        "Asia/Kolkata",
        now,
      ),
    /future/,
  );
  assert.throws(
    () => calculateQuote(hall, { ...range, endAt: "2030-01-05T23:30" }, "Asia/Kolkata", now),
    /maximum/,
  );
});
test("half-day, package and custom ranges enforce their configured duration and enabled models", () => {
  const h = {
    pricing: [
      { key: "HALF_DAY", label: "Half", amount: 1, durationMinutes: 360 },
      { key: "PACKAGE", label: "Wedding", amount: 2, durationMinutes: 480 },
      { key: "CUSTOM", label: "Custom", amount: 3, durationMinutes: 600 },
    ],
  };
  assert.equal(
    calculateQuote(
      h,
      { ...range, model: "HALF_DAY", endAt: "2030-01-05T16:00" },
      "Asia/Kolkata",
      now,
    ).pricingSnapshot.totalAmount,
    1,
  );
  assert.throws(
    () => calculateQuote(h, { ...range, model: "HALF_DAY" }, "Asia/Kolkata", now),
    /duration/,
  );
  assert.throws(
    () =>
      calculateQuote(
        h,
        { ...range, model: "PACKAGE", endAt: "2030-01-05T19:00" },
        "Asia/Kolkata",
        now,
      ),
    /duration/,
  );
  assert.equal(
    calculateQuote(h, { ...range, model: "CUSTOM" }, "Asia/Kolkata", now).pricingSnapshot
      .totalAmount,
    3,
  );
  assert.throws(() => calculateQuote(h, range, "Asia/Kolkata", now), /not enabled/);
});
test("half-open intervals allow adjacent bookings and detect partial/enclosed overlap", () => {
  const a = { startAt: "2030-01-01T10:00Z", endAt: "2030-01-01T12:00Z" };
  assert.equal(overlaps(a, { startAt: a.endAt, endAt: "2030-01-01T13:00Z" }), false);
  assert.equal(overlaps(a, { startAt: "2030-01-01T11:00Z", endAt: "2030-01-01T13:00Z" }), true);
});
test("slug protection and server hostname resolution reject reserved and nested labels", () => {
  process.env.PUBLIC_VENUE_DOMAIN = "venues.example.test";
  for (const slug of ["admin", "api", "www", "mail", "venues", "a", "a.b", "a--b"])
    assert.equal(validateSlug(slug).valid, false);
  assert.equal(suggestSlug("Róyal Palace & Lawn"), "royal-palace-lawn");
  assert.equal(slugFromHost("royal-palace.venues.example.test"), "royal-palace");
  assert.equal(slugFromHost("foo.bar.venues.example.test"), null);
  assert.equal(slugFromHost("api.venues.example.test"), null);
  delete process.env.PUBLIC_VENUE_DOMAIN;
});
test("strict schemas reject owner/tenant injection, slug changes, float money and overlapping overrides", () => {
  assert.equal(
    venueSchema.safeParse({ name: "Royal Palace", slug: "royal-palace", ownerId: "attacker" })
      .success,
    false,
  );
  assert.equal(venueUpdateSchema.safeParse({ slug: "stolen" }).success, false);
  assert.equal(
    hallSchema.safeParse({
      name: "Grand Hall",
      capacity: 200,
      pricing: [{ ...hall.pricing[0], amount: 12.5 }],
    }).success,
    false,
  );
  assert.equal(
    hallSchema.safeParse({
      name: "Grand Hall",
      capacity: 200,
      pricing: [
        {
          ...hall.pricing[0],
          overrides: [
            { startDate: "2030-01-01", endDate: "2030-01-06", amount: 1 },
            { startDate: "2030-01-05", endDate: "2030-01-08", amount: 2 },
          ],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    staffSchema.safeParse({ email: "staff@example.test", permissions: ["payments:write"] }).success,
    false,
  );
});
test("partial updates never apply creation defaults or clear omitted nested fields", () => {
  assert.deepEqual(venueUpdateSchema.parse({ website: { headline: "New headline" } }), {
    website: { headline: "New headline" },
  });
  assert.deepEqual(venueUpdateSchema.parse({ contact: { phone: "9876543210" } }), {
    contact: { phone: "9876543210" },
  });
  assert.deepEqual(hallUpdateSchema.parse({ name: "New hall name" }), { name: "New hall name" });
  assert.deepEqual(planUpdateSchema.parse({ amount: 12345 }), { amount: 12345 });
});
test("webhook signature is checked against raw bytes with strict hex validation", () => {
  const body = Buffer.from('{"event":"payment.captured"}'),
    secret = "unit-test-webhook-secret",
    signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.doesNotThrow(() => verifyHmac(body, signature, secret));
  assert.throws(() => verifyHmac(Buffer.from("changed"), signature, secret));
  assert.throws(() => verifyHmac(body, "invalid", secret));
  assert.throws(() => verifyHmac(body, signature, null));
});
test("captured payment verification binds amount, currency, merchant order and tenant identity", () => {
  const record = {
    ownerId: "owner1",
    hallId: "hall1",
    venueId: "venue1",
    subscriptionId: "sub1",
    planId: "plan1",
    amount: 10000,
    currency: "INR",
    receipt: "receipt1",
    razorpayOrderId: "order_1",
  };
  const order = {
    id: "order_1",
    amount: 10000,
    currency: "INR",
    receipt: "receipt1",
    status: "paid",
    notes: {
      ownerId: "owner1",
      hallId: "hall1",
      venueId: "venue1",
      subscriptionId: "sub1",
      planId: "plan1",
      product: "hall_subscription",
    },
  };
  const payment = {
    id: "pay_1",
    order_id: "order_1",
    amount: 10000,
    currency: "INR",
    status: "captured",
    amount_refunded: 0,
  };
  assert.doesNotThrow(() => validateCapturedPayment(payment, order, record));
  for (const altered of [
    { amount: 9999 },
    { currency: "USD" },
    { order_id: "order_other" },
    { status: "authorized" },
    { amount_refunded: 1 },
  ])
    assert.throws(() => validateCapturedPayment({ ...payment, ...altered }, order, record));
  assert.throws(() =>
    validateCapturedPayment(
      payment,
      { ...order, notes: { ...order.notes, venueId: "other" } },
      record,
    ),
  );
});
test("SSR metadata and structured data escape user content instead of executing HTML", () => {
  const venue = {
    name: "Hall <script>alert(1)</script>",
    description: "</script><script>alert(2)</script>",
    address: { city: "Patna" },
    contact: {},
  };
  const html = renderVenueHtml('<title>Prakash</title><div id="root"></div>', venue, [
    { name: '<img onerror="x">', description: "Test", capacity: 100 },
  ]);
  assert.equal(html.includes("<script>alert"), false);
  assert.ok(html.includes("application/ld+json"));
  assert.ok(html.includes("\\u003c/script>"));
  assert.ok(html.includes("&lt;img"));
});

test("SSR uses saved website headings and section visibility with Prakash SaaS metadata", () => {
  const venue = {
    name: "A Real Venue",
    description: "About this venue",
    website: {
      headline: "Your custom headline",
      tagline: "Your custom description",
      sections: { about: false, halls: false, contact: false },
    },
    address: { city: "Private section city" },
    contact: { phone: "9876543210" },
  };
  const html = renderVenueHtml('<title>Prakash SaaS</title><div id="root"></div>', venue, [
    { name: "Hidden Hall Listing", capacity: 100 },
  ]);
  assert.ok(html.includes('<meta name="application-name" content="Prakash SaaS">'));
  assert.ok(html.includes("<h1>Your custom headline</h1>"));
  assert.ok(
    html.includes('content="A Real Venue in Private section city. Your custom description"'),
  );
  assert.equal(html.includes("<h2>About the venue</h2>"), false);
  assert.equal(html.includes("Hidden Hall Listing"), false);
  assert.equal(html.includes("<h2>Visit us</h2>"), false);
});
