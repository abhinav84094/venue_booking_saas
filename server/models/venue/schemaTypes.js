import mongoose from "mongoose";
const { Schema } = mongoose;
export const options = { timestamps: true, strict: "throw" };
export const ref = (model, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true,
  ...extra,
});
export const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
export const image = new Schema(
  { url: { type: String, required: true }, alt: { type: String, default: "" } },
  { _id: false },
);
