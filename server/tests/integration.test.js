import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Writable } from "node:stream";
import { getCloudinary } from "../config/cloudinary.js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";
import { syncEnvironmentPlans } from "../services/subscriptionPlanService.js";
import { getRazorpay } from "../config/razorpay.js";
import User from "../models/User.js";
import {
  Venue,
  VenueMembership,
  Hall,
  Booking,
  Customer,
  AvailabilityBlock,
  Payment,
  Subscription,
  SubscriptionPlan,
  SubscriptionPayment,
  initializeIndexes,
} from "../models/venueModels.js";
import { createApp, attachErrorHandlers } from "../app.js";
import generateToken from "../utils/generateToken.js";
import { hashPasswordResetOtp } from "../utils/otp.js";
import {
  createEnquiry,
  transitionBooking,
  createBlock,
  recordPayment,
} from "../services/bookingService.js";
import {
  createCheckout,
  recoverCheckout,
  activateCaptured,
  verifySubscriptionPayment,
  processFinancialEvent,
  requireFeature,
} from "../services/venueSubscriptionService.js";
let repl, server, url, owner, other, admin, ownerCookie, otherCookie, adminCookie, emailCode;
process.env.VENUE_JWT_SECRET = "test-only-jwt-secret-at-least-32-characters";
process.env.VENUE_OTP_HASH_SECRET = "test-only-otp-secret-at-least-32-characters";
process.env.VENUE_CORS_ALLOWED_ORIGINS = "http://localhost:5173";
process.env.VENUE_SUBSCRIPTION_MODE = "off";
process.env.NODE_ENV = "test";
process.env.VENUE_PLAN_3_MONTHS_PRICE = "123.45";
process.env.VENUE_PLAN_1_YEAR_PRICE = "999";
process.env.VENUE_RESEND_API_KEY = "re_test_not_a_real_credential";
process.env.VENUE_EMAIL_FROM = "Venue Tests <venue@example.test>";
process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET = "test-only-provider-secret";
const cookie = (u) => `venueAccessToken=${generateToken(u._id, u.tokenVersion)}`;
async function request(method, path, body, auth = ownerCookie, extra = {}) {
  const response = await fetch(`${url}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "venue-dashboard",
      ...(auth ? { cookie: auth } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}
let sequence = 0;
async function fixture({ paid = true, published = true } = {}) {
  sequence++;
  const v = await request("POST", "/venues", {
    name: `Test Venue ${sequence}`,
    slug: `test-venue-${sequence}`,
    address: { line1: "Event Road", city: "Patna", state: "Bihar", postalCode: "800001" },
    contact: { phone: "9876543210", email: "venue@example.test", whatsapp: "919876543210" },
  });
  assert.equal(v.status, 201, JSON.stringify(v.data));
  const venue = v.data.venue;
  const h = await request("POST", `/venues/${venue._id}/halls`, {
    name: "Grand Hall",
    capacity: 500,
  });
  assert.equal(h.status, 201, JSON.stringify(h.data));
  const hall = h.data.hall;
  if (paid) {
    await payForHall(venue._id, hall._id);
    await configureHall(venue._id, hall._id);
  }
  if (published) {
    const pub = await request("POST", hallBase(venue, hall) + "/publication", { published: true });
    assert.equal(pub.status, 200, JSON.stringify(pub.data));
  }
  return { venue: await Venue.findById(venue._id), hall: await Hall.findById(hall._id) };
}
const hallBase = (venue, hall) => `/venues/${venue._id}/halls/${hall._id}`;
async function configureHall(venueId, hallId) {
  const updated = await request("PATCH", `/venues/${venueId}/halls/${hallId}`, {
    published: true,
    pricing: [{ key: "HOURLY", label: "Hourly", amount: 250000, durationMinutes: 720 }],
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
}
async function testPlan() {
  return (await syncEnvironmentPlans()).find((plan) => plan.interval === "quarterly");
}
const signedCapture = (orderId, paymentId) => ({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: crypto
    .createHmac("sha256", process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex"),
});
async function payForHall(venueId, hallId, plan = null) {
  plan ||= await testPlan();
  const gateway = gatewayFixture(),
    checkout = await createCheckout(venueId, hallId, plan._id, gateway),
    paymentId = `pay_Fixture${++sequence}`;
  gateway.remote.get(checkout.orderId).status = "paid";
  await verifySubscriptionPayment(
    venueId,
    hallId,
    signedCapture(checkout.orderId, paymentId),
    gateway,
  );
  return { plan, gateway, checkout, paymentId };
}
const enquiry = (hall, extra = {}) => ({
  hallId: String(hall._id),
  model: "HOURLY",
  startAt: "2035-01-10T10:00",
  endAt: "2035-01-10T14:00",
  customer: {
    name: "Event Customer",
    phone: `98${String(++sequence).padStart(8, "0")}`,
    email: "customer@example.test",
  },
  eventType: "Wedding",
  guests: 200,
  notes: "No sensitive demo data",
  ...extra,
});
before(async () => {
  mock.method(Resend.prototype, "post", async (_path, entity) => {
    emailCode = entity.html.match(/<strong>(\d{6})<\/strong>/)?.[1];
    return { data: { id: "test-email" }, error: null };
  });
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "venue_integration_tests" });
  await User.init();
  await initializeIndexes();
  owner = await User.create({
    name: "Owner One",
    email: "one@example.test",
    password: "TestingPass123!",
    emailVerified: true,
  });
  other = await User.create({
    name: "Owner Two",
    email: "two@example.test",
    password: "TestingPass123!",
    emailVerified: true,
  });
  admin = await User.create({
    name: "Platform Admin",
    email: "admin@example.test",
    password: "TestingPass123!",
    emailVerified: true,
    role: "platform_admin",
  });
  ownerCookie = cookie(owner);
  otherCookie = cookie(other);
  adminCookie = cookie(admin);
  server = attachErrorHandlers(createApp()).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  mock.restoreAll();
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  await mongoose.disconnect();
  await repl?.stop();
});
test("owner registration, delivered OTP verification, password hashing and HttpOnly session login", async () => {
  const registered = await request(
    "POST",
    "/auth/register",
    { name: "New Owner", email: "new@example.test", password: "StrongPassword12!" },
    null,
  );
  assert.equal(registered.status, 201, JSON.stringify(registered.data));
  assert.match(emailCode, /^\d{6}$/);
  const stored = await User.findOne({ email: "new@example.test" });
  assert.notEqual(stored.password, "StrongPassword12!");
  assert.equal(stored.role, "owner");
  assert.equal(
    (
      await request(
        "POST",
        "/auth/login",
        { email: stored.email, password: "StrongPassword12!" },
        null,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("POST", "/auth/verify-email", { email: stored.email, otp: emailCode }, null))
      .status,
    200,
  );
  const logged = await request(
    "POST",
    "/auth/login",
    { email: stored.email, password: "StrongPassword12!" },
    null,
  );
  assert.equal(logged.status, 200);
  assert.match(logged.headers.get("set-cookie"), /venueAccessToken=.*HttpOnly.*SameSite=Lax/i);
  assert.equal(logged.data.user.password, undefined);
  assert.equal(
    (
      await request(
        "POST",
        "/auth/login",
        { email: stored.email, password: "wrong-password" },
        null,
      )
    ).status,
    401,
  );
});
test("auth rejects role injection, NoSQL operator inputs, malformed tokens and unauthorized API access", async () => {
  assert.equal(
    (
      await request(
        "POST",
        "/auth/register",
        {
          name: "Hacker",
          email: "hacker@example.test",
          password: "Password123!",
          role: "platform_admin",
        },
        null,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("POST", "/auth/login", { email: { $ne: null }, password: "Password123!" }, null))
      .status,
    400,
  );
  assert.equal((await request("GET", "/venues", undefined, null)).status, 401);
  assert.equal(
    (await request("GET", "/venues", undefined, "venueAccessToken=invalid")).status,
    401,
  );
});
test("verification guesses are capped per account even when requests are concurrent", async () => {
  const user = new User({ name: "OTP Owner", email: "otp@example.test", password: "Password123!" });
  user.emailVerificationOtpHash = hashPasswordResetOtp("123456", user._id);
  user.emailVerificationExpiresAt = new Date(Date.now() + 600000);
  await user.save();
  const attempts = await Promise.all(
    Array.from({ length: 7 }, () =>
      request("POST", "/auth/verify-email", { email: user.email, otp: "000000" }, null),
    ),
  );
  assert.equal(attempts.filter((a) => a.status === 429).length, 2);
  assert.equal((await User.findById(user._id)).emailVerificationAttempts, 5);
});
test("password reset is single-use and invalidates all earlier JWT sessions", async () => {
  const user = await User.create({
    name: "Reset Owner",
    email: "reset@example.test",
    password: "Password123!",
    emailVerified: true,
    passwordResetExpiresAt: new Date(Date.now() + 600000),
  });
  user.passwordResetOtpHash = hashPasswordResetOtp("123456", user._id);
  await user.save();
  const old = cookie(user);
  const result = await request(
    "POST",
    "/auth/reset-password",
    { email: user.email, otp: "123456", newPassword: "ChangedPassword123!" },
    null,
  );
  assert.equal(result.status, 200);
  assert.equal((await request("GET", "/auth/me", undefined, old)).status, 401);
  assert.equal(
    (
      await request(
        "POST",
        "/auth/reset-password",
        { email: user.email, otp: "123456", newPassword: "ChangedPassword123!" },
        null,
      )
    ).status,
    400,
  );
});
test("Google ID tokens are verified on the server and cannot take over nonauthoritative email accounts", async () => {
  process.env.VENUE_GOOGLE_CLIENT_ID = "test-google-client";
  const method = mock.method(OAuth2Client.prototype, "verifyIdToken", async ({ audience }) => {
    assert.equal(audience, "test-google-client");
    return {
      getPayload: () => ({
        sub: "google-sub-test",
        email: other.email,
        email_verified: true,
        name: "Google User",
      }),
    };
  });
  assert.equal(
    (await request("POST", "/auth/google", { credential: "test-credential" }, null)).status,
    403,
  );
  method.mock.restore();
  const success = mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
    getPayload: () => ({
      sub: "new-google-sub",
      email: "new-google@gmail.com",
      email_verified: true,
      name: "Google Owner",
    }),
  }));
  const google = await request(
    "POST",
    "/auth/google/complete-signup",
    { credential: "test-credential", password: "Password123!", confirmPassword: "Password123!" },
    null,
  );
  assert.equal(google.status, 200, JSON.stringify(google.data));
  assert.equal(google.data.user.role, "owner");
  success.mock.restore();
  delete process.env.VENUE_GOOGLE_CLIENT_ID;
});
test("CSRF origin checks block unsafe requests from arbitrary or tenant-controlled origins", async () => {
  const result = await request(
    "POST",
    "/venues",
    { name: "Bad Origin", slug: "bad-origin" },
    ownerCookie,
    { Origin: "https://attacker.example" },
  );
  assert.equal(result.status, 403);
  const missing = await fetch(`${url}/api/auth/logout`, { method: "POST" });
  assert.equal(missing.status, 403);
});
test("venue and hall creation enforce unique reserved-safe slugs and tenant-scoped private queries", async () => {
  const { venue, hall } = await fixture();
  assert.equal((await request("GET", `/venues/${venue._id}`, undefined, otherCookie)).status, 404);
  assert.equal(
    (
      await request(
        "PATCH",
        `/venues/${venue._id}/halls/${hall._id}`,
        { name: "Stolen Hall" },
        otherCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await request("GET", `/venues/${venue._id}/customers`, undefined, otherCookie)).status,
    404,
  );
  assert.equal(
    (await request("GET", `/venues/${venue._id}/subscription`, undefined, otherCookie)).status,
    404,
  );
  assert.equal((await request("POST", "/venues", { name: "Reserved", slug: "admin" })).status, 400);
  assert.equal(
    (await request("POST", "/venues", { name: "Duplicate", slug: venue.slug })).status,
    409,
  );
  assert.equal(
    (await request("PATCH", `/venues/${venue._id}`, { ownerId: other._id })).status,
    400,
  );
  assert.equal((await request("PATCH", `/venues/${venue._id}`, { slug: "new-slug" })).status, 400);
});
test("public slug routes expose published fields and halls without private owner or customer data", async () => {
  const { venue, hall } = await fixture(),
    draft = await Hall.create({
      venueId: venue._id,
      name: "Private Hall",
      capacity: 20,
      published: false,
      active: true,
    });
  const result = await request("GET", `/public/venues/${venue.slug}`, undefined, null);
  assert.equal(result.status, 200);
  assert.equal(result.data.venue.ownerId, undefined);
  assert.equal(
    result.data.halls.some((h) => h._id === String(draft._id)),
    false,
  );
  assert.equal(result.data.halls[0].venueId, undefined);
  const quote = await request(
    "POST",
    `/public/venues/${venue.slug}/halls/${hall._id}/quote`,
    { model: "HOURLY", startAt: "2035-01-10T10:00", endAt: "2035-01-10T14:00" },
    null,
  );
  assert.equal(quote.data.quote.pricingSnapshot.totalAmount, 1000000);
  await Venue.updateOne({ _id: venue._id }, { $set: { published: false } });
  assert.equal((await request("GET", `/public/venues/${venue.slug}`, undefined, null)).status, 404);
});
test("website edits preserve contact/address, and hall edits preserve saved pricing/publication", async () => {
  const { venue, hall } = await fixture();
  assert.equal(
    (
      await request("PATCH", `${hallBase(venue, hall)}/venue-profile`, {
        website: { headline: "Updated welcome" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("PATCH", `/venues/${venue._id}`, { contact: { email: "updated@example.test" } }))
      .status,
    200,
  );
  const saved = await Venue.findById(venue._id);
  assert.equal(saved.contact.phone, "9876543210");
  assert.equal(saved.address.city, "Patna");
  assert.equal(saved.timezone, "Asia/Kolkata");
  assert.equal(
    (await request("PATCH", `/venues/${venue._id}/halls/${hall._id}`, { name: "Renamed Hall" }))
      .status,
    200,
  );
  const savedHall = await Hall.findById(hall._id);
  assert.equal(savedHall.published, true);
  assert.equal(savedHall.pricing[0].amount, 250000);
  assert.equal(savedHall.capacity, 500);
});
test("customer create/edit is tenant scoped and preserves normalized phone uniqueness", async () => {
  const { venue, hall } = await fixture();
  const added = await request("POST", `${hallBase(venue, hall)}/customers`, {
    name: "Manual Customer",
    phone: "98765 55555",
    email: "manual@example.test",
  });
  assert.equal(added.status, 201);
  assert.equal(added.data.customer.phone, "9876555555");
  assert.equal(
    (
      await request(
        "PATCH",
        `${hallBase(venue, hall)}/customers/${added.data.customer._id}`,
        { name: "Changed Customer", phone: "9876555555", email: "" },
        otherCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request("POST", `${hallBase(venue, hall)}/customers`, {
        name: "Duplicate Customer",
        phone: "9876555555",
        email: "",
      })
    ).status,
    409,
  );
});
test("public enquiries preserve a backend pricing snapshot, customer isolation and no automatic reservation", async () => {
  const { venue, hall } = await fixture(),
    input = enquiry(hall);
  const first = await request("POST", `/public/venues/${venue.slug}/enquiries`, input, null);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.enquiry.customerId, undefined);
  const b = await Booking.findOne({ reference: first.data.enquiry.reference });
  assert.equal(b.pricingSnapshot.totalAmount, 1000000);
  assert.equal(await Customer.countDocuments({ venueId: venue._id }), 1);
  const second = await createEnquiry(venue, enquiry(hall));
  assert.equal(second.status, "ENQUIRY");
  await Hall.updateOne({ _id: hall._id }, { $set: { "pricing.0.amount": 999999 } });
  assert.equal((await Booking.findById(b._id)).pricingSnapshot.totalAmount, 1000000);
  assert.equal(
    (
      await request(
        "POST",
        `/public/venues/${venue.slug}/enquiries`,
        enquiry(hall, { expectedTotalAmount: 1 }),
        null,
      )
    ).status,
    409,
  );
});
test("customers can check confirmation only with their private receipt token", async () => {
  const { venue, hall } = await fixture(),
    created = await createEnquiry(venue, enquiry(hall));
  assert.match(created.statusToken, /^[a-f0-9]{64}$/);
  const payload = { reference: created.reference, token: created.statusToken },
    path = `/public/venues/${venue.slug}/enquiries/status`;
  const initial = await request("POST", path, payload, null);
  assert.equal(initial.status, 200);
  assert.equal(initial.data.receipt.status, "ENQUIRY");
  assert.equal(initial.data.receipt.customerId, undefined);
  assert.equal(
    (await request("POST", path, { ...payload, token: "0".repeat(64) }, null)).status,
    404,
  );
  const booking = await Booking.findOne({ reference: created.reference });
  assert.equal(booking.statusTokenHash, undefined);
  await transitionBooking(venue._id, booking._id, "CONFIRMED", owner._id);
  // Existing customers retain receipt access if the public website is later unpublished.
  await Venue.updateOne({ _id: venue._id }, { $set: { published: false } });
  const confirmed = await request("POST", path, payload, null);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.receipt.status, "CONFIRMED");
  assert.equal(confirmed.data.receipt.hallName, hall.name);
});
test("two simultaneous confirmations for overlapping enquiries produce exactly one confirmed booking", async () => {
  const { venue, hall } = await fixture();
  const enquiries = await Promise.all([
    createEnquiry(venue, enquiry(hall)),
    createEnquiry(venue, enquiry(hall)),
  ]);
  const records = await Booking.find({ reference: { $in: enquiries.map((e) => e.reference) } });
  const results = await Promise.allSettled(
    records.map((b) => transitionBooking(venue._id, b._id, "CONFIRMED", owner._id)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.statusCode, 409);
  assert.equal(await Booking.countDocuments({ venueId: venue._id, status: "CONFIRMED" }), 1);
});
test("different halls confirm simultaneously and adjacent bookings in one hall are permitted", async () => {
  const { venue, hall } = await fixture(),
    created = await request("POST", `/venues/${venue._id}/halls`, {
      name: "Garden",
      capacity: 500,
    }),
    second = await Hall.findById(created.data.hall._id);
  assert.equal(created.status, 201);
  await payForHall(venue._id, second._id);
  await configureHall(venue._id, second._id);
  const a = await createEnquiry(venue, enquiry(hall)),
    b = await createEnquiry(venue, enquiry(second));
  const records = await Booking.find({ reference: { $in: [a.reference, b.reference] } });
  await Promise.all(
    records.map((b) => transitionBooking(venue._id, b._id, "CONFIRMED", owner._id)),
  );
  const adjacent = await createEnquiry(
      venue,
      enquiry(hall, { startAt: "2035-01-10T14:00", endAt: "2035-01-10T16:00" }),
    ),
    record = await Booking.findOne({ reference: adjacent.reference });
  await transitionBooking(venue._id, record._id, "CONFIRMED", owner._id);
  assert.equal(await Booking.countDocuments({ venueId: venue._id, status: "CONFIRMED" }), 3);
});
test("manual block versus confirmation races cannot both occupy the same hall interval", async () => {
  const { venue, hall } = await fixture(),
    e = await createEnquiry(venue, enquiry(hall)),
    b = await Booking.findOne({ reference: e.reference });
  const results = await Promise.allSettled([
    transitionBooking(venue._id, b._id, "CONFIRMED", owner._id),
    createBlock(
      venue,
      {
        hallId: hall._id,
        startAt: "2035-01-10T11:00",
        endAt: "2035-01-10T13:00",
        reason: "Maintenance",
        type: "MAINTENANCE",
      },
      owner._id,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await AvailabilityBlock.countDocuments({ venueId: venue._id })) +
      (await Booking.countDocuments({ venueId: venue._id, status: "CONFIRMED" })),
    1,
  );
});
test("cancellation releases occupancy, expired enquiries cannot confirm and completion cannot be premature", async () => {
  const { venue, hall } = await fixture(),
    a = await createEnquiry(venue, enquiry(hall)),
    b = await createEnquiry(venue, enquiry(hall));
  const first = await Booking.findOne({ reference: a.reference }),
    second = await Booking.findOne({ reference: b.reference });
  await transitionBooking(venue._id, first._id, "CONFIRMED", owner._id);
  await assert.rejects(
    () => transitionBooking(venue._id, first._id, "COMPLETED", owner._id),
    /after it ends/,
  );
  await transitionBooking(venue._id, first._id, "CANCELLED", owner._id);
  await transitionBooking(venue._id, second._id, "CONFIRMED", owner._id);
  const expired = await createEnquiry(
    venue,
    enquiry(hall, { startAt: "2035-01-11T10:00", endAt: "2035-01-11T12:00" }),
  );
  await Booking.updateOne(
    { reference: expired.reference },
    { $set: { enquiryExpiresAt: new Date(0) } },
  );
  const exp = await Booking.findOne({ reference: expired.reference });
  await assert.rejects(
    () => transitionBooking(venue._id, exp._id, "CONFIRMED", owner._id),
    /expired/,
  );
});
test("availability contains occupied half-open ranges without customer data or private block reasons", async () => {
  const { venue, hall } = await fixture();
  await createBlock(
    venue,
    {
      hallId: hall._id,
      startAt: "2035-01-10T10:00",
      endAt: "2035-01-10T12:00",
      reason: "Private maintenance notes",
      type: "MAINTENANCE",
    },
    owner._id,
  );
  const result = await request(
    "GET",
    `/public/venues/${venue.slug}/halls/${hall._id}/availability?startAt=2035-01-10T09:00&endAt=2035-01-10T18:00`,
    undefined,
    null,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.busy.length, 1);
  assert.equal(result.data.busy[0].reason, undefined);
  assert.equal(result.data.busy[0]._id, undefined);
  assert.equal(
    (
      await request(
        "GET",
        `/public/venues/${venue.slug}/halls/${hall._id}/availability?startAt=2035-01-10T12:00&endAt=2035-01-10T14:00`,
        undefined,
        null,
      )
    ).data.busy.length,
    0,
  );
});
test("manual receipts are tenant-scoped, idempotent, amount-bounded and separate from SaaS payments", async () => {
  const { venue, hall } = await fixture(),
    enq = await createEnquiry(venue, enquiry(hall)),
    b = await Booking.findOne({ reference: enq.reference });
  await transitionBooking(venue._id, b._id, "CONFIRMED", owner._id);
  const input = {
    bookingId: String(b._id),
    amount: 400000,
    type: "RECEIPT",
    method: "upi",
    reference: "manual-receipt-1",
    idempotencyKey: crypto.randomUUID(),
  };
  await recordPayment(venue._id, input, owner._id);
  await recordPayment(venue._id, input, owner._id);
  assert.equal(await Payment.countDocuments({ venueId: venue._id }), 1);
  assert.equal((await Booking.findById(b._id)).receivedAmount, 400000);
  await assert.rejects(
    () => recordPayment(venue._id, { ...input, amount: 500000 }, owner._id),
    /Idempotency/,
  );
  await assert.rejects(
    () =>
      recordPayment(
        venue._id,
        { ...input, amount: 700000, idempotencyKey: crypto.randomUUID() },
        owner._id,
      ),
    /exceeds/,
  );
  await assert.rejects(
    () =>
      recordPayment(
        venue._id,
        { ...input, type: "REFUND", amount: 500000, idempotencyKey: crypto.randomUUID() },
        owner._id,
      ),
    /exceeds/,
  );
  await recordPayment(
    venue._id,
    { ...input, type: "REFUND", amount: 100000, idempotencyKey: crypto.randomUUID() },
    owner._id,
  );
  assert.equal(await SubscriptionPayment.countDocuments({ venueId: venue._id }), 1);
  const overview = await request("GET", `${hallBase(venue, hall)}/overview`);
  assert.equal(overview.data.stats.recordedRevenue, 300000);
  assert.equal(
    (await request("POST", `${hallBase(venue, hall)}/payments`, input, otherCookie)).status,
    404,
  );
});
test("staff access is explicit and cannot manage owner settings, subscriptions or other venues", async () => {
  const { venue, hall } = await fixture();
  await VenueMembership.create({
    venueId: venue._id,
    userId: other._id,
    permissions: ["halls:read", "bookings:read"],
    active: true,
  });
  assert.equal((await request("GET", `/venues/${venue._id}`, undefined, otherCookie)).status, 200);
  assert.equal(
    (await request("GET", `/venues/${venue._id}/halls`, undefined, otherCookie)).status,
    200,
  );
  assert.equal(
    (await request("PATCH", `/venues/${venue._id}`, { name: "Stolen" }, otherCookie)).status,
    404,
  );
  assert.equal(
    (await request("GET", `${hallBase(venue, hall)}/subscription`, undefined, otherCookie)).status,
    404,
  );
  assert.equal(
    (await request("GET", `${hallBase(venue, hall)}/payments`, undefined, otherCookie)).status,
    404,
  );
});
test("new unpaid halls are visible for onboarding but all protected APIs deny access even in off mode", async () => {
  const { venue, hall } = await fixture({ paid: false, published: false }),
    base = hallBase(venue, hall);
  assert.equal(process.env.VENUE_SUBSCRIPTION_MODE, "off");
  const sub = await Subscription.findOne({ hallId: hall._id });
  assert.equal(String(sub.ownerId), String(owner._id));
  assert.equal(String(sub.venueId), String(venue._id));
  assert.equal(sub.status, "pending");
  assert.equal((await request("GET", `/venues/${venue._id}/halls`)).status, 200);
  assert.equal((await request("GET", `${base}/subscription`)).status, 200);
  for (const extra of [{ pricing: [] }, { images: [] }, { published: true }]) {
    const injected = await request("POST", `/venues/${venue._id}/halls`, {
      name: "Injected hall",
      capacity: 100,
      ...extra,
    });
    assert.equal(injected.status, 400, JSON.stringify(injected.data));
  }
  for (const content of [
    { website: { headline: "Unpaid marketing" } },
    { images: [] },
    { coverImage: "" },
  ]) {
    assert.equal((await request("PATCH", `/venues/${venue._id}`, content)).status, 402);
    assert.equal((await request("PATCH", `${base}/venue-profile`, content)).status, 402);
  }
  for (const [method, suffix, body] of [
    ["GET", "/overview"],
    ["GET", "/halls"],
    ["PATCH", "", { name: "Blocked edit" }],
    ["GET", "/bookings"],
    ["GET", "/customers"],
    ["GET", "/payments"],
    ["POST", "/blocks", {}],
    ["POST", "/customers", {}],
    ["POST", "/payments", {}],
    ["POST", "/publication", { published: true }],
    ["POST", "/images", {}],
    ["GET", "/staff"],
    ["POST", "/booking-checkout", {}],
    ["GET", `/availability/${hall._id}?startAt=2035-01-10T10:00&endAt=2035-01-10T12:00`],
  ]) {
    const response = await request(method, base + suffix, body);
    assert.equal(response.status, 402, `${method} ${suffix}: ${JSON.stringify(response.data)}`);
  }
  for (const suffix of ["overview", "bookings", "customers", "payments", "staff", "subscription"]) {
    const response = await request("GET", `/venues/${venue._id}/${suffix}`);
    assert.equal(response.status, 402, `${suffix}: ${JSON.stringify(response.data)}`);
  }
  assert.equal((await request("GET", base + "/overview", undefined, otherCookie)).status, 404);
  assert.equal(
    (
      await request("POST", base + "/subscription/checkout", {
        planId: new mongoose.Types.ObjectId(),
        hallId: hall._id,
      })
    ).status,
    400,
  );
});
test("active-looking subscriptions without a verified bound payment never unlock management", async () => {
  const { venue, hall } = await fixture({ paid: false, published: false });
  await Subscription.updateOne(
    { hallId: hall._id },
    {
      $set: {
        status: "active",
        currentPeriodStart: new Date(Date.now() - 1000),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        activePaymentId: new mongoose.Types.ObjectId(),
        planSnapshot: {
          name: "Forged",
          amount: 12345,
          interval: "monthly",
          features: { publicWebsite: true, enquiries: true },
        },
      },
    },
  );
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 402);
  await assert.rejects(() => requireFeature(venue._id, hall._id, "publicWebsite"));
  const unpaidContext = await request("GET", hallBase(venue, hall) + "/access");
  assert.equal(unpaidContext.data.subscription.currentPeriodStart, undefined);
  assert.equal(unpaidContext.data.subscription.currentPeriodEnd, undefined);
  assert.equal(unpaidContext.data.subscription.planSnapshot, undefined);
  assert.equal(unpaidContext.data.subscription.remainingDays, 0);
  const paid = await fixture(),
    paidSub = await Subscription.findOne({ hallId: paid.hall._id });
  await Subscription.updateOne(
    { hallId: hall._id },
    { $set: { activePaymentId: paidSub.activePaymentId, planId: paidSub.planId } },
  );
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 402);
  await Subscription.updateOne({ hallId: paid.hall._id }, { $set: { currentPeriodStart: null } });
  assert.equal((await request("GET", hallBase(paid.venue, paid.hall) + "/overview")).status, 402);
  await Subscription.updateOne(
    { hallId: paid.hall._id },
    { $set: { currentPeriodStart: paidSub.currentPeriodStart, currentPeriodEnd: null } },
  );
  assert.equal((await request("GET", hallBase(paid.venue, paid.hall) + "/overview")).status, 402);
});
test("verified activation unlocks only the paid hall and owner hall selection shows safe accurate validity", async () => {
  const { venue, hall } = await fixture(),
    added = await request("POST", `/venues/${venue._id}/halls`, {
      name: "Unpaid sibling",
      capacity: 100,
    }),
    sibling = added.data.hall;
  assert.equal(added.status, 201);
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 200);
  assert.equal((await request("GET", hallBase(venue, sibling) + "/overview")).status, 402);
  const actual = await Subscription.findOne({ hallId: hall._id }),
    selection = await request("GET", `/venues/${venue._id}/halls`);
  assert.equal(selection.status, 200);
  const paidSummary = selection.data.halls.find((h) => h._id === String(hall._id)).subscription,
    unpaidSummary = selection.data.halls.find((h) => h._id === String(sibling._id)).subscription;
  assert.equal(paidSummary.dashboardAccess, true);
  assert.equal(unpaidSummary.dashboardAccess, false);
  assert.equal(
    new Date(paidSummary.currentPeriodStart).getTime(),
    actual.currentPeriodStart.getTime(),
  );
  assert.equal(new Date(paidSummary.currentPeriodEnd).getTime(), actual.currentPeriodEnd.getTime());
  assert.equal(
    paidSummary.remainingDays,
    Math.ceil((actual.currentPeriodEnd - Date.now()) / 86400000),
  );
  for (const summary of [paidSummary, unpaidSummary]) {
    for (const secret of [
      "checkoutDraft",
      "checkoutLock",
      "activePaymentId",
      "razorpayPaymentId",
      "ownerId",
    ])
      assert.equal(summary[secret], undefined);
  }
  const venues = await request("GET", "/venues");
  const listed = venues.data.venues.find((v) => v._id === String(venue._id));
  assert.equal(listed.halls.length, 2);
  assert.equal(
    listed.halls.find((h) => h._id === String(hall._id)).subscription.dashboardAccess,
    true,
  );
  // A paid hall cannot be selected through another venue, even under the same owner.
  const foreign = await fixture({ paid: false, published: false });
  assert.equal((await request("GET", hallBase(foreign.venue, hall) + "/overview")).status, 404);
  const publicVenue = await request("GET", `/public/venues/${venue.slug}`, undefined, null);
  assert.deepEqual(
    publicVenue.data.halls.map((h) => h._id),
    [String(hall._id)],
  );
});
test("expired hall retains bookings customers manual payments and details; verified renewal restores access", async () => {
  const { venue, hall } = await fixture(),
    created = await createEnquiry(venue, enquiry(hall)),
    booking = await Booking.findOne({ reference: created.reference });
  await transitionBooking(venue._id, booking._id, "CONFIRMED", owner._id);
  await recordPayment(
    venue._id,
    {
      bookingId: String(booking._id),
      amount: 10000,
      type: "RECEIPT",
      method: "cash",
      reference: "EXPIRY-RETAIN",
      idempotencyKey: crypto.randomUUID(),
    },
    owner._id,
  );
  await Subscription.updateOne(
    { hallId: hall._id },
    {
      $set: {
        currentPeriodStart: new Date(Date.now() - 31 * 86400000),
        currentPeriodEnd: new Date(Date.now() - 1000),
      },
    },
  );
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 402);
  assert.equal((await request("GET", `/public/venues/${venue.slug}`, undefined, null)).status, 200);
  assert.equal(
    (
      await request(
        "POST",
        `/public/venues/${venue.slug}/halls/${hall._id}/quote`,
        { model: "HOURLY", startAt: "2035-01-10T10:00", endAt: "2035-01-10T14:00" },
        null,
      )
    ).status,
    402,
  );
  assert.equal((await request("GET", `/venues/${venue._id}`)).status, 200);
  assert.ok(await Hall.exists({ _id: hall._id }));
  assert.ok(await Booking.exists({ _id: booking._id }));
  assert.ok(await Customer.exists({ _id: booking.customerId }));
  assert.equal(await Payment.countDocuments({ hallId: hall._id }), 1);
  assert.equal(await SubscriptionPayment.countDocuments({ hallId: hall._id }), 1);
  const selection = await request("GET", `/venues/${venue._id}/halls`),
    summary = selection.data.halls.find((h) => h._id === String(hall._id)).subscription;
  assert.equal(summary.status, "expired");
  assert.equal(summary.remainingDays, 0);
  assert.equal(summary.dashboardAccess, false);
  const sub = await Subscription.findOne({ hallId: hall._id });
  await payForHall(venue._id, hall._id, await SubscriptionPlan.findById(sub.planId));
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 200);
  assert.equal(await Booking.countDocuments({ hallId: hall._id }), 1);
  assert.equal(await SubscriptionPayment.countDocuments({ hallId: hall._id }), 2);
});
test("failed captures, modified amounts and payment identity from another hall never activate", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture(),
    checkout = await createCheckout(venue._id, hall._id, plan._id, gateway);
  gateway.remote.get(checkout.orderId).status = "paid";
  const input = signedCapture(checkout.orderId, `pay_Failed${++sequence}`),
    fetchPayment = gateway.payments.fetch;
  gateway.payments.fetch = async (id) => ({ ...(await fetchPayment(id)), status: "failed" });
  await assert.rejects(
    () => verifySubscriptionPayment(venue._id, hall._id, input, gateway),
    /captur/i,
  );
  gateway.payments.fetch = async (id) => ({ ...(await fetchPayment(id)), amount: 1 });
  await assert.rejects(
    () => verifySubscriptionPayment(venue._id, hall._id, input, gateway),
    /captur|amount/i,
  );
  const added = await request("POST", `/venues/${venue._id}/halls`, {
    name: "Independent second hall",
    capacity: 50,
  });
  await assert.rejects(
    () => verifySubscriptionPayment(venue._id, added.data.hall._id, input, gateway),
    /not found/i,
  );
  const record = await SubscriptionPayment.findOne({ hallId: hall._id });
  assert.equal(String(record.ownerId), String(owner._id));
  assert.equal(String(record.hallId), String(hall._id));
  assert.equal(record.status, "created");
  assert.equal((await request("GET", hallBase(venue, hall) + "/overview")).status, 402);
  gateway.payments.fetch = fetchPayment;
  await verifySubscriptionPayment(venue._id, hall._id, input, gateway);
  const secondCheckout = await createCheckout(venue._id, added.data.hall._id, plan._id, gateway);
  assert.notEqual(secondCheckout.orderId, checkout.orderId);
  gateway.remote.get(secondCheckout.orderId).status = "paid";
  gateway.payments.fetch = async (id) => ({
    ...(await fetchPayment(id)),
    order_id: secondCheckout.orderId,
  });
  await assert.rejects(() =>
    verifySubscriptionPayment(
      venue._id,
      added.data.hall._id,
      signedCapture(secondCheckout.orderId, input.razorpay_payment_id),
      gateway,
    ),
  );
  assert.equal((await request("GET", hallBase(venue, added.data.hall) + "/overview")).status, 402);
});
test("paid hall routes cannot forge resources belonging to another hall", async () => {
  const { venue, hall } = await fixture(),
    added = await request("POST", `/venues/${venue._id}/halls`, {
      name: "Paid sibling",
      capacity: 500,
    }),
    sibling = await Hall.findById(added.data.hall._id);
  await payForHall(venue._id, sibling._id);
  await configureHall(venue._id, sibling._id);
  const receipt = await createEnquiry(venue, enquiry(sibling)),
    booking = await Booking.findOne({ reference: receipt.reference }),
    base = hallBase(venue, hall);
  assert.equal(
    (await request("PATCH", `${base}/bookings/${booking._id}`, { status: "CONFIRMED" })).status,
    404,
  );
  assert.equal(
    (
      await request("PATCH", `${base}/customers/${booking.customerId}`, {
        name: "Stolen",
        phone: "9876543210",
        email: "",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("POST", `${base}/payments`, {
        bookingId: String(booking._id),
        amount: 10000,
        type: "RECEIPT",
        method: "cash",
        reference: "WRONG-HALL",
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("POST", `${base}/blocks`, {
        hallId: String(sibling._id),
        startAt: "2035-01-11T10:00",
        endAt: "2035-01-11T12:00",
        type: "MAINTENANCE",
        reason: "Wrong hall",
      })
    ).status,
    404,
  );
  const bookings = await request("GET", base + "/bookings");
  assert.equal(bookings.data.total, 0);
  assert.equal((await request("GET", base + "/customers")).data.total, 0);
  assert.equal(
    (
      await request(
        "GET",
        `${base}/availability/${sibling._id}?startAt=2035-01-10T10:00&endAt=2035-01-10T12:00`,
      )
    ).status,
    404,
  );
});
async function billingFixture() {
  const f = await fixture({ paid: false, published: false });
  return { ...f, plan: await testPlan() };
}
function gatewayFixture() {
  const prefix = ++sequence,
    orders = new Map();
  let count = 0;
  return {
    orders: {
      create: async (options) => {
        count++;
        const r = { ...options, id: `order_Test${prefix}n${count}`, status: "created" };
        orders.set(r.id, r);
        return r;
      },
      all: async ({ receipt }) => {
        const items = [...orders.values()].filter((o) => o.receipt === receipt);
        return { items, count: items.length };
      },
      fetch: async (id) => orders.get(id),
    },
    payments: {
      fetch: async (id) => ({
        id,
        status: "captured",
        amount: 12345,
        currency: "INR",
        order_id: [...orders.keys()][0],
        amount_refunded: 0,
      }),
    },
    remote: orders,
    count: () => count,
  };
}
test("concurrent subscription checkout creates one provider order and reuses its persisted quote", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture();
  const attempts = await Promise.allSettled([
    createCheckout(venue._id, hall._id, plan._id, gateway),
    createCheckout(venue._id, hall._id, plan._id, gateway),
  ]);
  assert.equal(gateway.count(), 1);
  assert.ok(attempts.some((r) => r.status === "fulfilled"));
  const order = await createCheckout(venue._id, hall._id, plan._id, gateway);
  assert.equal(order.amount, 12345);
  assert.equal(gateway.count(), 1);
  assert.equal(await SubscriptionPayment.countDocuments({ venueId: venue._id }), 1);
  const pending = await request("GET", `${hallBase(venue, hall)}/subscription`);
  assert.equal(pending.status, 200);
  assert.equal(pending.data.subscription.status, "payment_pending");
  assert.equal(pending.data.subscription.planSnapshot.name, plan.name);
  assert.equal(pending.data.subscription.dashboardAccess, false);
  assert.equal(pending.data.dashboardAccess, false);
});
test("uncertain provider creation keeps a recoverable lock and cannot silently create another charge", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture(),
    create = gateway.orders.create;
  gateway.orders.create = async (options) => {
    await create(options);
    throw new Error("provider timeout after creation");
  };
  await assert.rejects(() => createCheckout(venue._id, hall._id, plan._id, gateway), /Reconcile/i);
  assert.ok((await Subscription.findOne({ venueId: venue._id })).checkoutLock);
  await assert.rejects(
    () => createCheckout(venue._id, hall._id, plan._id, gateway),
    /reconciliation/i,
  );
  await recoverCheckout(venue._id, hall._id, gateway);
  assert.equal((await Subscription.findOne({ venueId: venue._id })).checkoutLock, null);
  assert.equal(await SubscriptionPayment.countDocuments({ venueId: venue._id }), 1);
  assert.equal(gateway.count(), 1);
});
test("captured webhook recovers a timed-out checkout draft; unknown hall captures remain retryable", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture(),
    create = gateway.orders.create;
  gateway.orders.create = async (options) => {
    await create(options);
    throw new Error("provider timeout after order creation");
  };
  await assert.rejects(() => createCheckout(venue._id, hall._id, plan._id, gateway), /Reconcile/i);
  const order = [...gateway.remote.values()][0];
  order.status = "paid";
  assert.equal(await SubscriptionPayment.countDocuments({ hallId: hall._id }), 0);
  assert.ok((await Subscription.findOne({ hallId: hall._id })).checkoutLock);
  process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET = "test-only-webhook-secret";
  const sdk = getRazorpay(),
    ordersMock = mock.method(sdk.orders, "fetch", async (id) => gateway.remote.get(id)),
    paymentsMock = mock.method(sdk.payments, "fetch", async (id) => ({
      id,
      status: "captured",
      order_id: order.id,
      amount: 12345,
      currency: "INR",
      amount_refunded: 0,
    }));
  const send = (orderId, paymentId) => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
    });
    const signature = crypto
      .createHmac("sha256", process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");
    return fetch(`${url}/api/webhooks/subscriptions/razorpay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
      body,
    });
  };
  try {
    const recovered = await send(order.id, "pay_RecoveredCapture");
    assert.equal(recovered.status, 200, await recovered.text());
    const sub = await Subscription.findOne({ hallId: hall._id }),
      record = await SubscriptionPayment.findOne({ hallId: hall._id });
    assert.equal(sub.checkoutLock, null);
    assert.equal(sub.checkoutDraft, null);
    assert.equal(sub.status, "active");
    assert.equal(record.status, "paid");
    assert.equal(String(record.hallId), String(hall._id));
    assert.equal(String(record.subscriptionId), String(sub._id));
    const end = sub.currentPeriodEnd.getTime();
    assert.equal((await send(order.id, "pay_RecoveredCapture")).status, 200);
    assert.equal((await Subscription.findById(sub._id)).currentPeriodEnd.getTime(), end);
    const missing = { ...order, id: "order_UnknownHallCapture", receipt: "unknown-local-draft" };
    gateway.remote.set(missing.id, missing);
    assert.equal((await send(missing.id, "pay_UnknownHallCapture")).status, 503);
    assert.equal(await SubscriptionPayment.countDocuments({ razorpayOrderId: missing.id }), 0);
    const unrelated = {
      ...missing,
      id: "order_UnrelatedCapture",
      notes: { product: "unrelated_product" },
    };
    gateway.remote.set(unrelated.id, unrelated);
    assert.equal((await send(unrelated.id, "pay_UnrelatedCapture")).status, 200);
    assert.equal(await SubscriptionPayment.countDocuments({ razorpayOrderId: unrelated.id }), 0);
    assert.equal(gateway.count(), 1);
  } finally {
    ordersMock.mock.restore();
    paymentsMock.mock.restore();
    delete process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET;
  }
});
test("verified capture activation and renewal remain atomic and idempotent under concurrent delivery", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture(),
    order = await createCheckout(venue._id, hall._id, plan._id, gateway);
  gateway.remote.get(order.orderId).status = "paid";
  const signature = crypto
    .createHmac("sha256", process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET)
    .update(`${order.orderId}|pay_Test1`)
    .digest("hex");
  const input = {
    razorpay_order_id: order.orderId,
    razorpay_payment_id: "pay_Test1",
    razorpay_signature: signature,
  };
  await Promise.all([
    verifySubscriptionPayment(venue._id, hall._id, input, gateway),
    verifySubscriptionPayment(venue._id, hall._id, input, gateway),
  ]);
  const first = await Subscription.findOne({ venueId: venue._id });
  assert.equal(first.status, "active");
  const end = first.currentPeriodEnd.getTime();
  const record = await SubscriptionPayment.findOne({ venueId: venue._id });
  await activateCaptured(record, "pay_Test1");
  assert.equal(
    (await Subscription.findOne({ venueId: venue._id })).currentPeriodEnd.getTime(),
    end,
  );
  await assert.rejects(
    () =>
      verifySubscriptionPayment(
        venue._id,
        hall._id,
        { ...input, razorpay_signature: "0".repeat(64) },
        gateway,
      ),
    /signature/,
  );
  await assert.rejects(() => activateCaptured(record, "pay_other"), /identity/);
  await assert.rejects(
    () => createCheckout(venue._id, hall._id, plan._id, gateway),
    /active|expir|renew/i,
  );
  await Subscription.updateOne(
    { hallId: hall._id },
    {
      $set: {
        currentPeriodStart: new Date(Date.now() - 31 * 86400000),
        currentPeriodEnd: new Date(Date.now() - 1000),
      },
    },
  );
  const renewedAt = Date.now();
  const renewal = await createCheckout(venue._id, hall._id, plan._id, gateway);
  gateway.remote.get(renewal.orderId).status = "paid";
  gateway.payments.fetch = async (id) => ({
    id,
    status: "captured",
    amount: 12345,
    currency: "INR",
    order_id: renewal.orderId,
    amount_refunded: 0,
  });
  const renewedInput = {
    razorpay_order_id: renewal.orderId,
    razorpay_payment_id: "pay_Renewal",
    razorpay_signature: crypto
      .createHmac("sha256", process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET)
      .update(`${renewal.orderId}|pay_Renewal`)
      .digest("hex"),
  };
  await Promise.all([
    verifySubscriptionPayment(venue._id, hall._id, renewedInput, gateway),
    verifySubscriptionPayment(venue._id, hall._id, renewedInput, gateway),
  ]);
  const renewed = await Subscription.findOne({ venueId: venue._id });
  assert.ok(renewed.currentPeriodStart.getTime() >= renewedAt);
  assert.equal(renewed.currentPeriodEnd - renewed.currentPeriodStart, 90 * 86400000);
});
test("raw HTTP webhook signatures, provider capture checks and duplicate delivery gate subscription activation", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture(),
    checkout = await createCheckout(venue._id, hall._id, plan._id, gateway);
  gateway.remote.get(checkout.orderId).status = "paid";
  process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET = "test-only-webhook-secret";
  const sdk = getRazorpay(),
    ordersMock = mock.method(sdk.orders, "fetch", async (id) => gateway.remote.get(id)),
    paymentsMock = mock.method(sdk.payments, "fetch", async (id) => ({
      id,
      status: "captured",
      order_id: checkout.orderId,
      amount: 12345,
      currency: "INR",
      amount_refunded: 0,
    }));
  try {
    const body = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_Webhook", order_id: checkout.orderId } } },
      }),
      signature = crypto
        .createHmac("sha256", process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest("hex");
    const send = (signature) =>
      fetch(`${url}/api/webhooks/subscriptions/razorpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
        body,
      });
    assert.equal((await send("0".repeat(64))).status, 400);
    assert.equal((await Subscription.findOne({ venueId: venue._id })).status, "pending");
    const deliveries = await Promise.all([
      send(signature),
      send(signature),
      verifySubscriptionPayment(
        venue._id,
        hall._id,
        signedCapture(checkout.orderId, "pay_Webhook"),
        gateway,
      ),
    ]);
    assert.equal(deliveries[0].status, 200);
    assert.equal(deliveries[1].status, 200);
    const active = await Subscription.findOne({ venueId: venue._id });
    assert.equal(active.currentPeriodEnd - active.currentPeriodStart, 90 * 86400000);
    const end = active.currentPeriodEnd.getTime();
    assert.equal((await send(signature)).status, 200);
    assert.equal(
      (await Subscription.findOne({ venueId: venue._id })).currentPeriodEnd.getTime(),
      end,
    );
  } finally {
    ordersMock.mock.restore();
    paymentsMock.mock.restore();
    delete process.env.VENUE_SUBSCRIPTION_RAZORPAY_WEBHOOK_SECRET;
  }
});
test("refund/dispute redelivery triggers one review and cannot revoke a newer purchase", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture();
  await createCheckout(venue._id, hall._id, plan._id, gateway);
  const record = await SubscriptionPayment.findOne({ venueId: venue._id });
  await activateCaptured(record, "pay_Financial");
  await processFinancialEvent("refund.processed", "pay_Financial", "refund.processed:refund_1");
  await processFinancialEvent("refund.processed", "pay_Financial", "refund.processed:refund_1");
  assert.equal((await SubscriptionPayment.findById(record._id)).financialEventKeys.length, 1);
  assert.equal((await Subscription.findOne({ venueId: venue._id })).status, "review_required");
  await Subscription.updateOne(
    { venueId: venue._id },
    { $set: { status: "active", activePaymentId: new mongoose.Types.ObjectId() } },
  );
  await processFinancialEvent(
    "payment.dispute.created",
    "pay_Financial",
    "payment.dispute.created:dispute_1",
  );
  assert.equal((await Subscription.findOne({ venueId: venue._id })).status, "active");
});
test("platform administration is role-protected, reads environment plans and suspends/reactivates venue owners", async () => {
  assert.equal((await request("GET", "/admin/overview")).status, 403);
  const created = await request(
    "POST",
    "/admin/plans",
    {
      name: "Admin Test Plan",
      code: "admin-test-plan",
      amount: 25000,
      interval: "monthly",
      features: { publicWebsite: true, enquiries: true },
    },
    adminCookie,
  );
  assert.equal(created.status, 403);
  const catalog = await request("GET", "/admin/plans", undefined, adminCookie);
  assert.equal(catalog.status, 200);
  assert.deepEqual(
    catalog.data.plans.map((p) => p.code),
    ["venue-3-months", "venue-1-year"],
  );
  assert.deepEqual(
    catalog.data.plans.map((p) => p.amount),
    [12345, 99900],
  );
  const person = await User.create({
    name: "Suspension Owner",
    email: "suspend@example.test",
    password: "Password123!",
    emailVerified: true,
  });
  const v = await Venue.create({
    ownerId: person._id,
    name: "Suspension Venue",
    slug: "suspension-venue",
    timezone: "Asia/Kolkata",
  });
  assert.equal(
    (
      await request(
        "PATCH",
        `/admin/users/${person._id}/suspension`,
        { suspended: true },
        adminCookie,
      )
    ).status,
    200,
  );
  assert.equal((await request("GET", "/auth/me", undefined, cookie(person))).status, 401);
  assert.equal((await Venue.findById(v._id)).suspended, true);
  assert.equal(
    (
      await request(
        "PATCH",
        `/admin/users/${person._id}/suspension`,
        { suspended: false },
        adminCookie,
      )
    ).status,
    200,
  );
  assert.equal((await Venue.findById(v._id)).suspended, false);
  const users = await request("GET", "/admin/users", undefined, adminCookie);
  assert.equal(
    users.data.items.some((u) => "password" in u || "passwordResetOtpHash" in u),
    false,
  );
});

test("environment repricing retains existing checkout snapshots and annual activation grants 365 days", async () => {
  const { venue, hall, plan } = await billingFixture(),
    gateway = gatewayFixture();
  const first = await createCheckout(venue._id, hall._id, plan._id, gateway);
  try {
    process.env.VENUE_PLAN_3_MONTHS_PRICE = "222.22";
    const plans = await syncEnvironmentPlans();
    assert.equal(plans.find((p) => p.interval === "quarterly").amount, 22222);
    const reused = await createCheckout(venue._id, hall._id, plan._id, gateway);
    assert.equal(reused.orderId, first.orderId);
    assert.equal(reused.amount, 12345);
    gateway.remote.get(first.orderId).status = "paid";
    await verifySubscriptionPayment(
      venue._id,
      hall._id,
      signedCapture(first.orderId, `pay_Reprice${++sequence}`),
      gateway,
    );
    const paid = await Subscription.findOne({ hallId: hall._id });
    assert.equal(paid.planSnapshot.amount, 12345);
    assert.equal(paid.currentPeriodEnd - paid.currentPeriodStart, 90 * 86400000);
  } finally {
    process.env.VENUE_PLAN_3_MONTHS_PRICE = "123.45";
    await syncEnvironmentPlans();
  }
  const annualFixture = await fixture({ paid: false, published: false });
  const annual = (await syncEnvironmentPlans()).find((p) => p.interval === "yearly"),
    annualGateway = gatewayFixture();
  const checkout = await createCheckout(
    annualFixture.venue._id,
    annualFixture.hall._id,
    annual._id,
    annualGateway,
  );
  annualGateway.remote.get(checkout.orderId).status = "paid";
  const fetchPayment = annualGateway.payments.fetch;
  annualGateway.payments.fetch = async (id) => ({ ...(await fetchPayment(id)), amount: 99900 });
  await verifySubscriptionPayment(
    annualFixture.venue._id,
    annualFixture.hall._id,
    signedCapture(checkout.orderId, `pay_Annual${++sequence}`),
    annualGateway,
  );
  const active = await Subscription.findOne({ hallId: annualFixture.hall._id });
  assert.equal(active.planSnapshot.interval, "yearly");
  assert.equal(active.currentPeriodEnd - active.currentPeriodStart, 365 * 86400000);
  const legacy = await SubscriptionPlan.create({
    name: "Old monthly plan",
    code: "legacy-monthly",
    amount: 999,
    interval: "monthly",
  });
  await assert.rejects(
    () =>
      createCheckout(annualFixture.venue._id, annualFixture.hall._id, legacy._id, annualGateway),
    /Plan not available/,
  );
});

test("multipart image uploads return a gallery URL and specific storage-permission failures", async () => {
  const { venue, hall } = await fixture(),
    base = hallBase(venue, hall);
  const keys = [
    "VENUE_CLOUDINARY_CLOUD_NAME",
    "VENUE_CLOUDINARY_API_KEY",
    "VENUE_CLOUDINARY_API_SECRET",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.VENUE_CLOUDINARY_CLOUD_NAME = "disposable-test-cloud";
  process.env.VENUE_CLOUDINARY_API_KEY = "12345";
  process.env.VENUE_CLOUDINARY_API_SECRET = "disposable-image-test-secret";
  const sdk = getCloudinary();
  let providerError = null,
    receivedOptions,
    receivedBytes = 0;
  const uploadMock = mock.method(sdk.uploader, "upload_stream", (options, callback) => {
    receivedOptions = options;
    return new Writable({
      write(chunk, _encoding, done) {
        receivedBytes += chunk.length;
        done();
      },
      final(done) {
        callback(
          providerError,
          providerError
            ? undefined
            : {
                secure_url: "https://res.cloudinary.com/disposable-test/image/upload/gallery.png",
                public_id: "disposable-gallery",
              },
        );
        done();
      },
    });
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/W1sAAAAASUVORK5CYII=",
    "base64",
  );
  const send = async (bytes = png, type = "image/png") => {
    const body = new FormData();
    body.append("photo", new Blob([bytes], { type }), "test-image.png");
    const response = await fetch(`${url}/api${base}/images`, {
      method: "POST",
      headers: { cookie: ownerCookie, "X-Requested-With": "venue-dashboard" },
      body,
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const success = await send();
    assert.equal(success.status, 201, JSON.stringify(success.data));
    assert.equal(
      success.data.image.url,
      "https://res.cloudinary.com/disposable-test/image/upload/gallery.png",
    );
    assert.equal(receivedBytes, png.length);
    assert.equal(receivedOptions.folder, `prakash-venue/venues/${venue._id}/gallery`);
    assert.equal(receivedOptions.resource_type, "image");
    providerError = { http_code: 403, message: "Server returned unexpected status code - 403" };
    const denied = await send();
    assert.equal(denied.status, 503);
    assert.equal(denied.data.code, "IMAGE_STORAGE_PERMISSIONS");
    assert.match(denied.data.message, /upload\/create/);
    assert.equal((await send(Buffer.from("not-a-png"))).status, 400);
    assert.equal((await send(Buffer.alloc(3 * 1024 * 1024 + 1))).status, 400);
  } finally {
    uploadMock.mock.restore();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("website customization persists future templates, appearance and partial section edits behind paid owner access", async () => {
  const { venue, hall } = await fixture();
  const path = hallBase(venue, hall) + "/venue-profile";
  const initial = await request("PATCH", path, {
    website: {
      template: "royal-wedding-future",
      appearance: "dark",
      headline: "A celebration made yours",
      tagline: "A real venue, your own design",
      accent: "#234567",
      sections: { about: false, gallery: false },
    },
  });
  assert.equal(initial.status, 200, JSON.stringify(initial.data));
  const partial = await request("PATCH", path, { website: { sections: { contact: false } } });
  assert.equal(partial.status, 200, JSON.stringify(partial.data));
  const refreshed = await request("GET", `/venues/${venue._id}`);
  const settings = refreshed.data.venue.website;
  assert.equal(settings.template, "royal-wedding-future");
  assert.equal(settings.appearance, "dark");
  assert.equal(settings.headline, "A celebration made yours");
  assert.equal(settings.tagline, "A real venue, your own design");
  assert.equal(settings.accent, "#234567");
  assert.deepEqual(settings.sections, {
    about: false,
    halls: true,
    gallery: false,
    facilities: true,
    contact: false,
  });
  assert.equal(refreshed.data.venue.contact.phone, "9876543210");
  const publicResult = await request("GET", `/public/venues/${venue.slug}`, undefined, null);
  assert.equal(publicResult.data.venue.website.template, "royal-wedding-future");
  assert.equal(publicResult.data.venue.website.sections.contact, false);
  for (const website of [
    { template: "../invalid" },
    { appearance: "automatic" },
    { sections: { unsupported: false } },
  ])
    assert.equal((await request("PATCH", path, { website })).status, 400);
  assert.equal(
    (await request("PATCH", path, { website: { appearance: "light" } }, otherCookie)).status,
    404,
  );
  const unpaid = await fixture({ paid: false, published: false });
  assert.equal(
    (
      await request("PATCH", hallBase(unpaid.venue, unpaid.hall) + "/venue-profile", {
        website: { template: "royal-wedding-future", appearance: "dark" },
      })
    ).status,
    402,
  );
  assert.equal(
    (await request("PATCH", `/venues/${venue._id}`, { website: { appearance: "light" } })).status,
    402,
  );
});
