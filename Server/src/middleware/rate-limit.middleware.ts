import type { Request, Response, NextFunction } from "express";
import { redisConnection } from "../config/redis";

interface RateLimitOptions {
  // Distinguishes counters, e.g. "login".
  name: string;
  windowSeconds: number;
  max: number;
  // What to count by; defaults to the client IP. Return null to skip limiting.
  key?: (req: Request, res: Response) => string | null | undefined;
  message?: string;
}

const byIp = (req: Request) => req.ip ?? null;

// Fixed-window limiter kept in Redis, so limits hold across restarts and server instances.
export function rateLimit({ name, windowSeconds, max, key = byIp, message }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = key(req, res);
    if (!id) {
      next();
      return;
    }

    const redisKey = `rate:${name}:${id}`;

    try {
      // Start the window only on the first hit, then count.
      const results = await redisConnection
        .multi()
        .set(redisKey, 0, "EX", windowSeconds, "NX")
        .incr(redisKey)
        .ttl(redisKey)
        .exec();

      const count = Number(results?.[1]?.[1] ?? 0);
      const ttl = Math.max(Number(results?.[2]?.[1] ?? windowSeconds), 1);

      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(max - count, 0));
      res.setHeader("RateLimit-Reset", ttl);

      if (count > max) {
        res.setHeader("Retry-After", ttl);
        const minutes = Math.ceil(ttl / 60);
        res.status(429).json({
          success: false,
          message: message ?? `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        });
        return;
      }
    } catch (error) {
      // If Redis is down, don't lock everyone out.
      console.error(`Rate limiter "${name}" unavailable:`, (error as Error).message);
    }

    next();
  };
}

// Count per signed-in user (use after isAuthenticated).
export const byUser = (_req: Request, res: Response) => res.locals.userId as string | undefined;

// Count per email in the request body, so one account can't be hammered from many IPs.
export const byBodyEmail = (req: Request) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
};

export const byIpAndEmail = (req: Request) => {
  const email = byBodyEmail(req);
  return email ? `${req.ip}:${email}` : byIp(req);
};
