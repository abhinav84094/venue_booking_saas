import test from "node:test";
import assert from "node:assert/strict";
import { readEnvironmentPlans, subscriptionDurationDays } from "../config/subscriptionPlans.js";

test("environment prices create only 3-month and annual plans with exact rupee conversion", () => {
  const plans = readEnvironmentPlans({
    VENUE_PLAN_3_MONTHS_PRICE: "0.29",
    VENUE_PLAN_1_YEAR_PRICE: "1234.56",
  });
  assert.deepEqual(
    plans.map((p) => [p.code, p.amount, p.interval, p.durationDays]),
    [
      ["venue-3-months", 29, "quarterly", 90],
      ["venue-1-year", 123456, "yearly", 365],
    ],
  );
  assert.ok(
    plans.every((p) => p.currency === "INR" && p.features.publicWebsite && p.features.enquiries),
  );
});
test("blank environment prices never invent a free or default plan; invalid prices fail clearly", () => {
  assert.deepEqual(readEnvironmentPlans({}), []);
  assert.deepEqual(
    readEnvironmentPlans({ VENUE_PLAN_3_MONTHS_PRICE: "  ", VENUE_PLAN_1_YEAR_PRICE: "" }),
    [],
  );
  for (const value of ["0", "-1", "1.001", "1e3", "NaN", "Infinity", "1000000001"])
    assert.throws(
      () => readEnvironmentPlans({ VENUE_PLAN_3_MONTHS_PRICE: value }),
      /VENUE_PLAN_3_MONTHS_PRICE/,
    );
});
test("validity snapshots preserve legacy monthly purchases and reject inconsistent new periods", () => {
  assert.equal(subscriptionDurationDays({ interval: "monthly" }), 30);
  assert.equal(subscriptionDurationDays({ interval: "quarterly", durationDays: 90 }), 90);
  assert.equal(subscriptionDurationDays({ interval: "yearly", durationDays: 365 }), 365);
  assert.throws(() => subscriptionDurationDays({ interval: "quarterly", durationDays: 365 }));
  assert.throws(() => subscriptionDurationDays({ interval: "unknown" }));
});
