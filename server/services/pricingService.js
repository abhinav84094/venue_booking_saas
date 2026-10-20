import { DateTime } from "luxon";
import { must } from "../utils/errors.js";

// Local input is interpreted in the venue zone. Explicit offsets represent instants.
// Reject ambiguous/nonexistent local wall times rather than guessing at DST boundaries.
export function parseVenueTime(value, timezone) {
  must(typeof value === "string", "A valid date and time is required");
  const explicitOffset = /(?:Z|[+-]\d\d:\d\d)$/i.test(value);
  must(
    explicitOffset || /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value),
    "Use an ISO date with a time",
  );
  const dt = DateTime.fromISO(value, { zone: timezone, setZone: explicitOffset });
  must(dt.isValid, "Invalid date, time or time zone");
  if (!explicitOffset) {
    must(
      dt.toFormat("yyyy-MM-dd'T'HH:mm") === value.slice(0, 16),
      "This local time does not exist; include a UTC offset",
    );
    must(
      dt.getPossibleOffsets().length === 1,
      "This local time is ambiguous; include a UTC offset",
    );
  }
  must(dt.second === 0 && dt.millisecond === 0, "Use whole-minute booking times");
  return dt.setZone(timezone);
}
export function parseRange(
  input,
  timezone,
  { future = false, now = new Date(), maxDays = 366 } = {},
) {
  const start = parseVenueTime(input.startAt, timezone),
    end = parseVenueTime(input.endAt, timezone);
  must(end.toMillis() > start.toMillis(), "End must be after start");
  must(end.diff(start, "days").days <= maxDays, "Date range is too long");
  if (future) must(start.toMillis() > now.getTime(), "Choose a future booking time");
  return { startAt: start.toJSDate(), endAt: end.toJSDate(), start, end };
}
export function calculateQuote(hall, input, timezone, now = new Date()) {
  const { start, end, startAt, endAt } = parseRange(input, timezone, {
    future: true,
    now,
    maxDays: 7,
  });
  const rate = hall.pricing.find((r) => r.key === input.model);
  must(rate, "This pricing model is not enabled");
  const minutes = end.diff(start, "minutes").minutes;
  if (rate.key === "FULL_DAY")
    must(
      start.hour === 0 &&
        start.minute === 0 &&
        end.toMillis() === start.plus({ days: 1 }).toMillis(),
      "Full-day bookings run from local midnight to the next midnight",
    );
  else if (rate.key === "HALF_DAY")
    must(minutes === rate.durationMinutes, "Half-day duration must match the configured rate");
  else if (rate.key !== "HOURLY")
    must(minutes <= rate.durationMinutes, "This range exceeds the package duration");
  else
    must(
      minutes <= rate.durationMinutes,
      "This range exceeds the configured maximum hourly booking duration",
    );
  // Override applies to the local start date; the displayed quote preserves this rule.
  const date = start.toISODate();
  const override = rate.overrides?.find((v) => v.startDate <= date && v.endDate >= date);
  const unitAmount =
    override?.amount ??
    (start.weekday >= 6 && rate.weekendAmount != null ? rate.weekendAmount : rate.amount);
  const units = rate.key === "HOURLY" ? Math.ceil(minutes / 60) : 1;
  const totalAmount = unitAmount * units;
  must(
    Number.isSafeInteger(unitAmount) && unitAmount >= 0 && Number.isSafeInteger(totalAmount),
    "Invalid configured price",
  );
  return {
    startAt,
    endAt,
    pricingSnapshot: {
      model: rate.key,
      label: rate.label,
      unitAmount,
      units,
      totalAmount,
      currency: "INR",
      timezone,
      quotedAt: now,
    },
  };
}
export const overlaps = (a, b) =>
  new Date(a.startAt) < new Date(b.endAt) && new Date(a.endAt) > new Date(b.startAt);
