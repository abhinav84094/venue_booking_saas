import express from "express";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";
import { loginUser, logoutUser, updateAccount } from "../controllers/authController.js";
import { protect, getMe } from "../middleware/authMiddleware.js";
import {
  googleChallenge,
  googleLogin,
  googleSetupStatus,
  completeGoogleSetup,
  completeGoogleLink,
} from "../controllers/googleAuthController.js";

const router = express.Router();
router.post("/login", apiLimiters.passwordLogin, loginUser);
router.get("/me", protect, getMe);
router.post("/logout", logoutUser);
router.patch("/account", protect, updateAccount);
router.post("/google/challenge", apiLimiters.googleChallenge, googleChallenge);
router.post("/google", apiLimiters.googleLogin, googleLogin);
router.get("/google/password-setup", apiLimiters.googleSetup, googleSetupStatus);
router.post("/google/password-setup", apiLimiters.googleSetup, completeGoogleSetup);
router.post("/google/link", apiLimiters.googleLink, completeGoogleLink);
export default router;
