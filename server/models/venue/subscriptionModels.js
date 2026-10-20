import mongoose from "mongoose";
import { options, ref, money } from "./schemaTypes.js";
const { Schema } = mongoose;
const plan = new Schema(
  {
    name: String,
    code: { type: String, unique: true, required: true },
    amount: money,
    currency: { type: String, enum: ["INR"], default: "INR" },
    interval: { type: String, enum: ["monthly", "quarterly", "yearly"] },
    durationDays: { type: Number, enum: [30, 90, 365] },
    active: { type: Boolean, default: true },
    features: { publicWebsite: Boolean, enquiries: Boolean },
  },
  options,
);
const subscription = new Schema(
  {
    ownerId: ref("User", { immutable: true }),
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
    planSnapshot: {
      name: String,
      amount: Number,
      interval: String,
      durationDays: Number,
      features: { publicWebsite: Boolean, enquiries: Boolean },
    },
    status: {
      type: String,
      enum: ["pending", "active", "expired", "review_required", "suspended"],
      default: "pending",
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    activePaymentId: { type: Schema.Types.ObjectId, ref: "SubscriptionPayment" },
    checkoutLock: { type: String, default: null },
    checkoutDraft: { type: Schema.Types.Mixed, default: null },
  },
  options,
);
subscription.index(
  { hallId: 1 },
  { unique: true, partialFilterExpression: { hallId: { $type: "objectId" } } },
);
subscription.index({ status: 1, currentPeriodEnd: 1 });
subscription.pre("validate", function () {
  if (
    this.status === "active" &&
    (!(this.currentPeriodStart instanceof Date) ||
      !(this.currentPeriodEnd instanceof Date) ||
      !Number.isFinite(this.currentPeriodStart.getTime()) ||
      !Number.isFinite(this.currentPeriodEnd.getTime()) ||
      this.currentPeriodEnd <= this.currentPeriodStart)
  )
    this.invalidate("currentPeriodEnd", "Active subscriptions require a valid increasing period");
});
subscription.index({ ownerId: 1, venueId: 1 });
const subscriptionPayment = new Schema(
  {
    ownerId: ref("User", { immutable: true }),
    venueId: ref("Venue", { immutable: true }),
    hallId: ref("Hall", { immutable: true }),
    subscriptionId: ref("Subscription", { immutable: true }),
    planId: ref("SubscriptionPlan", { immutable: true }),
    planSnapshot: {
      name: String,
      amount: Number,
      interval: String,
      durationDays: Number,
      features: { publicWebsite: Boolean, enquiries: Boolean },
    },
    amount: money,
    currency: { type: String, enum: ["INR"], default: "INR" },
    receipt: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: String,
    status: {
      type: String,
      enum: ["created", "paid", "review_required", "refunded"],
      default: "created",
    },
    paidAt: Date,
    financialEventKeys: [String],
    reviewReason: String,
  },
  options,
);
subscriptionPayment.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } },
);
subscriptionPayment.index({ venueId: 1, createdAt: -1 });
subscriptionPayment.index({ hallId: 1, createdAt: -1 });
export const SubscriptionPlan = mongoose.model("SubscriptionPlan", plan);
export const Subscription = mongoose.model("Subscription", subscription);
export const SubscriptionPayment = mongoose.model("SubscriptionPayment", subscriptionPayment);
