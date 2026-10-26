
import express from "express";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Restaurant Platform API is running",
  });
});

// User authentication routes
app.use("/api/v1/users", userRoutes);

export default app;
