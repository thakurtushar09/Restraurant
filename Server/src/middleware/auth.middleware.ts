
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function isAuthenticated(req: Request,res: Response,next: NextFunction): void {
  try {
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

    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string"||typeof decoded.sub !== "string") {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    res.locals.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}
