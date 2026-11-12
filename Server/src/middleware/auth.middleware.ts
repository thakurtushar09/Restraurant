import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

const COOKIE_NAME = "token";

function reject(res: Response, message: string): void {
  // Drop a cookie that will never work again so the apps fall back to the sign-in page.
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  res.status(401).json({
    success: false,
    message,
  });
}

export async function isAuthenticated(req: Request,res: Response,next: NextFunction): Promise<void> {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Please log in first",
    });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: "Authentication configuration error",
    });
    return;
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    reject(res, "Invalid or expired token");
    return;
  }

  // Verification/reset tokens carry a purpose and must never work as a session.
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || decoded.purpose !== undefined) {
    reject(res, "Invalid authentication token");
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { status: true, deletedAt: true, passwordChangedAt: true },
    });

    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      reject(res, "Your account is unavailable");
      return;
    }

    // Sessions issued before the latest password change are signed out everywhere.
    if (user.passwordChangedAt && (decoded.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      reject(res, "Your password was changed. Please sign in again.");
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  res.locals.userId = decoded.sub;
  next();
}
