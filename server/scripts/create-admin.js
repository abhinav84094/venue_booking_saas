import "dotenv/config";
import mongoose from "mongoose";
import { validateEnvironment } from "../config/env.js";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import { AuditLog } from "../models/venueModels.js";
const email = process.argv[2]?.trim().toLowerCase();
try {
  if (!email) throw new Error("Usage: npm run admin -- verified-owner@example.com");
  validateEnvironment();
  await connectDB();
  const user = await User.findOne({ email, emailVerified: true, suspended: false });
  if (!user) throw new Error("Register and verify this account before promoting it");
  user.role = "platform_admin";
  user.tokenVersion += 1;
  await user.save();
  await AuditLog.create({
    actorId: user._id,
    resourceId: user._id,
    action: "platform_admin.promoted_via_operator_cli",
  });
  console.log("Account promoted. Existing sessions were revoked; sign in again at /admin.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
