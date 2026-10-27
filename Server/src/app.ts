
import express from "express";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes";
import restaurantRoutes from "./routes/restaurant.routes";
import branchRoutes from "./routes/branch.routes";
const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Restaurant Platform API is running",
  });
});

// All routes belowroutes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/restaurants", restaurantRoutes);
app.use("/api/v1/branches", branchRoutes);
export default app;
