import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { AUTH_COOKIE, publicUser } from "../utils/authCookie.js";
import { must } from "../utils/errors.js";
export async function protect(req, _res, next) {
  try {
    must(req.cookies?.[AUTH_COOKIE], "Authentication required", 401);
    const decoded = jwt.verify(req.cookies[AUTH_COOKIE], process.env.VENUE_JWT_SECRET, {
      algorithms: ["HS256"],
    });
    must(mongoose.isObjectIdOrHexString(decoded.userId), "Invalid session", 401);
    const user = await User.findById(decoded.userId).select(
      "name email role emailVerified suspended tokenVersion",
    );
    must(
      user && decoded.tokenVersion === (user.tokenVersion ?? 0),
      "Session expired. Sign in again.",
      401,
    );
    must(user.emailVerified && !user.suspended, "Account is unverified or suspended", 403);
    req.user = user;
    next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name))
      error.statusCode = 401;
    next(error);
  }
}
export const getMe = (req, res) => res.json({ success: true, user: publicUser(req.user) });
