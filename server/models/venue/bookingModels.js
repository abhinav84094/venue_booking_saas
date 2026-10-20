import mongoose from "mongoose";
import { options, ref, money } from "./schemaTypes.js";
const { Schema } = mongoose;
const customer = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    name: String,
    phone: { type: String, required: true },
    email: String,
  },
  options,
);
customer.index({ venueId: 1, hallId: 1, phone: 1 }, { unique: true });
const quote = new Schema(
  {
    model: String,
    label: String,
    unitAmount: money,
    units: Number,
    totalAmount: money,
    currency: { type: String, enum: ["INR"], default: "INR" },
    timezone: String,
    quotedAt: Date,
  },
  { _id: false },
);
const booking = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    customerId: ref("Customer", { immutable: true }),
    reference: { type: String, required: true, unique: true, immutable: true },
    statusTokenHash: { type: String, required: true, select: false, immutable: true },
    startAt: { type: Date, required: true, immutable: true },
    endAt: { type: Date, required: true, immutable: true },
    timezone: { type: String, required: true, immutable: true },
    pricingSnapshot: { type: quote, required: true, immutable: true },
    eventType: String,
    guests: Number,
    notes: String,
    status: {
      type: String,
      enum: ["ENQUIRY", "PENDING", "CONFIRMED", "COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"],
      default: "ENQUIRY",
    },
    enquiryExpiresAt: Date,
    receivedAmount: { ...money, default: 0 },
    refundedAmount: { ...money, default: 0 },
    history: [
      new Schema(
        { status: String, at: Date, actorId: { type: Schema.Types.ObjectId, ref: "User" } },
        { _id: false },
      ),
    ],
  },
  options,
);
booking.index({ venueId: 1, hallId: 1, status: 1, startAt: 1, endAt: 1 });
booking.index({ venueId: 1, status: 1, startAt: 1 });
booking.index({ venueId: 1, customerId: 1 });
const block = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reason: String,
    type: { type: String, enum: ["MANUAL", "MAINTENANCE"] },
    createdBy: ref("User"),
  },
  options,
);
block.index({ venueId: 1, hallId: 1, startAt: 1, endAt: 1 });
for (const schema of [booking, block])
  schema.pre("validate", function () {
    if (this.startAt >= this.endAt) this.invalidate("endAt", "End must be after start");
  });
const payment = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    bookingId: ref("Booking", { immutable: true }),
    amount: money,
    currency: { type: String, enum: ["INR"], default: "INR" },
    type: { type: String, enum: ["RECEIPT", "REFUND"] },
    method: { type: String, enum: ["cash", "upi", "bank_transfer", "other"] },
    reference: String,
    idempotencyKey: { type: String, required: true },
    recordedBy: ref("User"),
    source: { type: String, enum: ["owner_recorded"], default: "owner_recorded" },
  },
  options,
);
payment.index({ venueId: 1, idempotencyKey: 1 }, { unique: true });
payment.index({ venueId: 1, type: 1, method: 1, reference: 1 }, { unique: true });
payment.index({ venueId: 1, createdAt: -1 });
payment.index({ venueId: 1, bookingId: 1 });
customer.index({ venueId: 1, hallId: 1, createdAt: -1, _id: -1 });
booking.index({ venueId: 1, hallId: 1, createdAt: -1, _id: -1 });
payment.index({ venueId: 1, hallId: 1, createdAt: -1, _id: -1 });
export const Customer = mongoose.model("Customer", customer);
export const Booking = mongoose.model("Booking", booking);
export const AvailabilityBlock = mongoose.model("AvailabilityBlock", block);
export const Payment = mongoose.model("Payment", payment);
