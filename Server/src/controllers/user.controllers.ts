import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import type { SignupRequestBody, LoginRequestBody, ChangePasswordRequestBody, UpdateProfileRequestBody } from "../types/user.types";
import { passwordChangedEmail } from "../emails";
import { sendEmail, type AppName } from "../utils/send-email";
import { readVerificationToken, sendVerificationEmail } from "../utils/email-verification";
import { readResetToken, resetTokenMatches, sendPasswordResetEmail } from "../utils/password-reset";
import { accountKindOf, WRONG_ACCOUNT_MESSAGES, type AccountKind } from "../middleware/auth.middleware";

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions ={
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// What the apps need to know about the signed-in person.
const sessionUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  isEmailVerified: true,
  mustChangePassword: true,
} as const;

const readApp = (value: unknown): AppName => (value === "dashboard" ? "dashboard" : "customer");

// The customer site takes customer accounts; the dashboard takes restaurant (owner/staff) accounts.
const kindForApp = (app: AppName): AccountKind => (app === "dashboard" ? "restaurant" : "customer");
const appForAccount = (userType: string): AppName => (accountKindOf(userType) === "restaurant" ? "dashboard" : "customer");

// Issues a fresh session cookie; also used after a password change so this device stays signed in.
function setSessionCookie(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: COOKIE_MAX_AGE,
  });
}

function getJwtSecret():string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

// SIGNUP
export async function signup(req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    const { fullName, email, password, app } = req.body as SignupRequestBody;
    if (typeof fullName !== "string" ||!fullName.trim() || typeof email !== "string" ||!email.trim() ||typeof password !== "string" ||password.length < 8){
      res.status(400).json({
        success: false,
        message:
          "Full name and email are required; password must be at least 8 characters",
      });
      return;
    }

    // Fail before creating the account if sessions can't be issued.
    getJwtSecret();

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { userType: true },
    });

    if (existingUser) {
      // Same kind: they just need to log in. Other kind: an email can't be both, so they need a different one.
      const sameKind = accountKindOf(existingUser.userType) === kindForApp(readApp(app));
      res.status(409).json({
        success: false,
        message: sameKind ? "Email is already registered. Log in instead." : WRONG_ACCOUNT_MESSAGES[kindForApp(readApp(app))],
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        // Dashboard sign-ups are business accounts from the start, so they can never order as customers.
        userType: readApp(app) === "dashboard" ? "RESTAURANT_OWNER" : "CUSTOMER",
      },
      select: sessionUserSelect,
    });

    setSessionCookie(res, user.id);

    // Don't hold up signup on the email provider; sendEmail logs its own failures.
    void sendVerificationEmail(user, readApp(app));

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    next(error);
  }
}

// CURRENT SESSION
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = res.locals.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ success: false, message: "Please log in first" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: { ...sessionUserSelect, userType: true },
    });

    if (!user) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.status(401).json({ success: false, message: "Your account is unavailable" });
      return;
    }

    // An app that says which it is only keeps sessions of its own account kind.
    const app = req.query.app;
    if (app !== undefined && accountKindOf(user.userType) !== kindForApp(readApp(app))) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.status(403).json({ success: false, code: "WRONG_ACCOUNT", message: WRONG_ACCOUNT_MESSAGES[kindForApp(readApp(app))] });
      return;
    }
    const { userType: _userType, ...sessionUser } = user;

    res.status(200).json({ success: true, user: sessionUser });
  } catch (error) {
    next(error);
  }
}

// LOGIN
export async function login(req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    const { email, password, app } = req.body as LoginRequestBody;

    if (typeof email !== "string" ||!email.trim() ||typeof password !== "string" ||!password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user || user.status !== "ACTIVE" || user.deletedAt !== null) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Checked only after the password, so the account kind isn't revealed to someone guessing.
    const appKind = kindForApp(readApp(app));
    if (accountKindOf(user.userType) !== appKind) {
      res.status(403).json({ success: false, code: "WRONG_ACCOUNT", message: WRONG_ACCOUNT_MESSAGES[appKind] });
      return;
    }

    setSessionCookie(res, user.id);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
}

// LOGOUT
export async function logout(_req: Request,res: Response,next: NextFunction,): Promise<void> {
  try {
    res.clearCookie(COOKIE_NAME, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
}

// VERIFY EMAIL (link from the email; no login needed)
export async function verifyEmailAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.body as { token?: unknown })?.token;
    const payload = typeof token === "string" ? readVerificationToken(token) : null;

    if (!payload) {
      res.status(400).json({
        success: false,
        message: "This link is invalid or has expired. Sign in and ask for a new one.",
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, isEmailVerified: true },
    });

    // The token is bound to the address it was sent to.
    if (!user || user.email !== payload.email) {
      res.status(400).json({
        success: false,
        message: "This link no longer matches your account. Ask for a new one.",
      });
      return;
    }

    if (!user.isEmailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
    }

    res.status(200).json({
      success: true,
      message: user.isEmailVerified ? "Your email was already confirmed" : "Email confirmed",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
}

// RESEND VERIFICATION EMAIL
export async function resendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = res.locals.userId as string;
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, fullName: true, email: true, isEmailVerified: true },
    });

    if (!user) {
      res.status(401).json({ success: false, message: "Your account is unavailable" });
      return;
    }

    if (user.isEmailVerified) {
      res.status(200).json({ success: true, message: "Your email is already confirmed" });
      return;
    }

    const result = await sendVerificationEmail(user, readApp((req.body as { app?: unknown })?.app));

    if (!result.sent) {
      res.status(502).json({
        success: false,
        message: `We couldn't send the email: ${result.error}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `We sent a new link to ${user.email}`,
    });
  } catch (error) {
    next(error);
  }
}

// CHANGE PASSWORD
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = res.locals.userId as string;
    const { currentPassword, newPassword } = (req.body ?? {}) as ChangePasswordRequestBody;

    if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "Enter your current password and a new one of at least 8 characters",
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: "Choose a password different from the current one",
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, fullName: true, email: true, passwordHash: true },
    });

    if (!user) {
      res.status(401).json({ success: false, message: "Your account is unavailable" });
      return;
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({
        success: false,
        message: "Your current password is incorrect",
      });
      return;
    }

    const changedAt = new Date();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: changedAt,
        mustChangePassword: false,
      },
      select: sessionUserSelect,
    });

    // Other devices are signed out by the newer passwordChangedAt; keep this one signed in.
    setSessionCookie(res, user.id);
    void sendEmail(user.email, passwordChangedEmail({ name: user.fullName, changedAt }));

    res.status(200).json({
      success: true,
      message: "Password updated",
      user: updated,
    });
  } catch (error) {
    next(error);
  }
}

// UPDATE PROFILE (name and phone; email changes would need re-verification)
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = res.locals.userId as string;
    const { fullName, phone } = (req.body ?? {}) as UpdateProfileRequestBody;
    const data: { fullName?: string; phone?: string | null } = {};

    if (fullName !== undefined) {
      if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
        res.status(400).json({ success: false, message: "Enter your full name" });
        return;
      }
      data.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      const value = typeof phone === "string" ? phone.trim() : "";
      if (value && !/^\+?[0-9][0-9\s-]{6,18}$/.test(value)) {
        res.status(400).json({ success: false, message: "Enter a valid phone number" });
        return;
      }
      data.phone = value || null;
    }

    if (!Object.keys(data).length) {
      res.status(400).json({ success: false, message: "Nothing to update" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: sessionUserSelect,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated",
      user,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "This phone number is already used by another account",
      });
      return;
    }

    next(error);
  }
}

// FORGOT PASSWORD: always the same answer, so it can't be used to find out who has an account.
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = (req.body ?? {}) as { email?: unknown };

    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({ success: false, message: "Enter your email address" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, fullName: true, email: true, passwordHash: true, status: true, deletedAt: true, userType: true },
    });

    // Sent in the background so the response time doesn't reveal whether the account exists.
    // The link always opens the app this account belongs to, whichever app asked.
    if (user && user.status === "ACTIVE" && !user.deletedAt) {
      void sendPasswordResetEmail(user, appForAccount(user.userType));
    }

    res.status(200).json({
      success: true,
      message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour.",
    });
  } catch (error) {
    next(error);
  }
}

// RESET PASSWORD (link from the email)
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = (req.body ?? {}) as { token?: unknown; newPassword?: unknown };

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({ success: false, message: "Choose a password with at least 8 characters" });
      return;
    }

    const payload = typeof token === "string" ? readResetToken(token) : null;
    const user = payload
      ? await prisma.user.findFirst({
        where: { id: payload.userId, status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true, email: true, passwordHash: true },
      })
      : null;

    // Expired, tampered with, or already used (the password, and so the fingerprint, has changed).
    if (!payload || !user || !resetTokenMatches(payload.fp, user.passwordHash)) {
      res.status(400).json({
        success: false,
        message: "This reset link is invalid, expired or already used. Ask for a new one.",
      });
      return;
    }

    const changedAt = new Date();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: changedAt,
        mustChangePassword: false,
        // Opening the emailed link proves they own the inbox.
        isEmailVerified: true,
        lastLoginAt: changedAt,
      },
      select: sessionUserSelect,
    });

    setSessionCookie(res, user.id);
    void sendEmail(user.email, passwordChangedEmail({ name: user.fullName, changedAt }));

    res.status(200).json({
      success: true,
      message: "Password updated. You're signed in.",
      user: updated,
    });
  } catch (error) {
    next(error);
  }
}
