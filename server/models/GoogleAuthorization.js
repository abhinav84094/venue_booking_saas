import mongoose from "mongoose";

// Persist hashes of opaque cookies. TTL only cleans up; reads check expiry.
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["challenge", "setup"], required: true },
  purpose: { type: String, enum: ["login", "register", "recover", "link"], required: true },
  nonce: String,
  googleId: String,
  email: String,
  name: String,
  userId: mongoose.Schema.Types.ObjectId,
  tokenVersion: Number,
  expiresAt: { type: Date, required: true, expires: 0 },
});
export default mongoose.model("GoogleAuthorization", schema);
