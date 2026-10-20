import express from "express";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import {
  registerUser,
  verifyEmail,
  resendVerificationOtp,
  loginUser,
  logoutUser,
  forgotPassword,
  updateAccount,
  resetPassword,
} from "../controllers/authController.js";
import { protect, getMe } from "../middleware/authMiddleware.js";

import { googleLogin, completeGoogleSignup } from "../controllers/googleAuthController.js";

const router = express.Router();

router.post("/register", apiLimiters.register, registerUser);
router.post("/verify-email", apiLimiters.verification, verifyEmail);
router.post("/resend-verification-otp", apiLimiters.recovery, resendVerificationOtp);
router.post("/login", apiLimiters.passwordLogin, loginUser);
router.get("/me", protect, getMe);
router.post("/logout", logoutUser);
router.post("/forgot-password", apiLimiters.recovery, forgotPassword);
router.post("/reset-password", apiLimiters.recovery, resetPassword);
router.patch("/account", protect, updateAccount);

router.post("/google", apiLimiters.googleLogin, googleLogin);
router.post("/google/complete-signup", apiLimiters.googleSignup, completeGoogleSignup);

export default router;
