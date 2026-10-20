import crypto from "node:crypto";
import { transaction, audit } from "./persistenceService.js";
import {
  Booking,
  Hall,
  Venue,
  Customer,
  AvailabilityBlock,
  Payment,
} from "../models/venueModels.js";
import { calculateQuote, parseRange } from "./pricingService.js";
import { requireHallEntitlement, requireFeature } from "./subscriptions/accessService.js";
import { must } from "../utils/errors.js";

export { transaction, audit } from "./persistenceService.js";
const occupied = ["CONFIRMED", "COMPLETED"];
const overlapQuery = (range) => ({ startAt: { $lt: range.endAt }, endAt: { $gt: range.startAt } });
export async function lockHall(venueId, hallId, session, { active = false } = {}) {
  const hall = await Hall.findOneAndUpdate(
    { _id: hallId, venueId, ...(active ? { active: true } : {}) },
    { $inc: { bookingVersion: 1 } },
    { session, returnDocument: "after" },
  );
  must(hall, "Hall not found or inactive", 404);
  return hall;
}
export async function assertAvailable(venueId, hallId, range, session, excludeId) {
  const booking = await Booking.exists({
    venueId,
    hallId,
    status: { $in: occupied },
    ...overlapQuery(range),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).session(session);
  const block = await AvailabilityBlock.exists({ venueId, hallId, ...overlapQuery(range) }).session(
    session,
  );
  must(
    !booking && !block,
    "This hall has a confirmed event or unavailable period in that time range",
    409,
  );
}
export async function expireEnquiries(venueId, hallId) {
  const now = new Date();
  await Booking.updateMany(
    {
      venueId,
      ...(hallId ? { hallId } : {}),
      status: { $in: ["ENQUIRY", "PENDING"] },
      enquiryExpiresAt: { $lte: now },
    },
    { $set: { status: "EXPIRED" }, $push: { history: { status: "EXPIRED", at: now } } },
  );
}
export async function createEnquiry(venue, input) {
  const statusToken = crypto.randomBytes(32).toString("hex");
  return transaction(async (session) => {
    // Quote and availability use a single hall snapshot, serialized with pricing changes.
    const hall = await lockHall(venue._id, input.hallId, session, { active: true });
    must(hall.published, "Hall is not publicly available", 404);
    await requireFeature(venue._id, hall._id, "publicWebsite", session);
    await requireFeature(venue._id, hall._id, "enquiries", session);
    const currentVenue = await Venue.findOne({
      _id: venue._id,
      published: true,
      suspended: false,
    }).session(session);
    must(currentVenue, "Venue is unavailable", 404);
    must(input.guests <= hall.capacity, "Guest count exceeds this hall's capacity");
    const quote = calculateQuote(hall, input, currentVenue.timezone);
    if (input.expectedTotalAmount !== undefined)
      must(
        input.expectedTotalAmount === quote.pricingSnapshot.totalAmount,
        "Pricing changed. Request a fresh quote before sending the enquiry.",
        409,
      );
    await assertAvailable(venue._id, hall._id, quote, session);
    const phone = input.customer.phone.replace(/\D/g, "");
    const customer = await Customer.findOneAndUpdate(
      { venueId: venue._id, hallId: hall._id, phone },
      { $setOnInsert: { name: input.customer.name, email: input.customer.email } },
      { upsert: true, returnDocument: "after", session },
    );
    const hours = Number(process.env.VENUE_ENQUIRY_EXPIRY_HOURS || 72);
    must(
      Number.isFinite(hours) && hours > 0 && hours <= 720,
      "Invalid enquiry expiration configuration",
      500,
    );
    const [booking] = await Booking.create(
      [
        {
          venueId: venue._id,
          hallId: hall._id,
          customerId: customer._id,
          reference: `VB-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
          statusTokenHash: crypto.createHash("sha256").update(statusToken).digest("hex"),
          ...quote,
          timezone: currentVenue.timezone,
          eventType: input.eventType,
          guests: input.guests,
          notes: input.notes,
          enquiryExpiresAt: new Date(
            Math.min(quote.startAt.getTime(), Date.now() + hours * 3600000),
          ),
          history: [{ status: "ENQUIRY", at: new Date() }],
        },
      ],
      { session },
    );
    await audit("booking.enquiry", venue._id, undefined, booking._id, session);
    return {
      reference: booking.reference,
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      pricingSnapshot: booking.pricingSnapshot,
      enquiryExpiresAt: booking.enquiryExpiresAt,
      statusToken,
    };
  });
}
const transitions = {
  ENQUIRY: ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"],
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};
export async function transitionBooking(venueId, bookingId, status, actorId, hallId) {
  return transaction(async (session) => {
    const initial = await Booking.findOne({
      _id: bookingId,
      venueId,
      ...(hallId ? { hallId } : {}),
    }).session(session);
    must(initial, "Booking not found", 404);
    await requireHallEntitlement(venueId, initial.hallId, session);
    await lockHall(venueId, initial.hallId, session);
    const booking = await Booking.findOne({
      _id: bookingId,
      venueId,
      ...(hallId ? { hallId } : {}),
    }).session(session);
    if (booking.status === status) return booking;
    must(
      transitions[booking.status]?.includes(status),
      `Cannot change ${booking.status} to ${status}`,
      409,
    );
    if (["PENDING", "CONFIRMED"].includes(status))
      must(
        booking.enquiryExpiresAt > new Date() && booking.startAt > new Date(),
        "This enquiry has expired",
        409,
      );
    if (status === "CONFIRMED") {
      const hall = await Hall.findOne({ _id: booking.hallId, venueId, active: true }).session(
        session,
      );
      must(hall, "Activate the hall before confirming bookings", 409);
      await assertAvailable(venueId, booking.hallId, booking, session, booking._id);
    }
    if (status === "COMPLETED")
      must(booking.endAt <= new Date(), "An event can be completed only after it ends", 409);
    booking.status = status;
    booking.history.push({ status, at: new Date(), actorId });
    await booking.save({ session });
    await audit(`booking.${status.toLowerCase()}`, venueId, actorId, booking._id, session);
    return booking;
  });
}
export async function createBlock(venue, input, actorId) {
  const range = parseRange(input, venue.timezone, { maxDays: 366 });
  return transaction(async (session) => {
    await requireHallEntitlement(venue._id, input.hallId, session);
    await lockHall(venue._id, input.hallId, session);
    await assertAvailable(venue._id, input.hallId, range, session);
    const [block] = await AvailabilityBlock.create(
      [
        {
          venueId: venue._id,
          hallId: input.hallId,
          startAt: range.startAt,
          endAt: range.endAt,
          reason: input.reason,
          type: input.type,
          createdBy: actorId,
        },
      ],
      { session },
    );
    await audit("availability.block", venue._id, actorId, block._id, session);
    return block;
  });
}
export async function removeBlock(venueId, blockId, actorId, hallId) {
  return transaction(async (session) => {
    const block = await AvailabilityBlock.findOne({
      _id: blockId,
      venueId,
      ...(hallId ? { hallId } : {}),
    }).session(session);
    must(block, "Block not found", 404);
    await requireHallEntitlement(venueId, block.hallId, session);
    await lockHall(venueId, block.hallId, session);
    await AvailabilityBlock.deleteOne({ _id: block._id, venueId }, { session });
    await audit("availability.unblock", venueId, actorId, block._id, session);
  });
}
export async function getAvailability(venue, hallId, input, { isPublic = false } = {}) {
  must(
    await Hall.exists({
      _id: hallId,
      venueId: venue._id,
      ...(isPublic ? { active: true, published: true } : {}),
    }),
    "Hall not found",
    404,
  );
  if (isPublic) await requireFeature(venue._id, hallId, "publicWebsite");
  else await requireHallEntitlement(venue._id, hallId);
  const range = parseRange(input, venue.timezone, { maxDays: 93 });
  const filter = { venueId: venue._id, hallId, ...overlapQuery(range) };
  const [bookings, blocks] = await Promise.all([
    Booking.find({ ...filter, status: { $in: occupied } })
      .select("startAt endAt -_id")
      .lean(),
    AvailabilityBlock.find(filter)
      .select(isPublic ? "startAt endAt -_id" : "startAt endAt reason type")
      .lean(),
  ]);
  return {
    timezone: venue.timezone,
    startAt: range.startAt,
    endAt: range.endAt,
    busy: [
      ...bookings.map((b) => ({ ...b, type: "BOOKING" })),
      ...blocks.map((b) => ({ ...b, type: b.type || "UNAVAILABLE" })),
    ].sort((a, b) => a.startAt - b.startAt),
    policy:
      "Enquiries do not reserve a hall. Availability is rechecked atomically on confirmation.",
  };
}
export const bookingPaymentState = (booking) => {
  const net = booking.receivedAmount - booking.refundedAmount,
    total = booking.pricingSnapshot.totalAmount;
  return {
    netAmount: net,
    balanceAmount: Math.max(0, total - net),
    status:
      booking.refundedAmount > 0 && net === 0
        ? "REFUNDED"
        : net >= total
          ? "PAID"
          : net > 0
            ? "PARTIAL"
            : "UNPAID",
  };
};
export async function recordPayment(venueId, input, actorId, hallId) {
  return transaction(async (session) => {
    const existing = await Payment.findOne({
      venueId,
      idempotencyKey: input.idempotencyKey,
    }).session(session);
    if (existing) {
      must(!hallId || String(existing.hallId) === String(hallId), "Payment not found", 404);
      await requireHallEntitlement(venueId, existing.hallId, session);
      must(
        ["bookingId", "amount", "type", "method", "reference"].every(
          (k) => String(existing[k]) === String(input[k]),
        ),
        "Idempotency key was used for a different payment",
        409,
      );
      return existing;
    }
    const booking = await Booking.findOne({
      _id: input.bookingId,
      venueId,
      ...(hallId ? { hallId } : {}),
    }).session(session);
    must(booking, "Booking not found", 404);
    await requireHallEntitlement(venueId, booking.hallId, session);
    const net = booking.receivedAmount - booking.refundedAmount;
    if (input.type === "RECEIPT") {
      must(
        ["CONFIRMED", "COMPLETED"].includes(booking.status),
        "Confirm the booking before recording receipts",
        409,
      );
      must(
        net + input.amount <= booking.pricingSnapshot.totalAmount,
        "Receipt exceeds the remaining balance",
        409,
      );
      booking.receivedAmount += input.amount;
    } else {
      must(input.amount <= net, "Refund exceeds recorded receipts", 409);
      booking.refundedAmount += input.amount;
    }
    await booking.save({ session });
    const [payment] = await Payment.create(
      [{ ...input, venueId, hallId: booking.hallId, recordedBy: actorId }],
      {
        session,
      },
    );
    await audit(`payment.${input.type.toLowerCase()}`, venueId, actorId, payment._id, session);
    return payment;
  });
}
