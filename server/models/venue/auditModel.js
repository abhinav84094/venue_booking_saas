import mongoose from "mongoose";
const { Schema } = mongoose;
const audit = new Schema(
  {
    venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    at: { type: Date, default: Date.now },
  },
  { strict: "throw" },
);
audit.index({ venueId: 1, at: -1 });
export const AuditLog = mongoose.model("AuditLog", audit);
