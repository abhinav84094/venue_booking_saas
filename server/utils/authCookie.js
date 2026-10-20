export const AUTH_COOKIE = "venueAccessToken";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.VENUE_COOKIE_SAME_SITE === "none" ? "none" : "lax",
  path: "/",
});
export const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerified: user.emailVerified,
});
