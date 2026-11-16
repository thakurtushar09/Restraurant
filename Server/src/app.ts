
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import userRoutes from "./routes/user.routes";
import restaurantRoutes from "./routes/restaurant.routes";
import branchRoutes from "./routes/branch.routes";
import publicRoutes from "./routes/public.routes";
import orderRoutes from "./routes/order.routes";
import orderManagementRoutes from "./routes/order-management.routes";
import customerOrderRoutes from "./routes/customer-order.routes";
import addressRoutes from "./routes/address.routes";
import notificationRoutes from "./routes/notification.routes";
import { notFound, errorHandler } from "./middleware/error.middleware";
import { requireTrustedOrigin, allowedOrigins } from "./middleware/security.middleware";
import { rateLimit } from "./middleware/rate-limit.middleware";

const app = express();

// Real client IPs for rate limiting. Default trusts local proxies (Vite dev proxy, tunnels);
// in production set TRUST_PROXY to your load balancer's hop count, e.g. 1.
const trustProxy = process.env.TRUST_PROXY ?? "loopback";
app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(helmet());
app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(requireTrustedOrigin);
// Generous ceiling per IP; sensitive routes add tighter limits of their own.
app.use("/api", rateLimit({ name: "api", windowSeconds: 60, max: 300, message: "Too many requests. Slow down for a minute." }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CraveQ API is running",
  });
});

// All routes belowroutes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/restaurants", restaurantRoutes);
app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/branch-orders", orderManagementRoutes);
app.use("/api/v1/customer-orders", customerOrderRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);
export default app;
