import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionAction, subscriptionValidity } from "../src/utils/hallSubscription.js";

test("hall validity uses actual instants and an exclusive expiration boundary", () => {
  const subscription = {
    status: "active",
    currentPeriodStart: "2030-01-01T00:00:00Z",
    currentPeriodEnd: "2030-01-31T00:00:00Z",
    planSnapshot: { name: "Hall Monthly" },
    dashboardAccess: true,
  };
  const value = subscriptionValidity(
    subscription,
    "Asia/Kolkata",
    Date.parse("2030-01-30T23:59:59Z"),
  );
  assert.equal(value.remainingDays, 1);
  assert.match(value.activated, /1 Jan 2030/);
  assert.match(value.expires, /31 Jan 2030/);
  assert.equal(value.plan, "Hall Monthly");
  assert.equal(
    subscriptionValidity(subscription, "Asia/Kolkata", Date.parse(subscription.currentPeriodEnd))
      .remainingDays,
    0,
  );
});

test("validity display never derives access from an active status or future date", () => {
  const future = { status: "active", currentPeriodEnd: "2099-01-01T00:00:00Z" };
  assert.equal(subscriptionValidity(future).dashboardAccess, false);
  assert.equal(subscriptionValidity({ ...future, dashboardAccess: "true" }).dashboardAccess, false);
  assert.equal(subscriptionValidity(undefined).status, "pending");
  assert.equal(subscriptionValidity(undefined).remainingDays, 0);
  assert.equal(subscriptionValidity({ currentPeriodEnd: "invalid" }).expires, "Not activated");
  assert.equal(subscriptionValidity({ ...future, remainingDays: 12 }).remainingDays, 12);
});

test("hall subscription actions keep pending payments and expiry explicit", () => {
  assert.equal(subscriptionAction({ status: "expired" }), "Renew subscription");
  assert.equal(subscriptionAction({ status: "payment_pending" }), "Complete payment");
  assert.equal(subscriptionAction({ status: "active" }), "View subscription");
  assert.equal(subscriptionAction(undefined), "Choose plan & pay");
});
