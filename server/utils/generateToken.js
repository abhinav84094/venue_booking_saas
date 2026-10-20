import jwt from "jsonwebtoken";

const generateToken = (userId, tokenVersion) => {
  if (!process.env.VENUE_JWT_SECRET) {
    throw new Error("VENUE_JWT_SECRET is not configured");
  }

  return jwt.sign({ userId: userId.toString(), tokenVersion }, process.env.VENUE_JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
};

export default generateToken;
