import {
  authenticateGoogleAccount,
  registerGoogleAccount,
} from "../services/auth/googleAccountService.js";
import { googleSignupSchema } from "../validators/authValidator.js";
import { issueLogin } from "./authController.js";

export const googleLogin = async (req, res) => {
  try {
    const result = await authenticateGoogleAccount(req.body?.credential);
    if (result.user) return issueLogin(res, result.user);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      success: false,
      message: [403, 409, 503].includes(error.statusCode)
        ? error.message
        : "Google authentication failed",
    });
  }
};

export const completeGoogleSignup = async (req, res) => {
  try {
    const input = googleSignupSchema.safeParse(req.body);
    if (!input.success)
      return res.status(400).json({
        success: false,
        message: "Matching passwords of at least 8 characters are required",
      });
    const user = await registerGoogleAccount(input.data);
    return issueLogin(res, user);
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ success: false, message: "Account already exists" });
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to complete Google signup",
    });
  }
};
