import mongoose from "mongoose";
import { AuditLog } from "../models/venueModels.js";

export const transaction = (fn) =>
  mongoose.connection.transaction(fn, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
export const audit = (action, venueId, actorId, resourceId, session) =>
  AuditLog.create([{ action, venueId, actorId, resourceId }], { session });
