import type { Request, Response, NextFunction } from "express";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// The apps that may call the API from a browser, plus any extra origins (comma separated).
export function allowedOrigins(): string[] {
  return [process.env.CUSTOMER_APP_URL, process.env.DASHBOARD_APP_URL, ...(process.env.CORS_ORIGINS ?? "").split(",")]
    .map((value) => value?.trim().replace(/\/+$/, ""))
    .filter((value): value is string => Boolean(value));
}

// CSRF guard: the auth cookie rides along automatically, so requests that change
// data must come from our own pages. Same-origin covers the dev proxy and tunnels.
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");

  // Non-browser clients (curl, server-to-server) don't send Origin and can't carry a victim's cookie.
  if (!origin) {
    next();
    return;
  }

  let sameHost = false;
  try {
    sameHost = new URL(origin).host === req.get("host");
  } catch {
    // Malformed Origin header: treat as untrusted.
  }

  if (sameHost || allowedOrigins().includes(origin)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: "Request blocked: unrecognised origin",
  });
}
