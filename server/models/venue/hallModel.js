import mongoose from "mongoose";
import { options, ref, money, image } from "./schemaTypes.js";
const { Schema } = mongoose;
const rate = new Schema(
  {
    key: {
      type: String,
      required: true,
      enum: ["FULL_DAY", "HALF_DAY", "HOURLY", "PACKAGE", "CUSTOM"],
    },
    label: String,
    amount: money,
    durationMinutes: Number,
    weekendAmount: { type: Number, default: null },
    overrides: [new Schema({ startDate: String, endDate: String, amount: money }, { _id: false })],
  },
  { _id: false },
);
const hall = new Schema(
  {
    venueId: ref("Venue", { immutable: true }),
    name: { type: String, required: true },
    description: String,
    capacity: { type: Number, required: true, min: 1 },
    images: [image],
    facilities: [String],
    active: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    pricing: [rate],
    bookingVersion: { type: Number, default: 0, select: false },
  },
  options,
);
hall.index({ venueId: 1, active: 1, published: 1 });
export const Hall = mongoose.model("Hall", hall);
