import { Router } from "express";
import {signup,login,logout,getCurrentUser,verifyEmailAddress,resendVerificationEmail,changePassword,updateProfile,forgotPassword,resetPassword,} from "../controllers/user.controllers";
import { isAuthenticated } from "../middleware/auth.middleware";
import { rateLimit, byUser, byBodyEmail, byIpAndEmail } from "../middleware/rate-limit.middleware";

const router = Router();

const MINUTE = 60;
const HOUR = 60 * MINUTE;

router.post("/signup", rateLimit({ name: "signup", windowSeconds: HOUR, max: 10 }), signup);
router.post(
  "/login",
  // Per IP + email stops password guessing on one account; per IP stops sweeping many accounts.
  rateLimit({ name: "login", windowSeconds: 15 * MINUTE, max: 8, key: byIpAndEmail, message: "Too many sign-in attempts. Wait 15 minutes or reset your password." }),
  rateLimit({ name: "login-ip", windowSeconds: 15 * MINUTE, max: 50 }),
  login,
);
router.post("/logout", logout);
router.get("/me", isAuthenticated, getCurrentUser);
router.patch("/me", isAuthenticated, rateLimit({ name: "profile", windowSeconds: 15 * MINUTE, max: 20, key: byUser }), updateProfile);
router.post("/verify-email", rateLimit({ name: "verify-email", windowSeconds: 15 * MINUTE, max: 20 }), verifyEmailAddress);
router.post(
  "/verify-email/resend",
  isAuthenticated,
  rateLimit({ name: "verify-resend", windowSeconds: MINUTE, max: 1, key: byUser, message: "We just sent a link. Check your inbox (and spam), or try again in a minute." }),
  rateLimit({ name: "verify-resend-hour", windowSeconds: HOUR, max: 5, key: byUser }),
  resendVerificationEmail,
);
router.post("/change-password", isAuthenticated, rateLimit({ name: "change-password", windowSeconds: 15 * MINUTE, max: 5, key: byUser }), changePassword);
router.post(
  "/forgot-password",
  rateLimit({ name: "forgot-ip", windowSeconds: HOUR, max: 10 }),
  // Stops anyone flooding one person's inbox with reset emails.
  rateLimit({ name: "forgot-email", windowSeconds: HOUR, max: 3, key: byBodyEmail, message: "We've already sent a few reset links. Check your inbox (and spam), or try again in an hour." }),
  forgotPassword,
);
router.post("/reset-password", rateLimit({ name: "reset-password", windowSeconds: 15 * MINUTE, max: 10 }), resetPassword);

export default router;
