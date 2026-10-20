import { must } from "../utils/errors.js";

export const environmentPlanDefinitions = [
  {
    code: "venue-3-months",
    name: "3 Months",
    interval: "quarterly",
    durationDays: 90,
    variable: "VENUE_PLAN_3_MONTHS_PRICE",
  },
  {
    code: "venue-1-year",
    name: "1 Year",
    interval: "yearly",
    durationDays: 365,
    variable: "VENUE_PLAN_1_YEAR_PRICE",
  },
];

export function readEnvironmentPlans(env = process.env) {
  return environmentPlanDefinitions.flatMap(({ variable, ...definition }) => {
    const raw = String(env[variable] ?? "").trim();
    if (!raw) return [];
    must(
      /^\d+(?:\.\d{1,2})?$/.test(raw),
      `${variable} must be a positive rupee price with at most 2 decimal places`,
      500,
    );
    const [whole, decimals = ""] = raw.split(".");
    const amount = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
    must(
      Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_000,
      `${variable} must be a positive rupee price within the supported range`,
      500,
    );
    return [
      {
        ...definition,
        amount,
        currency: "INR",
        active: true,
        features: { publicWebsite: true, enquiries: true },
      },
    ];
  });
}

export function subscriptionDurationDays(snapshot) {
  const days = { monthly: 30, quarterly: 90, yearly: 365 }[snapshot?.interval];
  must(
    days && (!snapshot.durationDays || snapshot.durationDays === days),
    "Invalid subscription validity snapshot",
    409,
  );
  return days;
}
